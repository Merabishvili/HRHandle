# HRHandle — Features

## Authentication

| Feature | Description | Files |
|---------|-------------|-------|
| Email/password sign-up | Zod-validated, Turnstile captcha, minimum 8-char password | `app/auth/sign-up/page.tsx`, `components/auth/sign-up-form.tsx` |
| Email confirmation | `token_hash` flow via `/auth/confirm` (cross-browser, no PKCE) | `app/auth/confirm/route.ts` |
| Google OAuth sign-in | PKCE flow via `/auth/callback` | `app/auth/login/page.tsx`, `app/auth/callback/route.ts` |
| Microsoft OAuth sign-in | Azure provider, PKCE via `/auth/callback`, scope: `email` | `app/auth/login/page.tsx`, `app/auth/callback/route.ts` |
| Password reset | Implicit-flow client (not default PKCE) to produce plain OTP; reset link sent via Supabase | `app/auth/forgot-password/page.tsx` |
| Session persistence | "Keep me signed in" checkbox; stored in `localStorage` | `lib/session.ts`, `components/auth/session-guard.tsx` |
| Sign out | Supabase `signOut()` | `components/auth/sign-out-button.tsx` |

## Vacancies

| Feature | Description | Files |
|---------|-------------|-------|
| Create vacancy | Title, sector, status, location, employment type, salary, dates, description, responsibilities, requirements | `app/(dashboard)/vacancies/new/page.tsx`, `components/vacancies/vacancy-form.tsx`, `lib/actions/vacancies.ts` |
| Edit vacancy | Same form, supports all fields | `app/(dashboard)/vacancies/[id]/edit/page.tsx` |
| Duplicate vacancy | Copies all fields + questions + custom field values; resets dates, sets status to Draft | `lib/actions/vacancies.ts#duplicateVacancy`, `components/vacancies/duplicate-vacancy-button.tsx` |
| Delete vacancy | Soft-delete (`deleted_at` timestamp) | `lib/actions/vacancies.ts#deleteVacancy` |
| Status management | Inline status select dropdown | `components/vacancies/vacancy-status-select.tsx` |
| Vacancy list | Filterable, sortable list with status badges | `app/(dashboard)/vacancies/page.tsx`, `components/vacancies/vacancies-toolbar.tsx` |
| Vacancy detail | Info, applications list, application form tab, custom fields | `app/(dashboard)/vacancies/[id]/page.tsx` |
| Kanban pipeline | Per-vacancy Kanban board with drag-and-drop status changes | `app/(dashboard)/vacancies/[id]/pipeline/page.tsx`, `components/pipeline/kanban-board.tsx` |
| Public page toggle | `show_on_public_page` flag; generates `application_form_token` if not yet set | `lib/actions/vacancies.ts` |
| LinkedIn share | Share vacancy to LinkedIn | `components/vacancies/linkedin-share-button.tsx` |
| Vacancy questions | Add custom scoring/text questions per vacancy for evaluations | `components/vacancies/vacancy-questions.tsx` |
| CSV export | Download all applications for a vacancy as CSV | `app/api/export/applications/route.ts` |
| Auto-expiry cron | Daily cron calls `expire_past_vacancies()` Supabase RPC to close past vacancies | `app/api/cron/expire-vacancies/route.ts`, `vercel.json` |

## Candidates

