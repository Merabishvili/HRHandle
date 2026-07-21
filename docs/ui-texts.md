# UI Text Inventory

_Last updated: 2026-07-20_

> **⚠️ Partial / stale (2026-07-20 audit).** This inventory predates (a) the redesign's terminology + sentence-case sweep (Role/Position → **Vacancy**, "Evaluation criteria" → **Scorecard**, "Manage applicants" → **Manage candidates**, "Get Started" → "Get started", etc.) and (b) whole new surfaces shipped mid-2026: **Offers** (`/offer/<token>` + recruiter panel), **Reports** (`/reports`), **integrations** (Slack/Teams/Calendly), **2FA** flows, **CSV import** wizard, **cmd-K search**, **scorecard sharing**, the **Pipeline** home surface + Quick Review mode. Those strings are **not** yet catalogued here. Treat the entries below as a partial snapshot; a full re-inventory is a tracked deeper follow-up (`docs/audit-progress.md`). For the redesign terminology decisions, see `docs/redesign/flows/S10-ai-terminology.md`.

## Changelog

- 🔄 (2026-07-20 audit) Flagged partial/stale — see banner above; redesign terminology pass + mid-2026 surfaces not yet inventoried.

- 🆕 LinkedIn integration status messages (`?linkedin=connected|disconnected|invalid_page_id|error`) — surfaced as toasts on `/settings/integrations`
- 🆕 CV-parsing UI states on apply form: "Parsing CV…", "Auto-filled from CV", "Could not auto-fill — please fill manually" (`components/apply/apply-form.tsx`)
- 🔄 Capitalisation inconsistency noted: `email.confirm_heading = "Thanks for Applying!"` vs `apply_form.success_heading = "You've Applied!"` (see issue `BL-text-consistency`)

---

