# Issues Found

All issues discovered during the codebase audit. Severity levels: **Critical** (data loss / security), **High** (incorrect behavior / visible bug), **Medium** (inconsistency / minor bug), **Low** (code quality / tech debt).

---

## BUG-001 — Password minLength HTML attribute does not match JS validation ✅ Fixed

| Field | Value |
|---|---|
| **Type** | Bug |
| **Severity** | Medium |
| **File** | `components/auth/sign-up-form.tsx` line 274 |
| **Status** | **Fixed** — changed `minLength={6}` to `minLength={8}` |

**Description:**  
The password `<Input>` element has `minLength={6}` as an HTML attribute, but the JavaScript validation on line 75 checks `password.length < 8` and shows the error "Password must be at least 8 characters". The HTML `minLength` constraint will block submission (or show a native browser tooltip) for any password between 6 and 7 characters, while native HTML validation would still allow 6-character passwords — the two checks are contradictory.

**Impact:** A user typing a 6 or 7-character password will see a native HTML tooltip saying "Please lengthen this text to 6 characters or more" (or similar), while the actual enforced minimum is 8. The UX is misleading and the placeholder text says "At least 8 characters". If the HTML attribute is ever relied upon for validation elsewhere, the inconsistency could allow weak passwords.

**Suggested Fix:** Change `minLength={6}` to `minLength={8}` to match the JS validation and the placeholder text.

---

## BUG-002 — Trial plan member_limit inconsistency: PRICING_PLANS shows 2, onboarding seeds 3 ✅ Fixed

| Field | Value |
|---|---|
| **Type** | Bug / Data Inconsistency |
| **Severity** | Medium |
| **File** | `lib/types/subscription.ts` line 64 vs `lib/onboarding.ts` line 111 |
| **Status** | **Fixed** — `lib/onboarding.ts` `member_limit` changed from `3` to `2` |

**Description:**  
`PRICING_PLANS` in `lib/types/subscription.ts` defines the trial plan `member_limit` as `2`. `runOnboarding()` in `lib/onboarding.ts` inserts a subscription row with `member_limit: 3`. The UI (pricing/billing pages) that reads from `PRICING_PLANS` will show "Up to 2 team members" for trials, but the actual database row and `checkPlanLimit()` enforcement uses the value from the `subscriptions` table, which is `3`.

**Impact:** Users on trial can add up to 3 members, but the pricing page advertises only 2. Misleading; could also cause confusion if the PRICING_PLANS constant is used for enforcement elsewhere.

**Suggested Fix:** Align both to the same value. Decide whether the trial allows 2 or 3 members and update whichever source is wrong.

---

## BUG-003 — In-memory rate limiting on /api/onboarding resets on server restart ✅ Fixed

| Field | Value |
|---|---|
| **Type** | Bug / Security |
| **Severity** | Medium |
| **File** | `app/api/onboarding/route.ts` lines 8–22 |

**Description:**  
The `POST /api/onboarding` route uses an in-memory `Map` to rate-limit requests. Because the map lives in module scope, it is cleared every time the Next.js server process restarts (e.g., on new deployments, serverless cold starts, or Vercel function recycling). On serverless platforms (Vercel), each function invocation may run in a fresh container, making the rate limiting entirely ineffective.

**Impact:** A bad actor can bypass the rate limit by triggering server restarts, or simply because Vercel Functions do not share memory across invocations. The onboarding endpoint could be called arbitrarily many times.

**Fix applied:** Replaced the in-memory `Map` with a DB-backed check — the route now queries `profiles.organization_id` directly. If the user already has an org the route returns immediately (idempotency guard at the HTTP layer). For users without an org yet, `runOnboarding()` performs the same check internally and is the authoritative guard. The endpoint is documented as "external use only" and the dashboard calls `runOnboarding()` directly.

---

## BUG-004 — candidate_documents table has two size columns (file_size_bytes and file_size) ✅ Fixed

| Field | Value |
|---|---|
| **Type** | Data Inconsistency |
| **Severity** | Low |
| **File** | `lib/actions/public-apply.ts` line 238, `lib/actions/documents.ts` |

