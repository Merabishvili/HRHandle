# HRHandle — Business Processes & Rules

## Onboarding

1. First dashboard hit by a user with no `organization_id` on their profile triggers `runOnboarding(user)` directly in `app/(dashboard)/layout.tsx` (not via HTTP self-fetch).
2. If the user has a pending team invitation matching their email, they are redirected to `/join?token=…` instead of creating a new org.
3. Onboarding:
   - Creates organisation with slugified company name + user ID suffix for uniqueness.
   - Iterates `public_page_slug` until unique (adds numeric suffix).
   - Upserts profile with `role='owner'`.
   - Creates trial subscription (7 days, vacancy_limit=5, candidate_limit=100, member_limit=3).
   - Seeds one "General" rejection reason and one default rejection template.
   - If org insert succeeds but profile upsert fails: org is deleted (rollback).
   - If org + profile succeed but subscription fails: org is deleted (rollback).

## Subscription & Limits

### Plan Codes
- `trial` — 5 vacancies, 100 candidates, 3 members, 7 days
- `individual` — 500 vacancies, 10,000 candidates, 3 members, $20/mo
- `organization` — 1,000 vacancies, 20,000 candidates, 50 members, $40/mo

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

### Rate Limiting
- Per-IP: max 5 submissions per hour (checked against `applications.ip_address` and `created_at`).
- Per-vacancy: max 500 total applications (cap on public submissions).

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

## Team Invitations

- Only `owner` and `admin` roles can invite.
- Invitation email must not already be a member of the org.
- No duplicate pending invitations for the same email.
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

## Document Storage

- Bucket: `candidate-documents`.
- Path: `{orgId}/{candidateId}/{uuid}.{ext}`.
- Download: signed URL valid for 3600 seconds (1 hour), generated server-side.
- Soft-delete: `deleted_at` set on DB record; storage file removed immediately.
- Document types: `cv`, `other` (internal uploads).
