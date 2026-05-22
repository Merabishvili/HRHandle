# New Unit Tests — 2026-05-08 Re-audit

_Last updated: 2026-05-08_

All tests pass (`npx vitest run` → 15 files, 299 tests). New files added in
this audit pass:

| # | File | Target | Coverage |
|---|---|---|---|
| 1 | `lib/__tests__/utils.test.ts` | `lib/utils.ts` (`cn`) | 7 tests — twMerge conflict resolution, falsy filtering, conditional objects, array flattening, empty input |
| 2 | `lib/__tests__/campaign.test.ts` | `lib/campaign.ts` | 8 tests — boundary date (active / on-end / past), monthly vs annual discount, rounding, zero, deactivated campaign |
| 3 | `lib/validations/__tests__/application.test.ts` | `lib/validations/application.ts` (`ApplicationSchema`) | 11 tests — minimal payload, full payload, null nullables, non-UUID rejection (custom messages), 2000-char `notes` boundary |
| 4 | `lib/validations/__tests__/settings.test.ts` | `lib/validations/settings.ts` (`ProfileSchema`, `OrganizationSchema`) | 19 tests — name length boundaries, phone length, logo_url URL validation, all slug regex edges (hyphen-start, hyphen-end, uppercase, underscores, leading/trailing digit) |
| 5 | `app/api/health/__tests__/route.test.ts` | `GET /api/health` | 4 tests — ok path, DB error path, exception path, asserts the route queries `organizations` |
| 6 | `app/api/cron/expire-vacancies/__tests__/route.test.ts` | `GET /api/cron/expire-vacancies` | 6 tests — happy path, missing header, wrong secret, different-length secret (timing-safe-compare throws), missing `CRON_SECRET` env, RPC failure |
| 7 | `app/api/parse-cv/__tests__/route.test.ts` | `POST /api/parse-cv` | 7 tests — no file, disallowed MIME, success forwarding, parser timeout (504), schema-invalid (422), 11th call rate-limited from a unique IP, "unknown" IP bypasses limiter |

**Net new test count: 64.**

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
