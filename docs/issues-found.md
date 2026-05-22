# Issues Found — Re-audit 2026-05-08

_Last updated: 2026-05-23 (progress section added after first batch of fixes)_

This document is the consolidated output of an exhaustive multi-agent re-audit
of the HRHandle staging codebase. Every issue has a stable ID; prefer
*referencing* the ID over re-describing the issue in commits / PRs / other
docs.

## Live-DB Verification Errata (2026-05-08)

Live Supabase MCP queries refuted one critical finding and surfaced five new ones:

- **❌ S-004 / S-rls-gaps RETRACTED** — RLS is in fact enabled on every public table with at least one policy (verified via `pg_policies`). The architecture agent's claim was based only on the SQL files in `supabase/migrations/` checked into the repo, which omit the original RLS setup migration. The risk does **not** exist in the form previously described.
- **🆕 S-NEW-1 through S-NEW-5** added below — surfaced by `mcp__supabase-staging__get_advisors`. See "Live-Advisor Findings" section.

## Summary

- **Total issues found:** 116 (after errata: −1 retracted, +5 from advisors)
- **Severity breakdown:** Critical = 3 · High = 23 · Medium = 56 · Low = 34
- **Category breakdown:**
  - 🔒 Security (S-) 19
  - 🐛 Bugs (B-) 6
  - ❌ Missing / incomplete (M-) 7
  - ➕ Missing features / fields (F-) 12
  - 🗑️ Unnecessary / redundant (U-) 8
  - ⚡ Performance (P-) 6
  - 🏗️ Architecture (A-) 7
  - 💼 Business logic (BL-) 14
  - ⚠️ Configuration (C-) 16
  - ♿ Accessibility (AC-) 12

## Progress (last updated 2026-05-23)

| Status | Count | Issues |
|---|---|---|
| ✅ **Fixed** | 9 | C-001, C-002, C-003 (Turnstile env typo); S-001 (health endpoint); S-003 (invite rate limit); S-NEW-1 (anon SECURITY DEFINER); S-NEW-2 (notifications WITH CHECK true); S-NEW-3 (3× mutable search_path); S-NEW-4 (org-logos listing) |
| 🟡 **Partially fixed** | 3 | S-002 (rate limit done, Turnstile deferred); S-006 (widget mounted, pending `TURNSTILE_SECRET_KEY` env-var rollout on Vercel); F-002 (helper + 4 call sites wired; subscription/role/OAuth events deferred) |
| 🔻 **Severity reduced** | 1 | S-017 (no longer leaks DB info — rate-limit only) |
| ⏸️ **Blocked** | 1 | S-NEW-5 (leaked-password protection — requires Supabase Pro plan) |
| ⏭️ **Open** | ~102 | Everything else (see tables below) |

**All four Supabase advisor `WARN` lints we could action are clear** on staging. Two warnings remain: `0029_authenticated_security_definer_function_executable` (intentional — RLS policies need it) and `auth_leaked_password_protection` (S-NEW-5, plan-blocked).

## Top 10 Most Critical (fix first)