**Description:**  
The `candidate_documents` insert in `public-apply.ts` (line 238) sets `file_size: cvFile.size` (column name `file_size`). The documents action in `lib/actions/documents.ts` may use a different column name. Two columns appear to exist or be referenced for the same data — `file_size` and potentially `file_size_bytes`.

**Impact:** One column may be consistently populated while the other is null, or inserts may fail if one column does not exist. Queries that read file size will get unexpected nulls.

**Fix applied (Option A):** Both `lib/actions/documents.ts` and `lib/actions/public-apply.ts` now write `file_size` and `file_size_bytes` from the same value, ensuring both columns are populated consistently.

---

## BUG-005 — Duplicate application detection only matches by email, ignores hired/inactive candidates

| Field | Value |
|---|---|
| **Type** | Logic Issue |
| **Severity** | Low |
| **File** | `lib/actions/public-apply.ts` lines 143–149 |

**Description:**  
The duplicate candidate detection in `submitPublicApplication` queries `candidates` where `general_status_id = activeStatus.id` (i.e., only active candidates). If the same email has a candidate record with status `hired` or `archived`, a new candidate record will be created for that email, resulting in duplicate candidate records in the same organization.

**Impact:** The same person can appear multiple times as a candidate if they previously applied and were hired or archived.

**Suggested Fix:** Remove the `general_status_id` filter from the duplicate detection query, or search across all non-deleted candidates regardless of status.

---

## BUG-006 — Rollback on application insert failure only deletes candidate, not uploaded CV

| Field | Value |
|---|---|
| **Type** | Logic Issue |
| **Severity** | Low |
| **File** | `lib/actions/public-apply.ts` lines 211–216 |

**Description:**  
When the application insert fails (step 12), the code rolls back the newly-created candidate row. However, if the CV was already uploaded to storage before the application insert (it is uploaded after — step 13 — so this specific order is safe), a future refactor changing the order of operations could leave orphaned storage files. Currently the CV upload happens after the application insert, so this is not an active bug. However, the rollback logic does not clean up the storage bucket, so if the order ever changes, orphaned files will accumulate.

**Impact:** Low risk currently; potential future issue if upload order changes.

**Suggested Fix:** Document the dependency on operation order, or add storage cleanup to the rollback block.

---

## BUG-007 — notifications table insert error is silently swallowed without logging in createOrgNotifications ✅ Fixed

| Field | Value |
|---|---|
| **Type** | Observability |
| **Severity** | Low |
| **File** | `lib/actions/notifications.ts` lines 71–75 |

**Description:**  
`createOrgNotifications()` wraps the `supabase.from('notifications').insert(rows)` call in a try/catch that silently discards all errors with no logging. The comment says "Non-fatal: notifications table may not exist yet." While non-fatal is acceptable, errors are not logged, making debugging hard.

**Impact:** If the notifications table exists but an insert fails due to a schema mismatch, constraint violation, or RLS issue, the failure is invisible in logs.

**Fix applied:** `createOrgNotifications` now captures the Supabase insert error and logs it with `console.error`. The exception catch also logs. The misleading "may not exist yet" comment has been removed.

---

## BUG-008 — Public apply email validation uses a simplistic regex, not Zod ✅ Fixed

| Field | Value |
|---|---|
| **Type** | Inconsistency |
| **Severity** | Low |
| **File** | `lib/actions/public-apply.ts` line 55 |