| Feature | Description | Files |
|---------|-------------|-------|
| Create candidate | First name, last name, email, phone, DOB (min age 16), LinkedIn, source, company, position, years experience, status, linked vacancy | `app/(dashboard)/candidates/new/page.tsx`, `components/candidates/candidate-form.tsx`, `lib/actions/candidates.ts` |
| Edit candidate | Same form | `app/(dashboard)/candidates/[id]/edit/page.tsx` |
| Delete candidate | Soft-delete | `lib/actions/candidates.ts#deleteCandidate` |
| Candidate list | Filterable list with search, status tabs | `app/(dashboard)/candidates/page.tsx`, `components/candidates/candidates-toolbar.tsx` |
| Candidate detail | Profile info, applications, notes, documents, custom fields, evaluations | `app/(dashboard)/candidates/[id]/page.tsx` |
| Candidate notes | Add, view, delete time-stamped notes | `components/candidates/candidate-notes.tsx`, `lib/actions/notes.ts` |
| Candidate documents | Upload PDF/Word (max 10 MB), magic-byte validation, download via signed URLs | `components/candidates/candidate-documents.tsx`, `lib/actions/documents.ts` |
| General status | Owner/admin can mark candidate as Active, Hired, Archived | `components/candidates/candidate-status-select.tsx`, `components/candidates/candidate-status-actions.tsx` |
| Status sync | When application moves to Hired, candidate status syncs to Hired automatically; reverts to Active when de-hired | `lib/actions/applications.ts` |
| Candidate search | Live search when adding candidate to a vacancy; excludes already-applied | `lib/actions/candidates.ts#searchCandidatesForVacancy` |
| CSV export | Download all candidates as CSV | `app/api/export/candidates/route.ts` |
| Evaluation / scoring | Score candidate answers after interview | `components/candidates/application-evaluation.tsx`, `lib/actions/evaluations.ts` |

## Applications

| Feature | Description | Files |
|---------|-------------|-------|
| Create application (internal) | Link candidate to vacancy from dashboard; max 5 active applications per candidate | `lib/actions/applications.ts#createApplication`, `components/candidates/add-application-dialog.tsx` |
| Update application status | Move candidate between pipeline stages; triggers candidate status sync | `lib/actions/applications.ts#updateApplicationStatus` |
| Reject application | Select reason + template, optional rejection email | `lib/actions/applications.ts#rejectApplication`, `components/pipeline/rejection-dialog.tsx` |
| Remove application | Soft-delete application | `lib/actions/applications.ts#removeApplication` |
| Application row | Shows candidate info, status, actions per application | `components/vacancies/vacancy-application-row.tsx` |

## Public Application Form

| Feature | Description | Files |
|---------|-------------|-------|
| Public apply page | Branded with org logo and vacancy details | `app/apply/[token]/page.tsx` |
| Application form | Name, email, phone, LinkedIn, CV upload; Turnstile captcha | `components/apply/apply-form.tsx` |
| Submission handling | IP rate limit (5/hr), vacancy cap (500), duplicate detection by email, magic-byte CV validation | `lib/actions/public-apply.ts` |
| Confirmation email | Sends `application_received` template to applicant | `lib/actions/public-apply.ts`, `lib/email.ts` |
| Notification | Notifies org owners/admins of new application | `lib/actions/public-apply.ts` |
| JSON-LD schema | JobPosting structured data for SEO | `app/apply/[token]/page.tsx` |

## Public Jobs Page

| Feature | Description | Files |
|---------|-------------|-------|
| Organisation job board | Lists all open vacancies for an org by public slug | `app/jobs/[slug]/page.tsx` |
| Vacancy listing | Title, location, department, employment type, apply link | `app/jobs/[slug]/page.tsx` |

## Interviews

| Feature | Description | Files |
|---------|-------------|-------|
| Schedule interview | Candidate, vacancy, date/time (must be future), duration 15–480 min, type: video/phone/on-site | `app/(dashboard)/interviews/new/page.tsx`, `components/interviews/interview-form.tsx`, `lib/actions/interviews.ts` |
| Google Meet creation | Optional; creates calendar event with Meet link, stores event ID | `lib/actions/interviews.ts`, `lib/google/calendar.ts` |
| Zoom meeting creation | Optional; creates Zoom meeting, stores join URL | `lib/actions/interviews.ts`, `lib/zoom/meetings.ts` |
| Microsoft Teams creation | Optional; creates Teams calendar event, stores join URL | `lib/actions/interviews.ts`, `lib/microsoft/graph.ts` |
| Manual meeting link | Free-text meeting URL fallback | `components/interviews/interview-form.tsx` |
| Email invitation | Sends interview invitation to candidate email using `interview_invitation` template | `lib/email.ts`, `lib/actions/interviews.ts` |
| Reschedule interview | Update date/time, optionally resend email | `lib/actions/interviews.ts#rescheduleInterview` |
| Update status | Mark as Completed, Cancelled, No-show | `lib/actions/interviews.ts#updateInterviewStatus` |
| Interview list | Upcoming and past interviews, filterable | `app/(dashboard)/interviews/page.tsx` |
| In-app notification | Creator and interviewer notified on schedule | `lib/actions/interviews.ts` |

