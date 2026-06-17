# Backend Architecture

_Last updated: 2026-05-08_

## Changelog

- 🆕 `lib/actions/candidate-background.ts` — CRUD for candidate work experience and education (8 exported functions)
- 🆕 `lib/actions/integrations.ts` — `getLinkedInIntegration()` reader for the new `organization_integrations` table
- 🆕 `lib/cv-parser.ts` — Google Gemini-backed CV parser (PDF/DOCX → structured JSON)
- 🆕 `app/api/parse-cv/route.ts` — public, IP rate-limited CV-parsing endpoint
- 🆕 `app/api/integrations/linkedin/{save,disconnect}/route.ts` — LinkedIn company-page integration endpoints
- 🆕 `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` added to `lib/env.ts` (currently **unused** in code — see open issue `C-unused-env-vars`)
- 🔄 CSP in `next.config.mjs` now whitelists Pusher (wss://*.pusher.com) — placeholder for future realtime work
- 🔄 Cron route docs corrected: `vercel.json` **is** in source and defines `0 1 * * *` for `/api/cron/expire-vacancies` (previously said "not present in source")

---

## Framework Versions

From `package.json`:

| Package | Version |
|---|---|
| next | ^16.2.0 |
| react | ^19.2.5 |
| react-dom | ^19.2.5 |
| typescript | ^5.7.3 |
| @supabase/supabase-js | ^2.104.0 |
| @supabase/ssr | ^0.10.2 |
| zod | ^3.24.1 |
| @sentry/nextjs | ^10.49.0 |
| resend | ^6.12.2 |
| date-fns | 4.1.0 |
| vitest | ^4.1.5 |

## Server Actions Pattern

All server actions live under `lib/actions/`. Every file starts with `'use server'`.

### Shared Auth Context (`lib/actions/index.ts`)

All actions call `getAuthContext()` as their first step. It:
1. Creates a server Supabase client
2. Calls `supabase.auth.getUser()` — verifies JWT against Supabase
3. Fetches `profiles` row to get `organization_id` and `role`
4. Returns `{ supabase, userId, orgId, role }` or `null` if unauthenticated

`checkPlanLimit(ctx, resource)` is also exported. It reads the org's `subscriptions` row and counts active records against the `vacancy_limit`, `candidate_limit`, or `member_limit`. Returns an error string if at/above limit, `null` if allowed.

### Return Type

```ts
type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: ActionErrorCode }
```

Error codes: `NOT_AUTHENTICATED`, `PLAN_LIMIT`, `VALIDATION`, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, `STORAGE`, `DB_ERROR`, `EXTERNAL_SERVICE`.

### Action Files

| File | Exported functions |
|---|---|
| `lib/actions/index.ts` | `getAuthContext`, `checkPlanLimit` |
| `lib/actions/auth.ts` | `requestPasswordReset` (rate-limited password-reset trigger; preserves implicit flow) |
| `lib/audit-log.ts` (helper, not a `'use server'` action) | `writeAuditLog` — best-effort insert into `activity_log` via admin client. Called from `updateVacancyStatus`, `updateApplicationStatus`, LinkedIn save/disconnect routes. See [docs/2-business/processes.md](../2-business/processes.md) "Audit Log". |
| `lib/actions/candidates.ts` | `createCandidate`, `updateCandidate`, `updateCandidateStatus`, `deleteCandidate`, `searchCandidatesForVacancy` |
| `lib/actions/vacancies.ts` | `createVacancy`, `updateVacancy`, `updateVacancyStatus`, `duplicateVacancy`, `deleteVacancy` |
| `lib/actions/applications.ts` | `updateApplicationStatus`, `createApplication`, `removeApplication`, `rejectApplication` |
| `lib/actions/interviews.ts` | `createInterview`, `rescheduleInterview`, `updateInterviewStatus` |
| `lib/actions/invitations.ts` | `inviteTeamMember`, `revokeInvitation`, `acceptInvitation` |
| `lib/actions/documents.ts` | `uploadDocument`, `getDocumentSignedUrl`, `deleteDocument` |
| `lib/actions/notifications.ts` | `getNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `createOrgNotifications` |
| `lib/actions/public-apply.ts` | `submitPublicApplication` |
| `lib/actions/settings.ts` | `updateProfile`, `updateOrganization` |
| `lib/actions/custom-fields.ts` | `getCustomFieldSchema`, `getCustomFieldValues`, `createCustomFieldGroup`, `deleteCustomFieldGroup`, `createCustomField`, `addDropdownOption`, `deleteCustomField`, `saveCustomFieldValues` |
| `lib/actions/email-templates.ts` | (manages org email template records) |
| `lib/actions/rejection-reasons.ts` | (manages rejection reasons) |
| `lib/actions/rejection-templates.ts` | (manages rejection templates) |
| `lib/actions/evaluations.ts` | (manages candidate evaluations) |
| `lib/actions/notes.ts` | (manages candidate notes) |
| `lib/actions/preferences.ts` | (manages column preferences) |
| `lib/actions/application-form.ts` | (manages vacancy application form / questions) |
| 🆕 `lib/actions/candidate-background.ts` | `getCandidateExperience`, `createExperienceEntry`, `updateExperienceEntry`, `deleteExperienceEntry`, `getCandidateEducation`, `createEducationEntry`, `updateEducationEntry`, `deleteEducationEntry` — uses `ExperienceEntrySchema`/`EducationEntrySchema`, pads `YYYY-MM` → `YYYY-MM-DD` on save |
| 🆕 `lib/actions/integrations.ts` | `getLinkedInIntegration()` — reads single row from `organization_integrations` for caller's org |

## API Route Handlers (`app/api/`)

Full documentation in `docs/7-api/endpoints.md`. Route files:

| Route | Method(s) | Purpose |
|---|---|---|
| `app/api/health/route.ts` | GET | Health check |
| `app/api/onboarding/route.ts` | POST | Run onboarding (delegates to `lib/onboarding.ts`). Optional JSON body `{ fullName?, companyName? }` overrides `user_metadata` lookups. |
| `app/api/cron/expire-vacancies/route.ts` | GET | Cron: expire past vacancies (calls Supabase RPC) |
| `app/api/export/candidates/route.ts` | GET | Export candidates as CSV |
| `app/api/export/applications/route.ts` | GET | Export applications for a vacancy as CSV |
| `app/api/auth/google/route.ts` | GET | Initiate Google OAuth for Calendar |
| `app/api/auth/google/callback/route.ts` | GET | Google OAuth callback — store tokens |
| `app/api/auth/google/disconnect/route.ts` | POST | Disconnect Google Calendar |
| `app/api/auth/zoom/route.ts` | GET | Initiate Zoom OAuth |
| `app/api/auth/zoom/callback/route.ts` | GET | Zoom OAuth callback — store tokens |
| `app/api/auth/zoom/disconnect/route.ts` | POST | Disconnect Zoom |
| `app/api/auth/microsoft/route.ts` | GET | Initiate Microsoft OAuth |
| `app/api/auth/microsoft/callback/route.ts` | GET | Microsoft OAuth callback — store tokens |
| `app/api/auth/microsoft/disconnect/route.ts` | POST | Disconnect Microsoft |
| 🆕 `app/api/parse-cv/route.ts` | POST | Parse CV (PDF/DOCX) via Google Gemini — public, IP rate-limited 10/hr, region `fra1` |
| 🆕 `app/api/integrations/linkedin/save/route.ts` | POST | Save LinkedIn company page ID for org |
| 🆕 `app/api/integrations/linkedin/disconnect/route.ts` | POST | Remove LinkedIn integration row |

Auth routes (`app/auth/`):

| Route | Type | Purpose |
|---|---|---|
| `app/auth/confirm/route.ts` | GET route | Verifies `token_hash`, redirects to `next` |
| `app/auth/callback/route.ts` | GET route | Exchanges OAuth PKCE code for session |

## Auth Middleware Chain

`middleware.ts` → `lib/supabase/middleware.ts` (`updateSession`)

The middleware runs on every request matched by the config pattern (everything except static assets). It:
1. Creates a `createServerClient` using cookies from the request
2. Calls `supabase.auth.getUser()` to refresh the session
3. If the path starts with `/dashboard` and the user is not authenticated, redirects to `/auth/login`
4. Returns the response with updated session cookies

Matcher pattern excludes `_next/static`, `_next/image`, `favicon.ico`, and common image extensions.

The dashboard layout (`app/(dashboard)/layout.tsx`) performs a secondary auth check and runs onboarding if needed. When the user has no `organization_id` and no `user_metadata.company_name` (typical first-time Google/Microsoft sign-up — providers don't return a company), the layout redirects to `/onboarding/company` to collect name + company before creating the org. Email sign-up carries `company_name` in metadata from the sign-up form and skips this hop.

The middleware (`lib/supabase/middleware.ts`) auth-gates both `/dashboard/*` and `/onboarding/*` — unauthenticated hits redirect to `/auth/login`.

## Background Jobs / Cron

Two daily cron endpoints, both protected by `Authorization: Bearer {CRON_SECRET}` header (timing-safe comparison) and scheduled via `vercel.json`.

**`app/api/cron/expire-vacancies`** — GET, daily at 01:00 UTC

- Calls Supabase RPC `expire_past_vacancies()`

**`app/api/cron/purge-deleted`** — GET, daily at 03:00 UTC

- **Step 0 (G-007)**: hard-deletes whole `organizations` rows where `deleted_at < now() - interval '30 days'`. Each org delete cascades to every public.* row in the tenant (`profiles`, `candidates`, `applications`, `vacancies`, `custom_fields`, `candidate_documents`, `candidate_notes`, `interviews`, `candidate_evaluations`, `candidate_experience`, `candidate_education`) via existing FK CASCADE rules. Before the cascade, the cron collects (a) all file paths from the org's `candidate_documents` (for storage cleanup in Step 3) and (b) all member `profiles.id` values. After the cascade, calls `supabase.auth.admin.deleteUser()` per former member to remove the corresponding `auth.users` rows — `profiles.id` is a FK to `auth.users.id` so cascading the profile does NOT delete the auth row, and a member could otherwise sign in again.
- **Steps 1–2**: hard-deletes rows where `deleted_at < now() - interval '30 days'` from the remaining candidate-scoped tables (`candidates`, `applications`, `candidate_documents`, `candidate_notes`, `custom_fields`, `vacancies`) to catch in-app soft-deletes where the parent org is still active. Candidate purges cascade to their children.
- Vacancies use per-row deletes with try/catch: the RESTRICT FK from `candidate_evaluations.vacancy_id` can block individual purges; these are logged and skipped (counted as `vacancies_skipped_due_to_restrict`) rather than failing the run.
- **Step 3**: removes the corresponding files from the `candidate-documents` Supabase Storage bucket (best-effort — storage errors are logged but don't 500 the response, so a transient storage hiccup doesn't block the row purge).
- Implements the "permanently removed within 30 days" promise in Privacy Policy §7. Tracked as G-003 (in-app soft deletes) and G-007 (whole-org termination from the danger zone in `/settings/organization`).
- Returns a counts JSON for observability; same shape logged to `console.log` so Vercel logs capture each run.

## Supabase Client Types

| Client | File | Created by | Use for |
|---|---|---|---|
| Browser | `lib/supabase/client.ts` | `createBrowserClient` from `@supabase/ssr` | Client components — uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Server | `lib/supabase/server.ts` | `createServerClient` from `@supabase/ssr` | Server components, route handlers, server actions — reads/writes cookies |
| Admin | `lib/supabase/admin.ts` | `createClient` from `@supabase/supabase-js` | Privileged operations that need to bypass RLS — uses `SUPABASE_SERVICE_ROLE_KEY`, server-side only |
| Middleware | `lib/supabase/middleware.ts` | `createServerClient` from `@supabase/ssr` | Session refresh in `middleware.ts` only — reads from request cookies |

## Cache Layer

`lib/cache/lookups.ts` uses `unstable_cache` from Next.js to cache global lookup tables for 1 hour:

- `getVacancyStatuses()` — tag: `lookup-vacancy-statuses`
- `getCandidateStatuses()` — tag: `lookup-candidate-statuses`
- `getApplicationStatuses()` — tag: `lookup-application-statuses`

These use the admin client since they are server-side and the RLS does not restrict lookup tables.

## Security Headers

Set in `next.config.mjs` on all routes (`/(.*)`):

- `X-DNS-Prefetch-Control: on`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Content-Security-Policy` — restricts scripts, styles, images, fonts, connect targets

The CSP allows `unsafe-inline` and `unsafe-eval` for scripts (needed by Next.js) and whitelists Supabase WSS/HTTPS and Sentry endpoints.

## TypeScript Configuration

`next.config.mjs` sets `typescript.ignoreBuildErrors: false` — TypeScript errors fail the build.

## Recent additions (2026-06-18 redesign session)

### `lib/actions/notification-preferences.ts`

Two server actions wired into the new Personal → Notifications sub-page (per [`docs/redesign/flows/S07-settings.md`](../redesign/flows/S07-settings.md) §2.4 + Phase 0.7 in the kickoff playbook):

- `getNotificationPreferences(): Result<NotificationPreferences>` — reads the recipient's preferences via the regular Supabase server client. Falls back to `DEFAULT_NOTIFICATION_PREFERENCES` if the column is NULL or the row pre-dates Migration 045 (defensive). Returns `{ success: false, error }` on auth failure.
- `updateNotificationPreferences(prefs)` — whole-object replace so partial updates can't drift the JSONB shape over time. The client form is the canonical builder; the action just writes what it's given.

Type definitions live in `lib/types/notification-preferences.ts` alongside `EMAIL_EVENT_LABELS` / `IN_PRODUCT_LABELS` (the form copy registry) and `DEFAULT_NOTIFICATION_PREFERENCES` (the runtime default that matches Migration 045's column DEFAULT). Pinned by `lib/__tests__/notification-preferences-shape.test.ts` to catch drift between the two.

### Consumer wiring — `NotificationsBell`

`components/dashboard/notifications-bell.tsx` reads `notification_preferences.in_product` once on mount and respects:
- `show_bell_badge=false` → hides the unread count badge (bell icon stays visible — user can still open and read)
- `auto_mark_read=false` → clicking a notification opens its link but does NOT call `markNotificationRead`; user has to use "Mark all read" explicitly

Failure paths (fetch error, missing column, network) silently keep the defaults (true/true) so the bell never silently regresses.

### Deferred — email dispatcher wiring

The 6 email events in the preferences form (`new_applicant`, `interview_scheduled`, `offer_awaiting_response`, `mention`, `team_invite_update`, `weekly_digest`) are collected but not yet read by the email dispatcher. The audit found that most existing email sends in `lib/email.ts` go to candidates / invitees (external addresses), not to recruiters who would opt out. When the internal-email surface grows, the helper goes in `lib/actions/notifications.ts` near `createOrgNotifications` — filter `recipientIds` against the relevant email pref before delivery.