1. ~~**C-1 / C-2 / C-3**~~ — **Fixed 2026-05-23** locally: typo `NEXT_PUBLIC_TURNSTILE_SITE__KEY` corrected in `.env.local`; verified site key now inlined in `/auth/login` and `/auth/sign-up` page chunks. **Vercel still needs verification** — confirm both staging and production projects use the single-underscore name `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
2. ~~**S-NEW-1**~~ — **Fixed 2026-05-23** via `scripts/026_revoke_anon_and_fix_search_path.sql` on both staging and production. Verified via `get_advisors` (lint `0028` no longer reported on staging).
3. ~~**S-2.1**~~ — **Fixed 2026-05-23** — `app/api/health/route.ts` simplified to liveness-only (`{status:"ok"}`); admin client removed, no DB info disclosed. See S-001.
4. ~~**S-11.4 / S-15.4**~~ — **Fixed 2026-05-23** (rate limit only; captcha deferred). `app/auth/forgot-password/page.tsx` now goes through server action `requestPasswordReset()` in `lib/actions/auth.ts` with 5/IP/hour + 5/email/hour caps and a generic response that closes the enumeration leak. Turnstile mounting deferred per session light-limits policy — re-open S-002 sub-item if needed.
5. ~~**S-11.3**~~ — **Fixed 2026-05-23** — `inviteTeamMember` now enforces a per-user cap of 25 invites/hour via a DB-backed count on `team_invitations.invited_by`. See S-003.
6. ~~**S-15.2**~~ — **Fixed 2026-05-23** (pending env-var rollout) — Turnstile widget mounted on `components/apply/apply-form.tsx` (invisible mode, same pattern as login/sign-up); server-side verification in `lib/actions/public-apply.ts` via new `lib/turnstile.ts` helper. Activates once `TURNSTILE_SECRET_KEY` env var is set on Vercel (both projects). Fail-open until then.
7. ~~**F-2**~~ — **Partially fixed 2026-05-23** — discovered the `activity_log` table already existed (created in `001_create_schema.sql`) with the right shape but was never written to. Added `lib/audit-log.ts` helper (best-effort, never throws) and wired 4 call sites: vacancy status changes, application status changes, LinkedIn connect, LinkedIn disconnect. Deferred: subscription events (no billing yet), role changes (no role-update action), Google/Zoom/Microsoft OAuth connects.
8. **F-1 / M-2 / M-3** — Several critical email / notification sends fail silently with empty catch blocks (rejection emails, interview emails, org notifications).
9. **C-trial-member-limit** — Code creates trial with `member_limit = 2` but docs/types previously said 3. Behaviour is consistent in code (now reflected in docs).
10. **S-rate-limit-inmemory** — `app/api/parse-cv/route.ts` uses an in-memory rate-limit map that resets on every cold start; ineffective in serverless.

---

## 🔒 Security Issues

| # | Severity | File:Line | Description | Suggested Fix | Status |
|---|----------|-----------|-------------|---------------|--------|
| S-001 | Critical | `app/api/health/route.ts:6-11` | Health endpoint uses admin client without auth; returns DB connectivity. Probes infra. | Drop to anon client and return only `{ok}`; or require an auth token. | **Fixed 2026-05-23** — endpoint rewritten as liveness-only (`{status:"ok"}`, 200). Removed admin client, DB ping, `checks`, and `timestamp`. Reasoning: anon client cannot read any table after S-NEW-1 fix (every public table's RLS requires `auth.uid()` or `get_user_org_id()` which anon no longer has EXECUTE on), so a liveness probe is the only safe public shape. DB-aware monitoring belongs in a separate authenticated endpoint when needed. |
| S-002 | Critical | `app/auth/forgot-password/page.tsx` | No rate limit on password-reset request → email enumeration + DoS. | Add per-email + per-IP rate limit (e.g. 3/email/hour) + Turnstile. | **Partially fixed 2026-05-23** — rate limits in place (5/IP + 5/email per hour, lighter than audit's 3/email/hour per session policy), generic success response added to close enumeration leak. New server action: `lib/actions/auth.ts:requestPasswordReset`. **Turnstile mounting deferred** — re-open if email volume warrants captcha. |
| S-003 | Critical | `lib/actions/invitations.ts` | No rate limit on `inviteTeamMember`; an authenticated user can spam invites. | Add per-user cap (e.g. 10 invites/hour). | **Fixed 2026-05-23** — added `MAX_INVITES_PER_USER_PER_HOUR = 25` (lighter than audit's 10/hour per session-wide light-limits policy). Enforced via DB-backed count on `team_invitations.invited_by` over the last hour, placed after duplicate-invite check so typos don't penalise the user. |
| ~~S-004~~ | ~~Critical~~ | n/a | **RETRACTED 2026-05-08** after live-DB verification. RLS is enabled on every public table with ≥1 policy (`vacancies`, `candidates`, `applications` have 4 each; `profiles` has 6). The architecture agent only saw RLS in the migration files currently checked into `supabase/migrations/`. Earlier RLS migrations are not in the repo but are live in the DB. | n/a | Won't Fix (false positive) |
| S-005 | High | `app/api/parse-cv/route.ts:9-35` | In-memory rate-limiter map resets on cold start → ineffective on serverless. | Move to Upstash Redis or Vercel KV. | Open |
| S-006 | High | `lib/actions/public-apply.ts` (form) | Public apply form has no captcha despite Turnstile being available. | Mount Turnstile on `components/apply/apply-form.tsx`. | **Fixed 2026-05-23 (pending env-var rollout)** — Turnstile widget mounted (invisible mode). Submit disabled until token resolves. Server-side verification in `submitPublicApplication` via new `lib/turnstile.ts` calls Cloudflare's `siteverify` endpoint using `TURNSTILE_SECRET_KEY`. Fail-open while the secret is unconfigured (warning logged); activates on both projects once env var is set in Vercel. |
| S-007 | High | `sentry.server.config.ts` / `sentry.client.config.ts` | No `beforeSend` PII filter — candidate names, emails, application bodies can leak to Sentry. | Add `beforeSend` that scrubs `email`, `candidate*`, `application*`, `note*` fields. | Open |
| S-008 | High | `app/auth/forgot-password/page.tsx` | Implicit OAuth flow used here intentionally (CLAUDE.md) but no inline comment in the file explains why. Risk: a future refactor switches to PKCE and breaks cross-browser reset. | Add a `// flowType: 'implicit' is required for server-side OTP verification — see CLAUDE.md` comment. | Open |
| S-009 | Medium | `app/api/cron/expire-vacancies/route.ts` | If `CRON_SECRET` env is unset, timing-safe compare returns false silently — all calls 401. Hard to debug. | Log a warning at startup if `CRON_SECRET` is unset; or treat missing secret as a build error. | Open |
| S-010 | Medium | `lib/actions/public-apply.ts:43` | Uses admin client on a public endpoint. Justified (anonymous applicants) but lacks an inline rationale. | Add a comment + assert `application_form_token` is valid before any write. | Open |
| S-011 | Medium | `lib/actions/public-apply.ts:40-80` | `experience_json` / `education_json` parsed without a Zod schema; only `JSON.parse` + light filtering. Malformed data can be persisted. | Use `ExperienceEntrySchema` / `EducationEntrySchema` from `lib/validations/candidate-background.ts`. | Open |
| S-012 | Medium | OAuth callbacks (Google / MS / Zoom) | State cookie comparison + relative-redirect check are good, but cookies don't all explicitly set `Path=/`. | Audit each `cookies.set(...)` for explicit `path`, `secure`, `httpOnly`, `sameSite=strict`. | Open |
| S-013 | Medium | All OAuth disconnect endpoints | No CSRF token; rely on SameSite=Lax cookies + Next.js origin check. Document the assumption. | Add a doc note or migrate to server actions. | Open |
| S-014 | Medium | `next.config.mjs` CSP | Allows `'unsafe-inline'` and `'unsafe-eval'` in `script-src` (required by Next.js current shipping mode). | Investigate nonces / strict-dynamic; track as a hardening task. | Open |
| S-015 | Medium | Supabase storage `candidate-documents` bucket | RLS policies are not in source — only Supabase dashboard. Risk of drift. | Capture bucket policies in `supabase/migrations` or a documented SQL snapshot. | Open |
| S-016 | Low | `lib/actions/email-templates.ts` | User-supplied email body is stored as-is (no HTML sanitisation). Resend renders verbatim; XSS risk is on the email client side. | Document assumption; consider DOMPurify-style stripping if HTML allowed. | Open |
| S-017 | Low | Health endpoint | Public, no rate limit → minor info-disclosure / fingerprinting. | Add per-IP rate limit. | **Reduced 2026-05-23** — endpoint now returns only `{status:"ok"}` (see S-001), so info-disclosure/fingerprinting surface is gone. Rate-limit value is only DoS-mitigation now; can be deferred until edge rate limiting is added repo-wide. |
| S-018 | Low | OAuth state cookie `maxAge` | 600s on Google route; verify Microsoft/Zoom routes also use ≤ 600s. | Audit + align. | Open |
| S-019 | Low | `lib/cv-parser.ts` | API key read directly via `process.env.GOOGLE_GEMINI_API_KEY` — missing key returns `parse_failed` silently. Hard to debug. | Promote to `lib/env.ts`; throw at boot if feature flag enabled but key missing. | Open |

