# HRHandle — Business Processes & Rules

_Last updated: 2026-07-20_

## Changelog

- 🔄 **(2026-07-20 audit) Pipeline is the home surface** (`/dashboard` → `/pipeline`; redesign A-1). Onboarding still runs in the `(dashboard)` route-group layout, which now wraps `/pipeline`.
- 🆕 **(2026-07-20 audit)** Offer lifecycle (draft → sent → accepted/declined/withdrawn; accept auto-advances to Hired), 2FA enrollment + org policy, Reports, and CSV import processes shipped since 2026-05-08 — see `docs/1-product/roadmap.md` for the full G-0xx list.
- 🔄 Trial `member_limit` corrected from **3 → 2** (matches `lib/onboarding.ts:111` and `lib/types/subscription.ts`)
- 🆕 Custom fields cap documented: max 20 per entity type (`lib/actions/custom-fields.ts:202`)
- 🆕 Rejection reasons cap documented: max 50 per org (`lib/actions/rejection-reasons.ts:12`)
- 🆕 Email template length caps: subject ≤ 500 chars, body ≤ 10 000 chars
- 🆕 Interview reschedule flow (with optional candidate email notification) documented
- 🆕 LinkedIn integration (manual page-ID only) documented under Integrations section
- 🆕 Onboarding rollback semantics documented (admin client; org deleted if any downstream step fails)
- 🔄 "All other tenant tables rely on application-level filtering" — security caveat about RLS gaps surfaced (see `docs/issues-found.md` `S-rls-gaps`)

---

## Onboarding

1. First dashboard hit by a user with no `organization_id` on their profile triggers `runOnboarding(user)` directly in `app/(dashboard)/layout.tsx` (not via HTTP self-fetch).
2. If the user has a pending team invitation matching their email, they are redirected to `/join?token=…` instead of creating a new org.
3. Onboarding:
   - Creates organisation with slugified company name + user ID suffix for uniqueness.
   - Iterates `public_page_slug` until unique (adds numeric suffix).
   - Upserts profile with `role='owner'`.
   - Creates trial subscription (7 days, vacancy_limit=5, candidate_limit=100, **member_limit=2**).
   - Seeds one "General" rejection reason and one default rejection template.
   - If org insert succeeds but profile upsert fails: org is deleted (rollback).
   - If org + profile succeed but subscription fails: org is deleted (rollback).

## Subscription & Limits

### Plan Codes
- `trial` — 5 vacancies, 100 candidates, **2** members, 7 days
- `individual` — 500 vacancies, 10,000 candidates, 3 members, $20/mo ($16/mo annual)
- `organization` — 1,000 vacancies, 20,000 candidates, 50 members, $40/mo ($32/mo annual)

### Limit Enforcement
- `checkPlanLimit(ctx, 'vacancy')` counts non-archived, non-deleted vacancies.
- `checkPlanLimit(ctx, 'candidate')` counts non-deleted candidates.
- `checkPlanLimit(ctx, 'member')` counts all profiles in the org.
- Returns error string if at or above limit; null if under.
- Applied before: `createVacancy`, `duplicateVacancy`, `createCandidate`, `inviteTeamMember`.

### Expiry
- Expired = `status='expired'` OR (`status='trial'` AND `trial_end_at < now()`).
- On expiry, layout redirects to `/subscription` (except if already on that path).
- The "Upgrade Now" button is visible but not wired to a payment provider.

### Campaign Pricing
- Currently: "Spring Offer" active until 2026-06-01, 60% monthly discount, 70% annual discount.
- `isCampaignActive()` checks `CAMPAIGN.active && now < endDate`.
- `getCampaignPrice()` applies discount and rounds to 2 decimal places.

## Vacancy Lifecycle

1. **Draft** — vacancy created, not visible publicly.
2. **Open** — vacancy active. Public apply form works if `show_on_public_page=true`.
3. **On Hold** — paused, public form blocked.
4. **Closed** — manually closed, public form blocked.
5. **Archived** — soft-archived via `archived_at` timestamp; excluded from limits and most queries.
6. **Deleted** — soft-deleted via `deleted_at`; excluded from all queries.

### Auto-expiry
- Supabase RPC `expire_past_vacancies()` runs daily at 01:00 UTC via Vercel cron.
- Likely closes vacancies whose `end_date` is in the past.

### Duplication
- Start date reset to today; end date recalculated to preserve original duration.
- Status forced to Draft.
- `show_on_public_page` forced to false; `application_form_token` nulled.
- All custom field values and vacancy questions are copied.

## Application Pipeline

