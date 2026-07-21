# New Unit Tests — 2026-05-08 Re-audit

_Last updated: 2026-05-08_

All tests pass (`npx vitest run` → 15 files, 296 tests). New files added in
this audit pass:

| # | File | Target | Coverage |
|---|---|---|---|
| 1 | `lib/__tests__/utils.test.ts` | `lib/utils.ts` (`cn`) | 7 tests — twMerge conflict resolution, falsy filtering, conditional objects, array flattening, empty input |
| 2 | `lib/__tests__/campaign.test.ts` | `lib/campaign.ts` | 8 tests — boundary date (active / on-end / past), monthly vs annual discount, rounding, zero, deactivated campaign |
| 3 | `lib/validations/__tests__/application.test.ts` | `lib/validations/application.ts` (`ApplicationSchema`) | 11 tests — minimal payload, full payload, null nullables, non-UUID rejection (custom messages), 2000-char `notes` boundary |
| 4 | `lib/validations/__tests__/settings.test.ts` | `lib/validations/settings.ts` (`ProfileSchema`, `OrganizationSchema`) | 19 tests — name length boundaries, phone length, logo_url URL validation, all slug regex edges (hyphen-start, hyphen-end, uppercase, underscores, leading/trailing digit) |
| 5 | `app/api/health/__tests__/route.test.ts` | `GET /api/health` | 1 test — liveness probe returns 200 + `{status:"ok"}`. _Reduced from 4 → 1 on 2026-05-23 when the endpoint was simplified to liveness-only (S-001)._ |
| 6 | `app/api/cron/expire-vacancies/__tests__/route.test.ts` | `GET /api/cron/expire-vacancies` | 6 tests — happy path, missing header, wrong secret, different-length secret (timing-safe-compare throws), missing `CRON_SECRET` env, RPC failure |
| 7 | `app/api/parse-cv/__tests__/route.test.ts` | `POST /api/parse-cv` | 7 tests — no file, disallowed MIME, success forwarding, parser timeout (504), schema-invalid (422), 11th call rate-limited from a unique IP, "unknown" IP bypasses limiter |

**Net new test count: 61** (was 64 — health-route tests reduced from 4 to 1 on 2026-05-23).

## Coverage gaps that remain (documented in `docs/issues-found.md`)

These untested units were inspected but not unit-tested in this pass to keep
scope reasonable; they all require non-trivial mocking and are listed here as
follow-ups:

| Area | File | Difficulty | Why deferred |
|---|---|---|---|
| Onboarding | `lib/onboarding.ts` | High | Heavy Supabase admin-client mocking; covers ~6 DB tables |
| CV parser core | `lib/cv-parser.ts` | High | Needs `pdfjs-dist` + `mammoth` + Gemini SDK mocks |
| Email send fns | `lib/email.ts` | Medium | Resend SDK mocking; HTML escaping test surface |
| OAuth callbacks | `app/api/auth/{google,microsoft,zoom}/callback/route.ts` | Medium | OAuth provider mocks + state-cookie machinery |
| Onboarding API | `app/api/onboarding/route.ts` | Medium | Wraps `lib/onboarding.ts` |
| Exports | `app/api/export/{candidates,applications}/route.ts` | Medium | Supabase query builder mocking; CSV diff |
| LinkedIn save | `app/api/integrations/linkedin/save/route.ts` | Low | Form-data parsing + URL extraction |
| Auth confirm | `app/auth/confirm/route.ts` | Low | OTP `verifyOtp` + open-redirect guard |
| Public apply | `lib/actions/public-apply.ts` | High | Largest action file; rate limit + file validation + transaction |
| `useToast` hook reducer | `hooks/use-toast.ts` | Low | Exported reducer is pure; quick wins |

## How to run

```bash
npx vitest run          # all 299 tests
npx vitest watch        # TDD loop
npx vitest run lib/__tests__/campaign.test.ts  # single file
```

## Test infrastructure