---

### Live-Advisor Findings (added 2026-05-08 via `mcp__supabase-staging__get_advisors`)

| # | Severity | File / Object | Description | Suggested Fix | Status |
|---|----------|---------------|-------------|---------------|--------|
| S-NEW-1 | High | Function `public.get_user_org_id()` | `SECURITY DEFINER` function executable by `anon` (and `authenticated`) over `/rest/v1/rpc/get_user_org_id`. Any unauthenticated caller can invoke a function that bypasses RLS. | Revoke `EXECUTE FROM anon`; consider switching to `SECURITY INVOKER`. [Advisor doc](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) | **Fixed 2026-05-23** — `scripts/026_revoke_anon_and_fix_search_path.sql` applied to staging + production. Kept `SECURITY DEFINER` (required to break recursive `profiles` RLS lookup, see `scripts/004_fix_rls_helper.sql`); revoked from `PUBLIC` + `anon`, explicit grants to `authenticated` + `service_role`. Verified gone via `get_advisors`. |
| S-NEW-2 | Medium | RLS policy `notifications.Service role insert notifications` | INSERT policy uses `WITH CHECK (true)` — effectively unconditional. | Replace with a check on `organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())` or restrict to service role explicitly. [Advisor doc](https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy) | **Fixed 2026-05-23** — `scripts/028_drop_unused_notifications_insert_policy.sql` applied to staging + production. Policy dropped entirely (was unused — only `createOrgNotifications()` inserts, and it uses service role which bypasses RLS). With RLS enabled + no INSERT policy, default-deny applies for anon/authenticated. Verified gone via `get_advisors`. |
| S-NEW-3 | Medium | Functions `sync_candidate_status_on_application_change`, `close_expired_vacancies`, `sync_candidate_hired_status` | All three have mutable `search_path` — opens a search-path hijacking surface. | Add `SET search_path = pg_catalog, public` to each function definition. [Advisor doc](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) | **Fixed 2026-05-23** — `scripts/026_revoke_anon_and_fix_search_path.sql` applied to staging + production. Pins `search_path = pg_catalog, public` on all three via `ALTER FUNCTION` (bodies untouched). Verified gone via `get_advisors`. |
| S-NEW-4 | Medium | Storage bucket `org-logos` | Bucket is public **and** has a broad `SELECT` policy on `storage.objects` that allows clients to *list* every file in the bucket (not just access individual URLs). | Drop the listing policy; public access by direct URL still works. [Advisor doc](https://supabase.com/docs/guides/database/database-linter?lint=0025_public_bucket_allows_listing) | **Fixed 2026-05-23** — `scripts/027_drop_org_logos_listing_policy.sql` applied to staging + production. Dropped policy `"Public read org logos"` on `storage.objects`. Direct-URL image access continues to work via the public bucket endpoint (`/storage/v1/object/public/...`). Verified gone via `get_advisors`. |
| S-NEW-5 | Low | Supabase Auth setting | Leaked-password protection (HaveIBeenPwned check) is disabled. | Enable in Dashboard → Authentication → Sign In / Providers → Email. [Advisor doc](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) | **Blocked 2026-05-23 — Pro plan required.** Confirmed via staging dashboard: the leaked-password toggle is a paid feature. Revisit after upgrading to Supabase Pro on both projects. |

---

## 🐛 Code Bugs & Incorrect Logic

| # | Severity | File:Line | Description | Suggested Fix | Status |
|---|----------|-----------|-------------|---------------|--------|
| B-001 | High | `lib/actions/interviews.ts:43` | `scheduledDate < new Date()` creates a fresh `Date()` mid-comparison; subtle race at boundaries. | Cache `const now = new Date()` once and reuse. | Open |
| B-002 | High | `lib/actions/invitations.ts:135` | Same pattern — `new Date(invite.expires_at) < new Date()` may allow boundary expiries. | Cache `now` and use `<=`. | Open |
| B-003 | Medium | `lib/actions/vacancies.ts:124` | Duration calculated via `Math.round((end-start) / 86_400_000)` may be off by one day across DST or near midnight. | Use `differenceInCalendarDays` from `date-fns`. | Open |
| B-004 | Medium | `lib/actions/public-apply.ts:156` | `.eq('general_status_id', activeStatus?.id ?? '')` falls back to empty string → silently returns no rows. | Guard with `if (!activeStatus) return …`. | Open |
| B-005 | Low | `components/dashboard/notifications-bell.tsx:51` | Async `onClick` handler without `.catch` — silently swallows mark-as-read failures. | Add `.catch(err => toast.error(...))`. | Open |
| B-006 | Low | `components/vacancies/linkedin-post-job-button.tsx:53` | `navigator.clipboard.writeText` without try/catch — fails on denied permissions / non-HTTPS. | Wrap in try/catch + manual-copy fallback. | Open |

---

## ❌ Missing or Incomplete Code

| # | Severity | File:Line | Description | Suggested Fix | Status |
|---|----------|-----------|-------------|---------------|--------|
| M-001 | High | `lib/actions/notifications.ts:73` | `if (error) console.error(...)` — caller never learns about failure. | Return `{success:false}` so caller can decide; or queue to dead-letter. | Open |
| M-002 | High | `lib/actions/interviews.ts:313` | `} catch { /* Non-fatal */ }` swallows notification errors entirely. | At minimum `console.error('[interviews] ...', err)`; better, capture in Sentry. | Open |
| M-003 | High | `lib/actions/applications.ts:341` | Rejection email failures caught silently. | Log + capture in Sentry. | Open |
| M-004 | Medium | `lib/actions/public-apply.ts:250, 274` | Experience / education JSON parse failures discarded silently → data quality blind spot. | `console.warn('[public-apply] experience parse failed', err)`. | Open |
| M-005 | Medium | `lib/supabase/server.ts:21` | Cookie-set failure swallowed (intentional for Server Component contexts) but masks real middleware bugs. | Log in dev only. | Open |
| M-006 | Medium | `components/apply/apply-form.tsx:70` | CV parse failure shows a single generic message; user can't tell network vs invalid PDF. | Differentiate `TypeError` (network) vs schema (file). | Open |
| M-007 | Low | `lib/guides/loader.ts:26, 48` | Two catches return `null` with no log context. | Log the slug + error message. | Open |

---

## ➕ Missing Features or Fields

| # | Severity | File:Line | Description | Suggested Fix | Status |
|---|----------|-----------|-------------|---------------|--------|
| F-001 | High | `lib/actions/notifications.ts:53-78` | No notification triggers for: interview scheduled, candidate stage change, application submitted (to admins), team invite sent, password reset success. | Add `createOrgNotifications` calls in respective server actions. | Open |
| F-002 | High | `supabase/migrations/*` | No audit-log infrastructure for compliance-relevant events (subscription, roles, vacancy publish, candidate stage, integration connect/disconnect). | Create `audit_log` table with `org_id`, `user_id`, `entity_type`, `entity_id`, `action`, `before_value`, `after_value`. | **Partially fixed 2026-05-23** — re-scoped: `public.activity_log` already exists in DB (created by `scripts/001_create_schema.sql`, missing from `supabase/migrations/`). Schema uses `details jsonb` instead of `before_value`/`after_value` (we encode them as `{before, after}` inside details). Added `lib/audit-log.ts` helper writing via admin client (best-effort, never throws). Wired sites: `updateVacancyStatus`, `updateApplicationStatus`, LinkedIn save/disconnect. **Deferred:** subscription events (no billing webhook today), role-change events (no role-update action exists), Google/Zoom/Microsoft OAuth connect events. |
| F-003 | High | `lib/actions/integrations.ts` | Only read action; no `disconnectLinkedInIntegration()` server action exists despite the HTTP route. | Add server-action wrapper for parity. | Open |
| F-004 | Medium | `app/(dashboard)/subscription/page.tsx` | No "Cancel subscription" UI / action. Pricing UI present but no payment provider wired. | Wait for LemonSqueezy integration; design cancel flow with confirm dialog. | Open |
| F-005 | Medium | `app/(dashboard)/vacancies/[id]/page.tsx` | `deleteVacancy()` action exists but no UI button surfaces it. | Add delete button + `AlertDialog` confirm. | Open |
| F-006 | Medium | `app/(dashboard)/candidates/[id]/page.tsx` | Same — no UI for `deleteCandidate()`. | Add delete button + confirm. | Open |
| F-007 | Medium | `lib/validations/vacancy.ts` | No refinement preventing `end_date < start_date` or `end_date` in the past. | Add `.refine()`. | Open |
| F-008 | Medium | `lib/validations/application.ts` | No `.email()` refinement on candidate email field. | Add it. | Open |
| F-009 | Medium | `app/(dashboard)/candidates/page.tsx`, `vacancies/page.tsx` | No keyset / offset pagination — uses limit only. Will scale poorly past a few hundred rows. | Add cursor pagination + total count. | Open |
| F-010 | Medium | `app/(dashboard)/candidates/page.tsx:189-216` | Sorting by status pulls all candidates into memory. | Move sort to DB; add `ORDER BY status, ...`. | Open |
| F-011 | Low | `lib/actions/candidates.ts:124-139` | Soft-delete with no `restored_at` field → can't audit restore actions. | Add `restored_at`, `restored_by`. | Open |
| F-012 | Low | `components/settings/team-invitations.tsx:69-80` | Revoke invitation has no confirmation dialog. | Wrap in `AlertDialog`. | Open |

---

## 🗑️ Unnecessary or Redundant Code

| # | Severity | File:Line | Description | Suggested Fix | Status |
|---|----------|-----------|-------------|---------------|--------|
| U-001 | High | `app/(dashboard)/candidates/page.tsx:187-188` | `eslint-disable-next-line @typescript-eslint/no-explicit-any` + `as any` cast on Supabase query builder. | Use the proper return type from `@supabase/supabase-js`. | Open |
| U-002 | High | `app/(dashboard)/vacancies/page.tsx:198-199` | Same pattern as U-001. | Same fix. | Open |
| U-003 | Medium | `components/vacancies/vacancy-form.tsx:79,141,143,156,157,217` | Multiple `as any` casts for `responsibilities`, `show_on_public_page`, action results. | Extend `VacancyFormData` type and action return types. | Open |
| U-004 | Medium | `app/(dashboard)/candidates/new/page.tsx` | `vacancies as any`, `candidateStatuses as any` passed to client component. | Fix prop types. | Open |
| U-005 | Medium | `app/(dashboard)/settings/team/page.tsx:45-46` | `pendingInvitations as any`, `teamMembers as any` casts. | Fix prop types. | Open |
| U-006 | Medium | `lib/actions/notifications.ts:73,75` | `console.error` calls in production code. | Replace with Sentry capture in production paths. | Open |
| U-007 | Medium | `lib/actions/interviews.ts:87` | `console.error('[interviews] reschedule email send failed:', err)` in production. | Same — Sentry. | Open |
| U-008 | Low | `lib/env.ts` | `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` validated but never read by any code. | Either implement OAuth or remove from env validation. | Open |

---

## ⚡ Performance Issues

| # | Severity | File:Line | Description | Suggested Fix | Status |
|---|----------|-----------|-------------|---------------|--------|
| P-001 | High | `lib/actions/applications.ts:63-69, 247-253` | N+1 pattern when updating multiple application statuses (separate fetch for hiredApps then candidate per row). | Join applications → statuses → candidates in a single query. | Open |
| P-002 | Medium | `lib/actions/vacancies.ts:119-129` | `new Date(...).getTime()` invoked twice per call. | Cache parsed dates. | Open |
| P-003 | Medium | `lib/actions/candidates.ts:158` | Hardcoded `.limit(20)` without cursor or total count → users can't paginate. | Add proper pagination. | Open |
| P-004 | Medium | `lib/actions/interviews.ts:64-68,143-148,217-222` | `Promise.all` rejects whole batch on one failure. | Use `Promise.allSettled` where partial success is acceptable. | Open |
| P-005 | Medium | `lib/cache/lookups.ts` | Cache keys not scoped per-org. Currently safe because the cached tables are global lookups, but future per-org caches must avoid the same pattern. | Add `orgId` to keys whenever the table is tenant-scoped. | Open |
| P-006 | Low | `lib/actions/public-apply.ts:231-276` | `JSON.parse` in hot path without prior schema check. | Zod-parse before `JSON.parse`. | Open |

---

## 🏗️ Architecture & Code Quality

| # | Severity | File:Line | Description | Suggested Fix | Status |
|---|----------|-----------|-------------|---------------|--------|
| A-001 | Medium | Multiple `*/page.tsx` | Row types (`SectorRow`, `VacancyRow`, etc.) duplicated across files. | Centralise in `lib/types/database.ts`. | Open |
| A-002 | Medium | `app/(dashboard)/candidates/page.tsx`, `vacancies/page.tsx` | Filter/sort business logic inside page components. | Extract to `lib/actions/*-list.ts`. | Open |
| A-003 | Medium | `lib/actions/applications.ts:71-75` | Type guard for `application_statuses` handles both array & single object — relation shape inconsistency. | Use a type predicate; document the Supabase relation return shape. | Open |
| A-004 | Medium | `lib/validations/candidate-background.ts` | Possible overlap with `lib/validations/candidate.ts`. | Audit and de-duplicate. | Open |
| A-005 | Low | `components/vacancies/vacancy-form.tsx` | ~40 KB, ~500+ lines. Mixed form state, validation, custom fields, layout. | Split into smaller modules. | Open |
| A-006 | Low | Codebase-wide | Magic status strings (`'hired'`, `'active'`, etc.) sprinkled across files. | Define enums in `lib/types/constants.ts`. | Open |
| A-007 | Low | `tsconfig.json` | `strict: true` but no `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes`. | Tighten incrementally. | Open |

---

## 💼 Business Logic Improvements

| # | Severity | File:Line | Description | Suggested Fix | Status |
|---|----------|-----------|-------------|---------------|--------|
| BL-001 | High | `lib/actions/public-apply.ts (filter)` | When vacancy filter returns 0 candidates, query uses fake UUID to force empty result. Works but is opaque. | Add explicit empty-result branch. | Open |
| BL-002 | High | `lib/actions/applications.ts:146-148` | 5-active-applications cap rejects silently with generic error. | Surface "Reach Hired or remove an active application to add a new one" + link to subscription. | Open |
| BL-003 | Medium | `lib/actions/invitations.ts:22,102` | Repeated `ctx.role !== 'owner' && ctx.role !== 'admin'` inline checks. | `isOrgAdmin(role)` helper. | Open |
| BL-004 | Medium | `lib/actions/candidates.ts:15-16`, `vacancies.ts:11-12` | Plan-limit error returned as string but UI has no upgrade CTA. | Return error code `PLAN_LIMIT` + link to `/subscription`. | Open |
| BL-005 | Medium | `lib/validations/interview.ts:17-19` | `duration_minutes` has no max — 999 999 min is accepted. | `.max(1440)` (24 h). | Open |
| BL-006 | Medium | `app/(dashboard)/vacancies/[id]/page.tsx` | No skeleton / empty state for "0 applications". | Add `Skeleton` + empty message. | Open |
| BL-007 | Medium | `lib/actions/applications.ts:62-65` | Soft-deleting candidate cascades to applications implicitly. | Document; warn user if active applications exist. | Open |
| BL-008 | Medium | `lib/actions/interviews.ts:200+` | Interview created OK but email fails silently. | Return `{success:true, warning:'email_failed'}` and show toast. | Open |
| BL-009 | Medium | `BL-microsoft-redirect` — Microsoft OAuth redirects to `/settings/integrations?microsoft=*` while Google/Zoom redirect to `/settings?*=*`. | Inconsistent UX; one of the two paths is dead. | Pick a target path and unify. | Open |
| BL-010 | Medium | `BL-zoom-cleanup` — `lib/zoom/meetings.ts` | Cancelling an interview leaves the Zoom meeting alive (Google does delete the event). | Add `deleteZoomMeeting()` on interview cancel. | Open |
| BL-011 | Low | `components/settings/team-invitations.tsx:69-80` | Revoke is silent on success; no toast, no optimistic UI. | Add `toast.success`, disable button while pending. | Open |
| BL-012 | Low | `lib/actions/vacancies.ts:102-209` | If original has null `end_date`, duplicate also gets null — user may not notice. | Default to "+90 days" or surface a warning. | Open |
| BL-013 | Low | `components/settings/linkedin-connect.tsx` | Disconnect has no confirmation. | Add confirm dialog. | Open |
| BL-014 | Low | `BL-text-consistency` — UI capitalisation `"Thanks for Applying!"` vs `"You've Applied!"` | Inconsistent tone / case across two near-identical screens. | Align wording. | Open |

---

## ⚠️ Configuration & Environment Issues

| # | Severity | File:Line | Description | Suggested Fix | Status |
|---|----------|-----------|-------------|---------------|--------|
| C-001 | Critical | `.env.local:13` | `NEXT_PUBLIC_TURNSTILE_SITE__KEY` — typo (double underscore). | Rename to `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. | **Fixed 2026-05-23** — renamed in `.env.local`; also removed dead `NEXT_PUBLIC_TURNSTILE_SECRET_KEY` line (unused in code; secret lives in Supabase CAPTCHA dashboard). Vercel env-var name still requires manual verification on staging + production. |
| C-002 | Critical | `components/auth/sign-up-form.tsx:291` | Code reads `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (single underscore) → resolves to `undefined`. | Once C-001 is fixed this resolves. | **Fixed 2026-05-23** — resolved by C-001. Verified site key is now inlined in `/auth/sign-up` page chunk by Turbopack at compile time. |
| C-003 | Critical | `app/auth/login/page.tsx:226` | Same env var mismatch as C-002 — captcha widget never receives its site key. | Same fix. | **Fixed 2026-05-23** — resolved by C-001. Verified site key is now inlined in `/auth/login` page chunk by Turbopack at compile time. |
| C-004 | High | `app/layout.tsx:17,39,61` | Hardcoded `https://hrhandle.com` in metadata — staging will publish prod URLs in og:url etc. | Use `process.env.NEXT_PUBLIC_SITE_URL`. | Open |
| C-005 | High | `app/page.tsx:23,33,39,62` | Same hardcoded prod URL in landing-page metadata. | Same fix. | Open |
| C-006 | High | `lib/google/calendar.ts:4-5,17` | Hardcoded `accounts.google.com` and Google API URLs. Acceptable but not configurable. | Extract to constants. | Open |
| C-007 | High | `lib/types/subscription.ts:56-107` | Hardcoded plan limits (`5/500/1000`, `100/10000/20000`, `2/3/50`). | Move to env / config table once billing is wired. | Open |
| C-008 | High | `lib/campaign.ts:11-19` | Hardcoded "Spring Offer" campaign with dates and discount %. | Move to env / DB once billing exists. | Open |
| C-009 | High | `components/candidates/add-application-dialog.tsx:47` | Hardcoded `activeApplicationCount >= 5` parallel to `lib/actions/applications.ts:147`. | Single source of truth: import constant. | Open |
| C-010 | Medium | `.env.example` | Missing: `GOOGLE_GEMINI_API_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `LINKEDIN_CLIENT_ID/SECRET`, `ZOOM_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET`. | Add all with placeholder values. | Open |
| C-011 | Medium | `lib/env.ts` | Does **not** validate `GOOGLE_GEMINI_API_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`. Tracked as `C-env-validation-gaps`. | Add to env schema. | Open |
| C-012 | Medium | `tsconfig.json:11` | `strict: true` but no `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes`. | Enable both. | Open |
| C-013 | Medium | `eslint.config.mjs:23-30` | No `eslint-plugin-jsx-a11y`. | Add it. | Open |
| C-014 | Medium | `components/auth/sign-up-form.tsx:64` | Hardcoded `/auth/callback` path appended to `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`. | Either expect full URL or extract constant. | Open |
| C-015 | Medium | `next.config.mjs` CSP | `'unsafe-inline' 'unsafe-eval'` in `script-src`. | Plan a nonce-based hardening pass. | Open |
| C-016 | Low | `components/guide/mdx-components.tsx` | Possible hardcoded external URLs. | Audit. | Open |

---

## ♿ Accessibility Issues

| # | Severity | File:Line | Description | Suggested Fix | Status |
|---|----------|-----------|-------------|---------------|--------|
| AC-001 | High | `components/landing/pricing-section.tsx:42-71` | Billing toggle buttons (Monthly / Annual) lack `aria-label` and `aria-pressed`. | Add ARIA + use radix `ToggleGroup`. | Open |
| AC-002 | High | `components/landing/pricing-section.tsx` | Selected billing state not announced to screen readers. | `aria-pressed="true/false"`. | Open |
| AC-003 | Medium | `components/candidates/contact-card.tsx:22-33` | Copy button has no live-region announcement on copy. | Add `aria-live="polite"` status. | Open |
| AC-004 | Medium | `components/candidates/candidate-status-select.tsx:72` | Trigger button label only conveyed visually. | Add `aria-label`. | Open |
| AC-005 | Medium | `components/dashboard/sidebar.tsx:59-65` | Mobile hamburger toggle is icon-only. | `aria-label="Toggle navigation"`. | Open |
| AC-006 | Medium | `app/auth/login/page.tsx:199-210` | Custom-styled "Remember me" checkbox — verify visible focus ring. | Add `:focus-visible` ring or use radix Checkbox. | Open |
| AC-007 | Medium | `app/page.tsx:142-155` | Stats section uses bare `<div>`s; no semantic heading. | Use `<dl>/<dt>/<dd>` or `<h3>` + caption. | Open |
| AC-008 | Low | `components/landing/pricing-section.tsx:26-36` | Campaign icon with no accessible name. | `aria-label="Promotion"`. | Open |
| AC-009 | Low | `app/page.tsx:76-81,283-287` | Decorative `<Briefcase>` icons lack `aria-hidden`. | Add `aria-hidden="true"`. | Open |
| AC-010 | Low | `components/auth/sign-up-form.tsx:16-35` | OAuth icons OK (aria-hidden), but verify button text remains visible. | Spot-check. | Open |
| AC-011 | Low | `app/(dashboard)/layout.tsx` | No skip-to-content link. | Add `<a href="#main" className="sr-only">…</a>`. | Open |
| AC-012 | Low | `components/candidates/candidate-status-select.tsx:29-36` | Status colour conveys meaning — verify text + contrast. | Test against WCAG AA. | Open |

---

## Notes on Methodology

- 10 parallel research agents inspected the codebase from product, business, architecture, integrations, API, UI text, security, bug, quality, and config/a11y angles.
- Issues are deduplicated and re-graded for severity.
- Verification of live Supabase schema state was **not** performed for this pass — the keys in `.env.local` are the new Supabase publishable/secret format and return 401 against the REST API from the local environment. All DB facts in this audit are taken from `supabase/migrations/`.
- "Status" is `Open` for every issue. Update inline when fixed (`Open → In Progress → Fixed`).