## Settings

| Feature | Description | Files |
|---------|-------------|-------|
| Profile | Edit full name, phone | `app/(dashboard)/settings/profile/page.tsx`, `components/settings/profile-form.tsx`, `lib/actions/settings.ts` |
| Change password | Update password (disabled for OAuth-only accounts) | `components/settings/change-password-form.tsx` |
| Organisation | Edit org name, logo (owner only) | `app/(dashboard)/settings/organization/page.tsx`, `components/settings/organization-form.tsx` |
| Team management | Invite members, view pending invitations, revoke invitations (owner/admin only) | `app/(dashboard)/settings/team/page.tsx`, `components/settings/team-invitations.tsx` |
| Rejection reasons | Add, reorder, manage rejection reason labels | `app/(dashboard)/settings/rejection-reasons/page.tsx`, `components/settings/rejection-reasons-manager.tsx`, `components/settings/rejection-templates-manager.tsx` |
| Email templates | Customise subject/body for `application_received`, `interview_invitation`, `rejection` | `app/(dashboard)/settings/email-templates/page.tsx`, `components/settings/email-templates-manager.tsx` |
| Custom fields | Define groups and fields (text, number, boolean, select, long text, date) for candidates and vacancies | `app/(dashboard)/settings/custom-fields/page.tsx`, `components/settings/custom-fields-manager.tsx` |
| Google Calendar | Connect/disconnect Google account for Meet + Calendar integration | `app/(dashboard)/settings/integrations/page.tsx`, `components/settings/google-calendar-connect.tsx` |
| Zoom | Connect/disconnect Zoom for meeting creation | `components/settings/zoom-connect.tsx` |
| Microsoft | Connect/disconnect Microsoft/Teams | `components/settings/microsoft-connect.tsx` |
| Column preferences | Choose which columns appear in candidate/vacancy lists | `components/shared/column-manager-dialog.tsx`, `lib/actions/preferences.ts` |

## Notifications

| Feature | Description | Files |
|---------|-------------|-------|
| Bell icon | Header bell with unread count badge | `components/dashboard/notifications-bell.tsx` |
| Notification list | Up to 50 recent, mark as read, mark all read | `lib/actions/notifications.ts` |
| Notification types | `interview_scheduled`, `new_application` | `lib/actions/notifications.ts` |

## Subscription / Billing

| Feature | Description | Files |
|---------|-------------|-------|
| Plan cards | Trial (free 7d), Individual ($20/mo or $16/mo annual), Organization ($40/mo or $32/mo annual) | `lib/types/subscription.ts`, `components/subscription/plan-cards.tsx` |
| Campaign pricing | Configurable discount campaign (currently "Spring Offer": 60% monthly, 70% annual) | `lib/campaign.ts` |
| Usage display | Shows vacancies used / limit, candidates used / limit | `app/(dashboard)/subscription/page.tsx` |
| Trial banner | Shows days remaining in trial, expired state | `components/dashboard/trial-banner.tsx` |
| Expired redirect | When trial ends (or status=expired), auto-redirects to `/subscription` | `app/(dashboard)/layout.tsx` |
| Payment wiring | **Not implemented** — buttons display but no payment provider connected (LemonSqueezy planned) | `components/subscription/plan-cards.tsx` |