### Statuses (from `application_statuses` lookup table)
| Code | Meaning |
|------|---------|
| `applied` | Submitted / new |
| `screening` | Under review |
| `interview` | In interview stage |
| `offer` | Offer extended |
| `hired` | Accepted offer |
| `rejected` | Application rejected |

### Candidate Status Sync
- When application moves to `hired`: candidate's `general_status_id` is set to the Hired status.
- When application moves away from `hired` (or rejected): if no other application for this candidate is `hired`, candidate reverts to Active (only if currently Hired — does not override Archived).

### Application Limits
- A candidate can have at most **5 active applications** (in statuses: applied, screening, interview, offer) simultaneously.
- Duplicate applications to the same vacancy are blocked.
- Only `active` general-status candidates can be added to a vacancy.

## Public Application Form

### Bot / Abuse Protection
- **Honeypot** — hidden `website` field; if filled by a bot, submission silently returns success and is dropped.
- **Cloudflare Turnstile** — invisible captcha widget mounted on the form; token verified server-side via `lib/turnstile.ts` against Cloudflare's `siteverify` endpoint using `TURNSTILE_SECRET_KEY`. Fails-open with a warning if the env var is unset (rollout-friendly); rejects when configured-and-invalid.
- **Per-IP rate limit:** max 5 submissions per hour (checked against `applications.ip_address` and `created_at`).
- **Per-vacancy cap:** max 500 total applications.

### Duplicate Detection
- Match by email + `active` general status within the same org.
- If already applied to same vacancy: silently return success (no visible rejection to applicant).
- If same email but different vacancy: new application created.

### File Validation (CV)
- Allowed MIME types: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
- Max size: 10 MB.
- Magic byte check: PDF (`%PDF`), DOCX (`PK..`), DOC (OLE2 header).
- Same validation applied for internal uploads in `lib/actions/documents.ts`.

### Post-submission
1. CV uploaded to Supabase Storage bucket `candidate-documents` at path `{orgId}/{candidateId}/{uuid}.{ext}`.
2. `candidate_documents` record inserted.
3. Org owners and admins notified via `notifications` table.
4. Candidate receives confirmation email using org's `application_received` template or the default.

## Audit Log

Compliance-relevant events are written to `public.activity_log` via the best-effort `writeAuditLog()` helper in `lib/audit-log.ts`. Writes use the admin client so they bypass RLS for the writer; reads remain org-scoped via the existing SELECT policy. Audit failures are logged to stderr but never propagate to the calling action — never a reason to fail a user-facing operation.

| Event | Entity type | Action | Source |
|---|---|---|---|
| Vacancy status change | `vacancy` | `status_changed` | `lib/actions/vacancies.ts:updateVacancyStatus` |
| Application/candidate stage change | `application` | `status_changed` | `lib/actions/applications.ts:updateApplicationStatus` |
| LinkedIn integration connect | `integration` | `connected` | `app/api/integrations/linkedin/save/route.ts` |
| LinkedIn integration disconnect | `integration` | `disconnected` | `app/api/integrations/linkedin/disconnect/route.ts` |

### In-app notifications

In addition to the audit log, the following user-facing notifications fire via `createOrgNotifications` in `lib/actions/notifications.ts`:

| Event | Type | Recipients | Source |
|---|---|---|---|
| Interview scheduled | `interview_scheduled` | Creator + interviewer | `lib/actions/interviews.ts` |
| Public application submitted | `new_application` | Org owners + admins | `lib/actions/public-apply.ts` |
| Candidate hired (stage → `hired`) | `candidate_hired` | Org owners + admins (excluding actor) | `lib/actions/applications.ts` |
| Team invite sent | `team_invite_sent` | Other org owners + admins (excluding sender) | `lib/actions/invitations.ts` |

All notification writes go through `createOrgNotifications` → admin-client insert into `public.notifications` (RLS bypassed for writes; users SELECT their own). Failures are logged but never propagate to the calling action.

Deferred (tracked under F-001 in `docs/issues-found.md`): password-reset success — Supabase handles the actual reset client-side, so capturing it server-side needs either a Supabase auth webhook or wrapping `updateUser` in a new server action.

**Not yet wired** (tracked under `F-002` in `docs/issues-found.md`): subscription events (no billing webhook), role changes (no role-update server action exists), Google/Zoom/Microsoft OAuth connect events.

The `details jsonb` column carries structured context — typically `{ before, after }` for status changes and `{ platform, external_page_id }` for integrations. The `message` field carries a human-readable summary like `"draft → open"`.

## Password Reset

