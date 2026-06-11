# HRHandle — Features

_Last updated: 2026-05-08_

## Changelog

- 🆕 CV parsing on both internal "New Candidate" form and public apply form (Gemini Flash; PDF/DOCX → structured fields)
- 🆕 Candidate Experience & Education sections on candidate detail page (CRUD with timeline UI)
- 🆕 Activity Feed on candidate detail (`candidate_activity` view: applications, notes, documents, interviews)
- 🆕 LinkedIn integration — owner/admin saves a company-page ID in Settings → Integrations; "Post to LinkedIn" and "Share" buttons on vacancies use it
- 🆕 Per-candidate profile fields: `location`, `timezone`, `languages`, `salary_expectation`, `notice_period`
- 🔄 LinkedIn feature scope is broader than previously documented (page post + personal share, in addition to manual share-link)

---

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
| LinkedIn share | 🔄 Share single vacancy to LinkedIn profile (deep-link) | `components/vacancies/linkedin-share-button.tsx` |
| 🆕 LinkedIn post-as-page | Post a vacancy to the org's connected LinkedIn company page | `components/vacancies/linkedin-post-job-button.tsx`, `app/api/integrations/linkedin/save/route.ts` |
| Vacancy questions | Add custom scoring/text questions per vacancy for evaluations | `components/vacancies/vacancy-questions.tsx` |
| CSV export | Download all applications for a vacancy as CSV | `app/api/export/applications/route.ts` |
| Auto-expiry cron | Daily cron calls `expire_past_vacancies()` Supabase RPC to close past vacancies | `app/api/cron/expire-vacancies/route.ts`, `vercel.json` |

## Candidates

| Feature | Description | Files |
|---------|-------------|-------|
| Create candidate | Two-path entry: "Upload CV first" (AI parse + auto-fill) or "Fill manually" | `app/(dashboard)/candidates/new/page.tsx`, `components/candidates/candidate-form.tsx`, `lib/actions/candidates.ts` |
| Edit candidate | Same form (edit always shows fields directly) | `app/(dashboard)/candidates/[id]/edit/page.tsx` |
| Delete candidate | Soft-delete | `lib/actions/candidates.ts#deleteCandidate` |
| Candidate list | Filterable list with search, status tabs | `app/(dashboard)/candidates/page.tsx`, `components/candidates/candidates-toolbar.tsx` |
| Candidate detail | Profile info, experience, education, applications, notes, documents, custom fields, evaluations | `app/(dashboard)/candidates/[id]/page.tsx` |
| Experience & education | Inline add/edit/delete from candidate detail page | `components/candidates/experience-section.tsx`, `components/candidates/education-section.tsx`, `lib/actions/candidate-background.ts` |
| Candidate notes | Add, view, delete time-stamped notes; @-mention typeahead in the composer fires in-app notifications to tagged teammates | `components/candidates/activity-feed.tsx`, `components/notes/mention-textarea.tsx`, `components/notes/note-display.tsx`, `lib/actions/notes.ts`, `lib/notes/mentions.ts` |
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
| 🆕 Status auto-emails | Per-org opt-in transactional emails when an application moves into Screening or Interview | `lib/actions/applications.ts#updateApplicationStatus`, `lib/applications-status-emails.ts` |
| 🆕 Bulk move-to-stage | Vacancy applications toolbar "Move to stage ▾" dropdown lets recruiters move multiple selected applications to a chosen status at once; 50-row cap; skips rows already at the target | `components/vacancies/bulk-move-dialog.tsx`, `components/vacancies/vacancy-applications-list.tsx`, `lib/actions/applications.ts#moveApplicationsBatch`, `lib/applications/batch.ts` |
| 🆕 Scorecard sharing | Token-gated public page at `/scorecard/<token>` lets owners/admins share a candidate's evaluation answers + scores with a non-HRHandle stakeholder; lazy token generation; revocable; stable first-sharer attribution across revoke/re-share; hides contact info / status / notes / AI / offer details / audit | `app/scorecard/[token]/page.tsx`, `components/scorecards/share-scorecard-dialog.tsx`, `components/scorecards/share-scorecard-button.tsx`, `lib/actions/scorecards.ts`, `lib/scorecards/projection.ts` |
| 🆕 Saved filter views | Per-user, per-list-kind saved filter combinations on the candidates and vacancies list pages; loaded from a dropdown; inline Update / Rename / Delete on the active view; "Modified" badge when filters diverge | `components/saved-views/saved-views-menu.tsx`, `lib/actions/saved-views.ts`, `lib/saved-views/filter-encoding.ts`, `lib/saved-views/list-kinds.ts` |

## Offers

| Feature | Description | Files |
|---------|-------------|-------|
| 🆕 Create offer | Per-application offer draft with optional structured fields (compensation amount + currency + period, start date, respond-by date) and required free-text body + role title; owner/admin only | `lib/actions/offers.ts#createOffer`, `components/offers/offer-form.tsx` |
| 🆕 Send offer | Generates a public token, marks the offer `sent`, fires an email to the candidate with a link to the offer page; uses the `offer_sent` template (editable in settings) | `lib/actions/offers.ts#sendOffer`, `lib/email.ts#sendOfferEmail` |
| 🆕 Withdraw offer | Owner/admin can pull a sent offer back; candidate page shows withdrawn state | `lib/actions/offers.ts#withdrawOffer` |
| 🆕 Auto-expire | Daily cron flips sent offers past their `expiry_date` to `expired` so the recruiter UI and reporting stay accurate | `app/api/cron/purge-deleted/route.ts` |
| 🆕 Candidate accept/decline | Token-gated `/offer/<token>` page; Accept moves the application to `hired` via the existing pipeline path (candidate status syncs to `hired`); Decline accepts an optional free-text reason | `app/offer/[token]/page.tsx`, `components/offers/offer-respond-form.tsx`, `lib/actions/offers.ts#acceptOfferByToken`, `lib/actions/offers.ts#declineOfferByToken` |
| 🆕 Recruiter panel | Inside each application row, shows the active offer's state + summary + action buttons (Send / Edit / Delete for drafts; Copy link / Withdraw for sent); collapsible "previous offers" history | `components/offers/offer-panel.tsx` |