| Key | Text | Location (File) | UI Location Description |
|---|---|---|---|
| login.title | Welcome back | `app/auth/login/page.tsx:128` | Login card title |
| login.subtitle | Sign in to your account to continue | `app/auth/login/page.tsx:129` | Login card description |
| login.google | Continue with Google | `app/auth/login/page.tsx:143` | Google sign-in button |
| login.microsoft | Continue with Microsoft | `app/auth/login/page.tsx:147` | Microsoft sign-in button |
| login.divider | or | `app/auth/login/page.tsx:157` | Divider between OAuth and email/password |
| login.email_label | Email | `app/auth/login/page.tsx:163` | Email field label |
| login.email_placeholder | you@company.com | `app/auth/login/page.tsx:165` | Email field placeholder |
| login.password_label | Password | `app/auth/login/page.tsx:176` | Password field label |
| login.forgot_password | Forgot password? | `app/auth/login/page.tsx:178` | Forgot password link |
| login.password_placeholder | Enter your password | `app/auth/login/page.tsx:184` | Password field placeholder |
| login.remember_me | Keep me signed in | `app/auth/login/page.tsx:202` | Remember me checkbox label |
| login.submit | Sign in | `app/auth/login/page.tsx:215` | Submit button |
| login.loading | Signing in... | `app/auth/login/page.tsx:209` | Submit button loading state |
| login.captcha_error | Security check not complete. Please wait a moment and try again. | `app/auth/login/page.tsx:61` | Error when Turnstile not ready |
| login.no_account | Don't have an account? | `app/auth/login/page.tsx:228` | Sign-up link prompt |
| login.sign_up | Sign up | `app/auth/login/page.tsx:231` | Sign-up link |
| signup.card_title | Create your account | `components/auth/sign-up-form.tsx` | Sign-up card title |
| signup.google | Continue with Google | `components/auth/sign-up-form.tsx` | Google sign-up button |
| signup.microsoft | Continue with Microsoft | `components/auth/sign-up-form.tsx` | Microsoft sign-up button |
| signup.full_name_label | Full name | `components/auth/sign-up-form.tsx` | Full name field label |
| signup.full_name_placeholder | Jane Smith | `components/auth/sign-up-form.tsx` | Full name placeholder |
| signup.company_label | Company name | `components/auth/sign-up-form.tsx:224` | Company name label (non-invite flow) |
| signup.company_placeholder | Acme Inc. | `components/auth/sign-up-form.tsx:229` | Company name placeholder |
| signup.email_label | Work email | `components/auth/sign-up-form.tsx:238` | Email field label |
| signup.email_placeholder | you@company.com | `components/auth/sign-up-form.tsx:255` | Email placeholder |
| signup.password_label | Password | `components/auth/sign-up-form.tsx` | Password field label |
| signup.password_placeholder | At least 8 characters | `components/auth/sign-up-form.tsx:269` | Password placeholder |
| signup.submit | Create account | `components/auth/sign-up-form.tsx:285` | Submit button |
| signup.loading | Creating account... | `components/auth/sign-up-form.tsx:282` | Submit loading state |
| signup.terms | By signing up, you agree to our Terms and Conditions and Privacy Policy. | `components/auth/sign-up-form.tsx:300` | Terms acceptance notice |
| signup.have_account | Already have an account? | `components/auth/sign-up-form.tsx:307` | Sign-in link prompt |
| signup.sign_in | Sign in | `components/auth/sign-up-form.tsx:312` | Sign-in link |
| signup.password_error | Password must be at least 8 characters | `components/auth/sign-up-form.tsx:76` | Inline password validation error |
| forgot_password.title | Forgot password? | `app/auth/forgot-password/page.tsx:67` | Page title |
| forgot_password.subtitle | Enter your email and we'll send you a reset link. | `app/auth/forgot-password/page.tsx:68-70` | Page description |
| forgot_password.email_label | Email | `app/auth/forgot-password/page.tsx:88` | Email field label |
| forgot_password.email_placeholder | you@company.com | `app/auth/forgot-password/page.tsx:93` | Email placeholder |
| forgot_password.submit | Send reset link | `app/auth/forgot-password/page.tsx:107` | Submit button |
| forgot_password.loading | Sending... | `app/auth/forgot-password/page.tsx:104` | Submit loading state |
| forgot_password.success | Password reset link has been sent to your email. | `app/auth/forgot-password/page.tsx:43` | Success message |
| forgot_password.back | Back to sign in | `app/auth/forgot-password/page.tsx:113` | Back to login link |
| reset_password.title | Reset password | `app/auth/reset-password/page.tsx:76` | Page title |
| reset_password.subtitle | Choose a new password for your account. | `app/auth/reset-password/page.tsx:77` | Page description |
| reset_password.new_password_label | New password | `app/auth/reset-password/page.tsx:89` | New password label |
| reset_password.confirm_label | Confirm new password | `app/auth/reset-password/page.tsx:101` | Confirm password label |
| reset_password.submit | Update password | `app/auth/reset-password/page.tsx:118` | Submit button |
| reset_password.loading | Updating... | `app/auth/reset-password/page.tsx:116` | Submit loading state |
| reset_password.min_length | Password must be at least 8 characters. | `app/auth/reset-password/page.tsx:26` | Validation error |
| reset_password.mismatch | Passwords do not match. | `app/auth/reset-password/page.tsx:31` | Validation error |
| vacancies.page_title | Vacancies | `app/(dashboard)/vacancies/page.tsx` | Page heading |
| vacancies.new_button | New Vacancy | `app/(dashboard)/vacancies/page.tsx` | Create new vacancy button |
| vacancies.empty_title | No vacancies yet | `app/(dashboard)/vacancies/page.tsx` | Empty state heading |
| vacancies.empty_description | Create your first vacancy to start recruiting. | `app/(dashboard)/vacancies/page.tsx` | Empty state description |
| vacancies.empty_cta | Create Vacancy | `app/(dashboard)/vacancies/page.tsx` | Empty state CTA button |
| vacancies.col_title | Title | `app/(dashboard)/vacancies/page.tsx` | Table column header |
| vacancies.col_status | Status | `app/(dashboard)/vacancies/page.tsx` | Table column header |
| vacancies.col_department | Department | `app/(dashboard)/vacancies/page.tsx` | Table column header |
| vacancies.col_location | Location | `app/(dashboard)/vacancies/page.tsx` | Table column header |
| vacancies.col_openings | Openings | `app/(dashboard)/vacancies/page.tsx` | Table column header |
| vacancies.col_start_date | Start Date | `app/(dashboard)/vacancies/page.tsx` | Table column header |
| vacancies.col_applications | Applications | `app/(dashboard)/vacancies/page.tsx` | Table column header |
| vacancy_form.title_label | Job Title | `components/vacancies/vacancy-form.tsx` | Form field label |
| vacancy_form.title_placeholder | e.g. Senior Software Engineer | `components/vacancies/vacancy-form.tsx` | Form field placeholder |
| vacancy_form.description_label | About the Job | `components/vacancies/vacancy-form.tsx` | Textarea label |
| vacancy_form.responsibilities_label | Responsibilities | `components/vacancies/vacancy-form.tsx` | Textarea label |
| vacancy_form.requirements_label | Requirements | `components/vacancies/vacancy-form.tsx` | Textarea label |
| vacancy_form.sector_label | Sector | `components/vacancies/vacancy-form.tsx` | Select label |
| vacancy_form.department_label | Department | `components/vacancies/vacancy-form.tsx` | Input label |
| vacancy_form.location_label | Location | `components/vacancies/vacancy-form.tsx` | Input label |
| vacancy_form.employment_type_label | Employment Type | `components/vacancies/vacancy-form.tsx` | Select label |
| vacancy_form.salary_min_label | Min Salary | `components/vacancies/vacancy-form.tsx` | Input label |
| vacancy_form.salary_max_label | Max Salary | `components/vacancies/vacancy-form.tsx` | Input label |
| vacancy_form.openings_label | Openings | `components/vacancies/vacancy-form.tsx` | Number input label |
| vacancy_form.start_date_label | Start Date | `components/vacancies/vacancy-form.tsx` | Date picker label |
| vacancy_form.end_date_label | End Date | `components/vacancies/vacancy-form.tsx` | Date picker label |
| vacancy_form.show_public_label | Show on public jobs page | `components/vacancies/vacancy-form.tsx` | Checkbox label |
| vacancy_form.save | Save Vacancy | `components/vacancies/vacancy-form.tsx` | Submit button |
| vacancy_form.salary_error | Maximum salary must be ≥ minimum salary | `lib/validations/vacancy.ts:31` | Validation error |
| vacancy_form.end_date_error | End date cannot be before start date | `lib/validations/vacancy.ts:38` | Validation error |
| candidates.page_title | Candidates | `app/(dashboard)/candidates/page.tsx` | Page heading |
| candidates.new_button | Add Candidate | `app/(dashboard)/candidates/page.tsx` | Add button |
| candidates.export_button | Export CSV | `app/(dashboard)/candidates/page.tsx` | Export button |
| candidates.empty_title | No candidates yet | `app/(dashboard)/candidates/page.tsx` | Empty state |
| candidates.col_name | Name | `app/(dashboard)/candidates/page.tsx` | Table column |
| candidates.col_email | Email | `app/(dashboard)/candidates/page.tsx` | Table column |
| candidates.col_phone | Phone | `app/(dashboard)/candidates/page.tsx` | Table column |
| candidates.col_company | Company | `app/(dashboard)/candidates/page.tsx` | Table column |
| candidates.col_position | Position | `app/(dashboard)/candidates/page.tsx` | Table column |
| candidates.col_status | Status | `app/(dashboard)/candidates/page.tsx` | Table column |
| candidates.col_added | Added | `app/(dashboard)/candidates/page.tsx` | Table column |
| candidate_form.first_name_label | First Name | `components/candidates/candidate-form.tsx` | Form field |
| candidate_form.last_name_label | Last Name | `components/candidates/candidate-form.tsx` | Form field |
| candidate_form.email_label | Email | `components/candidates/candidate-form.tsx` | Form field |
| candidate_form.phone_label | Phone | `components/candidates/candidate-form.tsx` | Form field |
| candidate_form.company_label | Current Company | `components/candidates/candidate-form.tsx` | Form field |
| candidate_form.position_label | Current Position | `components/candidates/candidate-form.tsx` | Form field |
| candidate_form.experience_label | Years of Experience | `components/candidates/candidate-form.tsx` | Form field |
| candidate_form.linkedin_label | LinkedIn Profile URL | `components/candidates/candidate-form.tsx` | Form field |
| candidate_form.source_label | Source | `components/candidates/candidate-form.tsx` | Form field |
| candidate_form.dob_label | Date of Birth | `components/candidates/candidate-form.tsx` | Form field |
| candidate_form.dob_age_error | Candidate must be at least 16 years old | `lib/validations/candidate.ts:34` | Validation error |
| candidate_form.save | Save | `components/candidates/candidate-form.tsx` | Submit button |
| interviews.page_title | Interviews | `app/(dashboard)/interviews/page.tsx` | Page heading |
| interviews.new_button | Schedule Interview | `app/(dashboard)/interviews/page.tsx` | Schedule button |
| interviews.empty_title | No interviews scheduled | `app/(dashboard)/interviews/page.tsx` | Empty state |
| interviews.col_candidate | Candidate | `app/(dashboard)/interviews/page.tsx` | Table column |
| interviews.col_vacancy | Vacancy | `app/(dashboard)/interviews/page.tsx` | Table column |
| interviews.col_date | Date & Time | `app/(dashboard)/interviews/page.tsx` | Table column |
| interviews.col_type | Type | `app/(dashboard)/interviews/page.tsx` | Table column |
| interviews.col_status | Status | `app/(dashboard)/interviews/page.tsx` | Table column |
| interviews.col_interviewer | Interviewer | `app/(dashboard)/interviews/page.tsx` | Table column |
| interview_form.type_video | Video Call | `components/interviews/interview-form.tsx` | Interview type option |
| interview_form.type_phone | Phone Call | `components/interviews/interview-form.tsx` | Interview type option |
| interview_form.type_onsite | On-site | `components/interviews/interview-form.tsx` | Interview type option |
| interview_form.meet_google | Create Google Meet | `components/interviews/interview-form.tsx` | Meeting option |
| interview_form.meet_zoom | Create Zoom Meeting | `components/interviews/interview-form.tsx` | Meeting option |
| interview_form.meet_teams | Create Teams Meeting | `components/interviews/interview-form.tsx` | Meeting option |
| interview_form.send_invite | Send email invitation to candidate | `components/interviews/interview-form.tsx` | Checkbox label |
| interview_form.schedule | Schedule Interview | `components/interviews/interview-form.tsx` | Submit button |
| interview_form.future_error | Interview must be scheduled in the future | `lib/validations/interview.ts:18` | Validation error |
| pipeline.applied | Applied | `app/(dashboard)/vacancies/[id]/pipeline/page.tsx` | Pipeline stage label |
| pipeline.screening | Screening | `app/(dashboard)/vacancies/[id]/pipeline/page.tsx` | Pipeline stage label |
| pipeline.interview | Interview | `app/(dashboard)/vacancies/[id]/pipeline/page.tsx` | Pipeline stage label |
| pipeline.offer | Offer | `app/(dashboard)/vacancies/[id]/pipeline/page.tsx` | Pipeline stage label |
| pipeline.hired | Hired | `app/(dashboard)/vacancies/[id]/pipeline/page.tsx` | Pipeline stage label |
| pipeline.rejected | Rejected | `app/(dashboard)/vacancies/[id]/pipeline/page.tsx` | Pipeline stage label |
| pipeline.reject_button | Reject | `components/pipeline/rejection-dialog.tsx` | Reject button in pipeline |
| rejection_dialog.title | Reject Candidate | `components/pipeline/rejection-dialog.tsx` | Dialog title |
| rejection_dialog.reason_label | Rejection Reason | `components/pipeline/rejection-dialog.tsx` | Select label |
| rejection_dialog.template_label | Email Template | `components/pipeline/rejection-dialog.tsx` | Select label |
| rejection_dialog.send_email | Send rejection email | `components/pipeline/rejection-dialog.tsx` | Checkbox |
| rejection_dialog.confirm | Confirm Rejection | `components/pipeline/rejection-dialog.tsx` | Confirm button |
| rejection_dialog.cancel | Cancel | `components/pipeline/rejection-dialog.tsx` | Cancel button |
| settings.profile_title | Profile | `app/(dashboard)/settings/profile/page.tsx:27` | Settings section title |
| settings.profile_desc | Update your personal information. | `app/(dashboard)/settings/profile/page.tsx:28` | Settings section description |
| settings.account_title | Account | `app/(dashboard)/settings/profile/page.tsx:36` | Account section title |
| settings.account_desc | Your account information. | `app/(dashboard)/settings/profile/page.tsx:37` | Account section description |
| settings.org_title | Organization | `app/(dashboard)/settings/organization/page.tsx` | Settings section title |
| settings.org_desc | Update your organization details. | `app/(dashboard)/settings/organization/page.tsx` | Settings section description |
| settings.team_title | Team | `app/(dashboard)/settings/team/page.tsx:37` | Settings section title |
| settings.team_desc | Manage team members and send invitations. | `app/(dashboard)/settings/team/page.tsx:38` | Settings section description |
| settings.custom_fields_title | Custom Fields | `app/(dashboard)/settings/custom-fields/page.tsx:29` | Settings section title |
| settings.custom_fields_desc | Define custom fields for candidates and vacancies. Up to 20 fields per entity type. | `app/(dashboard)/settings/custom-fields/page.tsx:30-31` | Settings section description |
| settings.email_templates_title | Email Templates | `app/(dashboard)/settings/email-templates/page.tsx:33` | Settings section title |
| settings.email_templates_desc | Customise the emails sent to candidates. Use variables to personalise the content. | `app/(dashboard)/settings/email-templates/page.tsx:34-36` | Settings section description |
| settings.nav_profile | Profile | `components/settings/settings-nav.tsx` | Nav item |
| settings.nav_organization | Organization | `components/settings/settings-nav.tsx` | Nav item |
| settings.nav_team | Team | `components/settings/settings-nav.tsx` | Nav item |
| settings.nav_billing | Billing | `components/settings/settings-nav.tsx` | Nav item (redirects to /subscription) |
| settings.nav_custom_fields | Custom Fields | `components/settings/settings-nav.tsx` | Nav item |
| settings.nav_email_templates | Email Templates | `components/settings/settings-nav.tsx` | Nav item |
| settings.nav_rejection_reasons | Rejection Reasons | `components/settings/settings-nav.tsx` | Nav item |
| settings.nav_integrations | Integrations | `components/settings/settings-nav.tsx` | Nav item |
| profile_form.full_name_label | Full Name | `components/settings/profile-form.tsx` | Form field |
| profile_form.phone_label | Phone | `components/settings/profile-form.tsx` | Form field |
| profile_form.save | Save Changes | `components/settings/profile-form.tsx` | Submit button |
| org_form.name_label | Organization Name | `components/settings/organization-form.tsx` | Form field |
| org_form.save | Save Changes | `components/settings/organization-form.tsx` | Submit button |
| team.invite_email_label | Email Address | `components/settings/team-invitations.tsx` | Invite form field |
| team.invite_role_label | Role | `components/settings/team-invitations.tsx` | Role select label |
| team.invite_role_member | Member | `components/settings/team-invitations.tsx` | Role option |
| team.invite_role_admin | Admin | `components/settings/team-invitations.tsx` | Role option |
| team.invite_button | Send Invitation | `components/settings/team-invitations.tsx` | Send invite button |
| team.invitation_sent | Invitation sent to {email} | `components/settings/team-invitations.tsx:63` | Success message |
| team.revoke | Revoke | `components/settings/team-invitations.tsx` | Revoke invitation button |
| team.revoked | Invitation to {email} revoked. | `components/settings/team-invitations.tsx:72` | Success message |
| team.pending_invites | Pending Invitations | `components/settings/team-invitations.tsx` | Section heading |
| team.members | Team Members | `components/settings/team-invitations.tsx` | Section heading |
| google.connect | Connect Google Calendar | `components/settings/google-calendar-connect.tsx` | Button label |
| google.disconnect | Disconnect | `components/settings/google-calendar-connect.tsx` | Button label |
| google.connected | Connected | `components/settings/google-calendar-connect.tsx` | Status badge |
| zoom.connect | Connect Zoom | `components/settings/zoom-connect.tsx` | Button label |
| zoom.disconnect | Disconnect | `components/settings/zoom-connect.tsx` | Button label |
| microsoft.connect | Connect Microsoft | `components/settings/microsoft-connect.tsx` | Button label |
| microsoft.disconnect | Disconnect | `components/settings/microsoft-connect.tsx` | Button label |
| apply_form.heading | Apply for this Position | `components/apply/apply-form.tsx:106` | Form heading |
| apply_form.first_name | First Name | `components/apply/apply-form.tsx:127` | Field label |
| apply_form.first_name_req | First Name * | `components/apply/apply-form.tsx:127-128` | Required field indicator |
| apply_form.last_name | Last Name | `components/apply/apply-form.tsx:141` | Field label |
| apply_form.email | Email Address | `components/apply/apply-form.tsx` | Field label |
| apply_form.phone | Phone Number | `components/apply/apply-form.tsx` | Field label |
| apply_form.linkedin | LinkedIn Profile URL | `components/apply/apply-form.tsx` | Field label |
| apply_form.cv | Upload CV | `components/apply/apply-form.tsx` | File upload label |
| apply_form.cv_hint | PDF, DOC, DOCX — max 10 MB | `components/apply/apply-form.tsx` | File type hint |
| apply_form.submit | Submit Application | `components/apply/apply-form.tsx` | Submit button |
| apply_form.submitting | Submitting... | `components/apply/apply-form.tsx` | Loading state |
| apply_form.success_heading | You've Applied! | `components/apply/apply-form.tsx:95` | Success state heading |
| apply_form.success_body | Thank you for applying. We've sent a confirmation to {email}. We will review your details and be in touch. | `components/apply/apply-form.tsx:97-99` | Success message |
| apply_form.cv_type_error | Please upload a PDF or Word document (.pdf, .doc, .docx). | `components/apply/apply-form.tsx:28` | File type validation |
| apply_form.cv_size_error | File must be 10 MB or smaller. | `components/apply/apply-form.tsx:33` | File size validation |
| apply_form.first_name_required | First name is required. | `components/apply/apply-form.tsx:46` | Field validation |
| apply_form.last_name_required | Last name is required. | `components/apply/apply-form.tsx:47` | Field validation |
| apply_form.email_required | A valid email address is required. | `components/apply/apply-form.tsx:49` | Field validation |
| apply_form.cv_required | Please upload your CV. | `components/apply/apply-form.tsx:52` | Field validation |
| apply_form.phone_invalid | Please enter a valid phone number. | `components/apply/apply-form.tsx:56` | Field validation |
| apply_form.linkedin_invalid | Please enter a valid LinkedIn profile URL (e.g. https://linkedin.com/in/yourname). | `components/apply/apply-form.tsx:62` | Field validation |
| jobs_page.open_positions | Open Positions | `app/jobs/[slug]/page.tsx:104` | Public jobs page subtitle |
| jobs_page.no_vacancies | No open positions at the moment. Check back soon. | `app/jobs/[slug]/page.tsx:110` | Empty state |
| jobs_page.apply_link | Apply → | `app/jobs/[slug]/page.tsx:134` | Link text in vacancy card |
| apply_page.position_closed | This position is no longer open. | `app/apply/[token]/page.tsx:166` | Closed position message |
| apply_page.position_closed_body | The role may have been filled or closed. Thank you for your interest. | `app/apply/[token]/page.tsx:167` | Closed position description |
| apply_page.all_positions | All open positions | `app/apply/[token]/page.tsx:107` | Back link |
| apply_page.view_all | View all open positions at {company} | `app/apply/[token]/page.tsx:179` | Link to all open positions |
| apply_page.about_job | About the Job | `app/apply/[token]/page.tsx:143` | Section heading |
| apply_page.responsibilities | Responsibilities | `app/apply/[token]/page.tsx:148` | Section heading |
| apply_page.requirements | Requirements | `app/apply/[token]/page.tsx:153` | Section heading |
| apply_page.powered_by | Powered by HRHandle | `app/apply/[token]/page.tsx:184` | Footer attribution |
| trial_banner.expiring | Your free trial expires on {date} | `components/dashboard/trial-banner.tsx` | Banner message |
| trial_banner.expired | Your free trial has ended. Upgrade to continue using HRHandle. | `components/dashboard/trial-banner.tsx` | Expired banner message |
| trial_banner.upgrade | Upgrade Now | `components/dashboard/trial-banner.tsx` | CTA button |
| notifications.no_notifications | No notifications | `components/dashboard/notifications-bell.tsx` | Empty state |
| notifications.mark_all_read | Mark all as read | `components/dashboard/notifications-bell.tsx` | Action button |
| subscription.current_plan | Current Plan | `app/(dashboard)/subscription/page.tsx` | Section label |
| subscription.trial_badge | Trial | `app/(dashboard)/subscription/page.tsx` | Plan status badge |
| subscription.active_badge | Active | `app/(dashboard)/subscription/page.tsx` | Plan status badge |
| subscription.expired_badge | Expired | `app/(dashboard)/subscription/page.tsx` | Plan status badge |
| subscription.upgrade | Upgrade | `app/(dashboard)/subscription/page.tsx` | Upgrade button |
| subscription.individual_name | Individual | `lib/types/subscription.ts:79` | Plan name |
| subscription.org_name | Organization | `lib/types/subscription.ts:90` | Plan name |
| subscription.trial_name | Free Trial | `lib/types/subscription.ts:57` | Plan name |
| pricing.individual_monthly | $20/mo | `lib/types/subscription.ts:77` | Price display |
| pricing.individual_annual | $16/mo | `lib/types/subscription.ts:78` | Price display (annual) |
| pricing.org_monthly | $40/mo | `lib/types/subscription.ts:92` | Price display |
| pricing.org_annual | $32/mo | `lib/types/subscription.ts:93` | Price display (annual) |
| pricing.spring_offer | Spring Offer | `lib/campaign.ts:12` | Campaign name displayed in pricing |
| plan_limit.candidates | You've reached your plan limit of {n} candidates. Upgrade to add more. | `lib/actions/index.ts:68` | Limit error message |
| plan_limit.vacancies | You've reached your plan limit of {n} active vacancies. Upgrade to add more. | `lib/actions/index.ts:76` | Limit error message |
| plan_limit.members | You've reached your plan limit of {n} team members. Upgrade to add more. | `lib/actions/index.ts:88` | Limit error message |
| applications.only_active | Only active candidates can be added to a vacancy. | `lib/actions/applications.ts:128` | Error message |
| applications.already_5 | This candidate is already being considered for 5 vacancies. Move or close one before adding a new one. | `lib/actions/applications.ts:148` | Error message |
| applications.duplicate | This candidate is already being considered for this vacancy. | `lib/actions/applications.ts:161` | Error message |
| applications.config_missing | Application status configuration missing. | `lib/actions/applications.ts:165` | Error message |
| invitations.already_member | This person is already a member of your organization. | `lib/actions/invitations.ts:41` | Error message |
| invitations.already_pending | An invitation is already pending for this email. | `lib/actions/invitations.ts:54` | Error message |
| invitations.wrong_email | This invitation was sent to a different email address. Please sign out and sign in with the correct account. | `lib/actions/invitations.ts:139` | Error message |
| invitations.already_in_org | Your account already belongs to another organization. You cannot join a second one. | `lib/actions/invitations.ts:150` | Error message |
| invitations.expired | This invitation has expired. | `lib/actions/invitations.ts:135` | Error message |
| invitations.used | This invitation has already been used or revoked. | `lib/actions/invitations.ts:134` | Error message |
| invitations.not_found | Invitation not found or already used. | `lib/actions/invitations.ts:133` | Error message |
| email.invite_subject | {inviterName} invited you to join {organizationName} on HRHandle | `lib/email.ts:39` | Email subject |
| email.invite_heading | You've been invited | `lib/email.ts:46` | Email heading |
| email.invite_accept | Accept Invitation | `lib/email.ts:51` | Email CTA button |
| email.invite_expiry | This invitation expires in 7 days. If you weren't expecting this, you can ignore it. | `lib/email.ts:56` | Email footer note |
| email.interview_heading | Interview Invitation | `lib/email.ts:124` | Email heading |
| email.interview_rescheduled | Interview Rescheduled | `lib/email.ts:124` | Email heading (rescheduled) |
| email.interview_join | Join Meeting | `lib/email.ts:174` | Email CTA button |
| email.rejection_heading | Hiring Update | `lib/email.ts:275` | Email heading |
| email.confirm_heading | Thanks for Applying! | `lib/email.ts:223` | Email heading |
| email.confirm_no_reply | Sent via HRHandle · Please do not reply to this email. | `lib/email.ts:229` | Email footer |
| custom_fields.limit_error | You've reached the limit of 20 custom fields for {entityType}s. | `lib/actions/custom-fields.ts:204` | Error message |
| custom_fields.group_name_required | Group name is required | `lib/actions/custom-fields.ts:107` | Error message |
| custom_fields.group_name_max | Group name must be 100 characters or fewer | `lib/actions/custom-fields.ts:108` | Error message |
| custom_fields.field_name_required | Field name is required | `lib/actions/custom-fields.ts:179` | Error message |
| custom_fields.dropdown_options_required | Dropdown fields require at least one option | `lib/actions/custom-fields.ts:183` | Error message |
| documents.type_error | Only PDF and Word documents are accepted | `lib/actions/documents.ts:40` | Upload error |
| documents.size_error | File must be under 10 MB | `lib/actions/documents.ts:43` | Upload error |
| public_apply.invalid_link | This apply link is no longer active. | `lib/actions/public-apply.ts:88` | Error message |
| public_apply.position_closed | This position is no longer open. | `lib/actions/public-apply.ts:95` | Error message |
| public_apply.rate_limit | Too many submissions. Please try again later. | `lib/actions/public-apply.ts:127` | Rate limit message |
| public_apply.cv_required | CV upload is required. | `lib/actions/public-apply.ts:58` | Validation error |
| public_apply.email_required | A valid email address is required. | `lib/actions/public-apply.ts:55` | Validation error |
| interview_email.date_col | Date | `lib/email.ts:155` | Email table column |
| interview_email.time_col | Time | `lib/email.ts:160` | Email table column |
| interview_email.duration_col | Duration | `lib/email.ts:164` | Email table column |
| interview_email.format_col | Format | `lib/email.ts:168` | Email table column |
| interview_email.link_col | Meeting link | `lib/email.ts:129` | Email table column |
| interview_email.sent_via | Sent via HRHandle | `lib/email.ts:185` | Email footer |
| sidebar.dashboard | Dashboard | `components/dashboard/sidebar.tsx` | Nav item |
| sidebar.vacancies | Vacancies | `components/dashboard/sidebar.tsx` | Nav item |
| sidebar.candidates | Candidates | `components/dashboard/sidebar.tsx` | Nav item |
| sidebar.interviews | Interviews | `components/dashboard/sidebar.tsx` | Nav item |
| sidebar.settings | Settings | `components/dashboard/sidebar.tsx` | Nav item |
| header.app_name | HRHandle | `components/dashboard/header.tsx` | App name in header |
| sign_up_success.title | Check your email | `app/auth/sign-up-success/page.tsx` | Page title |
| sign_up_success.body | We've sent a confirmation link to your email. Click the link to activate your account. | `app/auth/sign-up-success/page.tsx` | Page description |
| reset_success.title | Password updated | `app/auth/reset-password-success/page.tsx` | Page title |
| reset_success.body | Your password has been updated successfully. You can now sign in with your new password. | `app/auth/reset-password-success/page.tsx` | Page description |
| error_page.title | Something went wrong | `app/auth/error/page.tsx` | Auth error page title |
| rejection_email.default_subject | An update from {{company}} — {{role}} | `lib/email-template-utils.ts:22` | Default rejection email subject |
| application_email.default_subject | You applied for {{role}} at {{company}} | `lib/email-template-utils.ts:11` | Default application received subject |
| interview_email.default_subject | Interview Invitation — {{role}} at {{company}} | `lib/email-template-utils.ts:16` | Default interview invitation subject |
| vacancy_status.draft | Draft | `lib/types/vacancy.ts` | Vacancy status display |
| vacancy_status.open | Open | `lib/types/vacancy.ts` | Vacancy status display |
| vacancy_status.on_hold | On Hold | `lib/types/vacancy.ts` | Vacancy status display |
| vacancy_status.closed | Closed | `lib/types/vacancy.ts` | Vacancy status display |
| vacancy_status.archived | Archived | `lib/types/vacancy.ts` | Vacancy status display |
| candidate_status.active | Active | (candidate_statuses lookup table) | Candidate status display |
| candidate_status.hired | Hired | (candidate_statuses lookup table) | Candidate status display |
| candidate_status.archived | Archived | (candidate_statuses lookup table) | Candidate status display |