- Framework: **vitest** ^4.1.5
- Environment: `node` (no jsdom by default — switch to `jsdom` for React component tests)
- No global setup file yet — see `S-fewer-permission-prompts` note about adding `vitest.setup.ts` for shared mocks (localStorage, fetch, Supabase)
- Path alias `@/` works via `vite-tsconfig-paths`
- All new mocks use `vi.mock(...)` with closures captured at module level.

---

## Re-audit 2026-07-20 — new test files

Added during the deep re-audit. All pure-logic (no mocks needed).

| Test file | Covers | Cases |
|---|---|---|
| `lib/candidates/__tests__/list-derivation.test.ts` | Candidates-list shaping (`groupApplicationsByCandidate`, `aggregateFitScores`, `deriveStageAndFit`, `formatCustomFieldValue`, `buildCustomFieldValueMap`, `stageOf`, `getVacancyTitle`) | 28 |
| `lib/pipeline/__tests__/stage-style.test.ts` | `getStageStyle` (known/unknown/null fallbacks), `isTerminalStage`, `TERMINAL_STAGE_CODES`, `STALE_DAYS` | 19 (shared file below) |
| `lib/pipeline-stages/__tests__/bucket.test.ts` | `mapPipelineStageToBucket` (type mapping + terminal-by-name incl. "Re-hired"→hired, "Withdrew"→withdrawn, custom→rejected, case-insensitivity) | (part of the 19) |
| `lib/validations/__tests__/vacancy.test.ts` (extended) | `VacancyFormSchema` — required sector/status, work_mode sentinel, salary/date refinements, trim | +14 |
| `lib/validations/__tests__/candidate.test.ts` (extended) | `CandidateFormSchema` — required names, optional email/linkedin format, languages array | +15 |

### Recommended next test targets (untested pure helpers — not yet written)

High-value pure modules currently without tests; good candidates for the next testing pass (skip the `lib/types/*` files — they're type-only):

`lib/permissions.ts`, `lib/offers/state.ts`, `lib/offers/expiry.ts`, `lib/screening-questions/knockout-condition.ts`, `lib/screening-questions/compute-flag.ts`, `lib/candidate-merge/defaults.ts`, `lib/audit-log/filter.ts`, `lib/trash/impact.ts`, `lib/mfa/policy.ts`, `lib/mfa/recovery-codes.ts`, `lib/notes/mentions.ts`, `lib/search/query.ts`, `lib/candidate-import/validation.ts`, `lib/candidate-import/parsing.ts`, `lib/vacancy-questions/normalize.ts`, `lib/guides/loader.ts`.

### Re-audit 2026-07-21 — Phase 4 helper tests (batch 2)

Added 7 pure-helper test files (58 tests):

| Test file | Covers |
|---|---|
| `lib/__tests__/permissions.test.ts` | `isOrgAdmin` |
| `lib/offers/__tests__/state.test.ts` | offer state machine (`isTerminal`, `canEdit/Send/Withdraw/Respond`) |
| `lib/offers/__tests__/expiry.test.ts` | `isOfferExpired`, `offerCountdown` (YMD-stable boundaries + urgency) |
| `lib/mfa/__tests__/policy.test.ts` | `evaluatePolicy`, `needsChallenge` (org-wide vs admin-only, AAL) |
| `lib/screening-questions/__tests__/knockout-condition.test.ts` | `evaluateKnockoutPass`, `encodeKnockoutAnswer`, `describeKnockoutAnswer` (yes_no/number/select) |
| `lib/screening-questions/__tests__/compute-flag.test.ts` | `computeIsKnockoutFlag` (guards + delegation) |
| `lib/notes/__tests__/mentions.test.ts` | `extractMentionIds`, `tokenizeNoteForDisplay` (longest-match, coalescing) |
| `lib/__tests__/csv.test.ts` (Phase 2) | `csvCell` — formula-injection guard + RFC-4180 quoting (S-202) |

**Remaining untested helpers:** `lib/candidate-merge/defaults.ts`, `lib/audit-log/filter.ts`, `lib/trash/impact.ts`, `lib/mfa/recovery-codes.ts`, `lib/search/query.ts`, `lib/candidate-import/{validation,parsing}.ts`, `lib/vacancy-questions/normalize.ts`, `lib/guides/loader.ts`.