## Public Application Form

| Feature | Description | Files |
|---------|-------------|-------|
| Public apply page | Branded with org logo and vacancy details | `app/apply/[token]/page.tsx` |
| Application form | CV upload first → AI parse → auto-fills name, email, phone, LinkedIn, shows experience/education preview; candidate reviews and submits | `components/apply/apply-form.tsx` |
| CV parsing | Extracts text from PDF/DOCX; sends to Gemini Flash with a predefined JSON schema; validates response with Zod | `lib/cv-parser.ts`, `app/api/parse-cv/route.ts` |
| Submission handling | IP rate limit (5/hr public form, 10/hr parse API), vacancy cap (500), duplicate detection by email, magic-byte CV validation, saves parsed experience/education | `lib/actions/public-apply.ts` |
| Confirmation email | Sends `application_received` template to applicant | `lib/actions/public-apply.ts`, `lib/email.ts` |
| Notification | Notifies org owners/admins of new application | `lib/actions/public-apply.ts` |
| JSON-LD schema | JobPosting structured data for SEO | `app/apply/[token]/page.tsx` |

## Public Jobs Page

| Feature | Description | Files |
|---------|-------------|-------|
| Organisation job board | Lists all open vacancies for an org by public slug | `app/jobs/[slug]/page.tsx` |
| Vacancy listing | Title, location, department, employment type, apply link | `app/jobs/[slug]/page.tsx` |

## Candidate Status Page

| Feature | Description | Files |
|---------|-------------|-------|
| 🆕 Status page | Token-gated `/status/<token>` showing abstracted Applied/In review/Interview/Decision/Closed bucket, role, employer, applied date, last update; robots-noindex | `app/status/[token]/page.tsx`, `components/status/status-stepper.tsx`, `lib/application-status-bucket.ts` |
| 🆕 Tracking-link CTA | Confirmation email includes a "Track your application" button pointing at the candidate's status URL | `lib/email.ts#sendApplicationConfirmationEmail` |
| 🆕 Status-change auto-emails | Per-org opt-in transactional emails on Screening / Interview transitions, all linking back to the status page | `lib/actions/applications.ts#updateApplicationStatus`, `lib/applications-status-emails.ts` |
| 🆕 Candidate self-withdraw | Withdraw button on non-terminal applications; confirm dialog with optional reason; cancels any active offer; notifies recruiter owners + admins | `components/status/withdraw-button.tsx`, `lib/actions/applications.ts#withdrawApplicationByToken` |

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

## Global Search

| Feature | Description | Files |
|---------|-------------|-------|
| 🆕 Cmd-K palette | Header pill + Cmd-K (Mac) / Ctrl-K + "/" keyboard shortcuts open a command palette that searches candidates, vacancies, and notes in parallel. Org-scoped, soft-deleted rows excluded, capped at 5 per group | `components/global-search/global-search-dialog.tsx`, `components/global-search/search-trigger.tsx`, `lib/actions/search.ts`, `lib/search/query.ts` |

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
| 🆕 Audit log | Owner/admin read-only viewer over `activity_log` with action/entity/user/date filters, paginated, with CSV export | `app/(dashboard)/settings/audit-log/page.tsx`, `components/settings/audit-log-table.tsx`, `components/settings/audit-log-filters.tsx`, `app/api/export/audit-log/route.ts`, `lib/actions/audit-log.ts`, `lib/audit-log/filter.ts` |
| 🆕 Trash | Owner/admin page listing soft-deleted candidates and vacancies; per-row Restore (cascade-undeletes the candidate's applications using BL-007's audit row) and Delete-now (skips the 30-day grace) | `app/(dashboard)/settings/trash/page.tsx`, `components/settings/trash-list.tsx`, `lib/actions/restore.ts`, `lib/trash/impact.ts` |

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

## Guides

Public feature walkthroughs with annotated screenshots, served from a static-cacheable Next.js route. Linked from the dashboard header (opens in a new tab) and shared with prospects.

| Feature | Description | Files |
|---------|-------------|-------|
| Guide index | Lists every guide grouped by category plus a short FAQ | `app/guide/page.tsx`, `lib/guides/registry.ts` |
| Guide page | MDX-rendered article with sidebar nav and annotated screenshots | `app/guide/[slug]/page.tsx`, `components/guide/guide-shell.tsx`, `components/guide/guide-sidebar.tsx`, `components/guide/mdx-components.tsx` |
| Guide registry | Single source of truth for slug, title, summary, category, order; index page shows "Coming soon" for entries with no MDX yet | `lib/guides/registry.ts` |
| Guide loader | Reads MDX file + frontmatter from `content/guides/*.mdx` | `lib/guides/loader.ts` |
| Dashboard Help link | Top-right link in the dashboard header, opens `/guide` in a new tab | `components/dashboard/help-link.tsx`, `components/dashboard/header.tsx` |
| Screenshot capture | Playwright script that logs into staging, navigates to each page, injects annotation overlays, saves PNGs to `public/guide/screenshots/` | `scripts/capture-screenshots.ts`, `scripts/screenshot-config.ts` |
| Demo data seed | Idempotent script that creates a demo org (Acme Corporation), two demo users, and seeded vacancies on staging Supabase | `scripts/seed-demo-org.ts` |