- Form posts through server action `requestPasswordReset()` in `lib/actions/auth.ts` (not directly to Supabase from the browser) so rate limits and a generic response can be enforced server-side.
- **Rate limit:** 5 requests per IP per hour AND 5 requests per email per hour. In-memory map, resets on cold start (sufficient for current scale; see [[migrate-to-durable-rate-limit]] if/when a hardening pass lands).
- **Response is generic** — `'If an account exists for that email, a reset link has been sent.'` — same for known and unknown emails to close the enumeration leak.
- Implicit flow is preserved by using `createBrowserClient` inside the server action with `flowType: 'implicit'` (see `CLAUDE.md` for why this matters).
- No captcha currently — deferred per session light-limits policy.

## Team Invitations

- Only `owner` and `admin` roles can invite.
- Invitation email must not already be a member of the org.
- No duplicate pending invitations for the same email.
- **Rate limit:** 25 invitations / user / hour. Enforced via DB count on `team_invitations.invited_by` (rolling 1-hour window). Exceeding the cap returns "Too many invitations sent recently. Please try again in an hour." Counted only against successfully inserted invitations — duplicate-pending and role-rejection attempts do not consume budget.
- Invitation expires in 7 days.
- If email sending fails: invitation record is deleted (rollback).
- On acceptance: user's email must match invitation email (case-insensitive).
- User cannot join a second organisation if already in one.
- `owner` cannot be changed via invitation — only `admin` or `member` roles assignable.

## Rejection Flow

1. User selects rejection reason and optionally a rejection template.
2. Can override subject/body with custom text.
3. Resolution order: custom override → stored template → built-in default.
4. Optional email sent via Resend.
5. Application status updated to `rejected`; `rejection_reason_id` and `rejection_template_id` stored.

## Email Templates

- Three template types: `application_received`, `interview_invitation`, `rejection`.
- Templates stored per organisation in `email_templates` table.
- Variables: `{{candidate_name}}`, `{{role}}`, `{{company}}`, `{{interview_date}}`, `{{interview_time}}`, `{{meeting_link}}`, `{{interviewer_name}}`.
- `applyVariables()` replaces `{{key}}` placeholders and HTML-escapes all values.
- If no custom template saved, default templates from `lib/email-template-utils.ts` are used.

## Other Per-Org Limits 🆕

| Limit | Value | Source |
|---|---|---|
| Custom fields per entity type (candidate / vacancy) | 20 | `lib/actions/custom-fields.ts:202` |
| Rejection reasons per org | 50 | `lib/actions/rejection-reasons.ts:12` |
| Active applications per candidate | 5 | `lib/actions/applications.ts:147` |
| Public-form submissions per IP / hour | 5 | `lib/actions/public-apply.ts:9` |
| Public-form submissions per vacancy (lifetime) | 500 | `lib/actions/public-apply.ts:10` |
| Email template subject length | 500 chars | `lib/actions/email-templates.ts` |
| Email template body length | 10 000 chars | `lib/actions/email-templates.ts` |
| CV / document file size | 10 MB | `lib/actions/documents.ts`, `app/api/parse-cv/route.ts` |
| CV parse calls per IP / hour | 10 | `app/api/parse-cv/route.ts` (in-memory) |

## Interview Reschedule 🆕

- Reschedule action (`lib/actions/interviews.ts`) updates `scheduled_at`, optional `meeting_link` and `duration_minutes`.
- Optionally re-sends `interview_invitation` email to the candidate (template variables re-resolved).
- Status transitions: `scheduled` ↔ `completed` ↔ `cancelled` ↔ `no_show` via `updateInterviewStatus`.

## Integrations 🆕

### LinkedIn (manual page-ID)
- Owner / admin enters a LinkedIn company-page ID or URL in **Settings → Integrations**.
- Stored in `organization_integrations` row (`platform='linkedin'`).
- Used by `linkedin-post-job-button.tsx` and `linkedin-share-button.tsx` to deep-link sharing.
- No OAuth flow exists today; `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` env vars are defined but unused.

### Google / Microsoft / Zoom
- OAuth-based, scoped to the **user** (tokens stored on `profiles`, not `organizations`).
- Interview creation chooses provider per-interview; "Manual meeting link" fallback always available.
- See `docs/4-integrations/{google,microsoft,zoom}.md`.

## Audit / Notification Gaps ⚠️

The following events do **not** currently produce notifications or audit-log entries (see `docs/issues-found.md` `F-audit-log`, `F-notifications`):

- Subscription state changes
- Role / team-member changes
- Vacancy publish / unpublish
- Candidate stage transitions
- Integration connect / disconnect

## Document Storage

- Bucket: `candidate-documents`.
- Path: `{orgId}/{candidateId}/{uuid}.{ext}`.
- Download: signed URL valid for 3600 seconds (1 hour), generated server-side.
- Soft-delete: `deleted_at` set on DB record; storage file removed immediately.
- Document types: `cv`, `other` (internal uploads).