**Description:**  
The public apply server action uses a hand-rolled regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` for email validation instead of using Zod (which is already a project dependency). This is inconsistent with the rest of the codebase which uses Zod schemas for validation.

**Impact:** The regex may accept edge-case email formats that Zod's `.email()` would reject, or vice versa. Inconsistent validation behavior between the public form and internal forms.

**Fix applied:** Replaced hand-rolled regex with `z.string().email().safeParse(email).success`. `zod` is now imported in `lib/actions/public-apply.ts`.

---

## BUG-009 — Max vacancy cap check does not exclude deleted applications ✅ Fixed

| Field | Value |
|---|---|
| **Type** | Logic Issue |
| **Severity** | Low |
| **File** | `lib/actions/public-apply.ts` lines 101–109 |

**Description:**  
The vacancy capacity check (step 6) counts applications with `.eq('vacancy_id', vacancy.id)` and `.eq('organization_id', orgId)` but does not add `.is('deleted_at', null)`. Soft-deleted applications are included in the count. A vacancy with 500 soft-deleted (spam/invalid) applications would be permanently blocked from receiving new applications.

**Impact:** Vacancies cannot receive applications once they accumulate 500 applications total (including deleted ones), even if all 500 were deleted.

**Fix applied:** Added `.is('deleted_at', null)` to the application count query in `lib/actions/public-apply.ts`. Soft-deleted applications are now excluded from the 500-application cap.

---

## TODO-001 — Notifications table assumed not to exist yet (comment in code) ✅ Fixed

| Field | Value |
|---|---|
| **Type** | Tech Debt / TODO |
| **Severity** | Low |
| **File** | `lib/actions/notifications.ts` line 74 |

**Description:**  
The comment `// Non-fatal: notifications table may not exist yet` suggests the notifications feature was added after the initial schema and may not be present in all environments. This conditional existence assumption should be resolved once the migration is confirmed deployed to all environments.

**Fix applied:** Comment removed as part of BUG-007 fix. Errors are now logged properly.

---

## TODO-002 — Interview email failure is non-fatal but not logged ✅ Fixed

| Field | Value |
|---|---|
| **Type** | Observability / TODO |
| **Severity** | Low |
| **File** | `lib/actions/interviews.ts` line 287 |

**Description:**  
Interview creation email failures are non-fatal (interview was already created), but errors are not logged to a monitoring service. If email sending degrades silently, it will not be detected until users complain.

**Fix applied:** Both `createInterview` and `rescheduleInterview` email catch blocks now log with `console.error('[interviews] email send failed:', err)` / `console.error('[interviews] reschedule email send failed:', err)`.

---

## TODO-003 — Old public_page_token UUID backward-compat fallback ✅ Fixed

| Field | Value |
|---|---|
| **Type** | Tech Debt |
| **Severity** | Low |
| **File** | `app/jobs/[slug]/page.tsx` line 14 |

**Description:**  
A fallback exists to support old UUID-format public page tokens (`public_page_token` column) alongside the new slug-based routing. This dual-lookup adds complexity and the old format should eventually be retired.

**Fix applied:** UUID fallback block removed from `app/jobs/[slug]/page.tsx`. The `resolveOrg` function now queries only `public_page_slug`.

---

## TODO-004 — LemonSqueezy billing is planned but not implemented

| Field | Value |
|---|---|
| **Type** | Missing Feature |
| **Severity** | N/A |
| **File** | `lib/types/subscription.ts`, `CLAUDE.md` |

**Description:**  
The subscription/billing system references plan codes (`trial`, `individual`, `organization`) and pricing, but there is no LemonSqueezy webhook handler, checkout session creation, or payment flow implemented. The billing settings page likely shows the pricing but has no active payment link or upgrade mechanism.

**Impact:** Users cannot upgrade from trial to paid plans.

---

## TODO-005 — ESLint removed from CI pipeline ✅ Fixed

| Field | Value |
|---|---|
| **Type** | Tech Debt |
| **Severity** | Low |
| **File** | `docs/6-deployment/ci-cd.md`, project root |

**Description:**  
ESLint was removed from the CI build due to ESLint 9 incompatibility with `eslint-config-next`. While `npm run lint` can be run locally, it is not enforced in CI. Code quality issues will not block merges to main.

**Fix applied:** Created `eslint.config.mjs` using `FlatCompat` with `next/core-web-vitals` and `next/typescript` (ESLint 9 flat config format). Added `npm run lint` step to `.github/workflows/ci.yml` before tests.

---

## TODO-006 — No automated tests in CI pipeline ✅ Fixed

| Field | Value |
|---|---|
| **Type** | Tech Debt |
| **Severity** | Medium |
| **File** | `docs/6-deployment/ci-cd.md` |

**Description:**  
Vitest tests are not run as part of the Vercel CI build. Tests must be run manually locally before pushing. Regressions in test-covered code will not be caught automatically.

**Fix applied:** `.github/workflows/ci.yml` already includes `npm run test` in the lint-and-test job, running on push and PR to `main` and `staging`.
