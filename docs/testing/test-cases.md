# Test Cases

## Auth

### TC-001
**Feature:** Auth / Login  
**Description:** Successful login with valid credentials  
**Preconditions:** User account exists and email is confirmed  
**Steps:**
1. Navigate to `/auth/login`
2. Enter valid email and password
3. Complete Turnstile CAPTCHA (invisible, fires automatically)
4. Click "Sign in"
**Expected Result:** User is redirected to `/dashboard`  
**Priority:** Critical  
**Type:** E2E

---

### TC-002
**Feature:** Auth / Login  
**Description:** Login fails with wrong password  
**Preconditions:** User account exists  
**Steps:**
1. Navigate to `/auth/login`
2. Enter valid email and incorrect password
3. Click "Sign in"
**Expected Result:** Error message displayed ("Invalid login credentials" or similar); user stays on login page  
**Priority:** Critical  
**Type:** E2E

---

### TC-003
**Feature:** Auth / Login  
**Description:** Login button is disabled until Turnstile token is set  
**Preconditions:** None  
**Steps:**
1. Navigate to `/auth/login`
2. Enter valid email and password
3. Do NOT wait for Turnstile to fire
**Expected Result:** Sign in button is disabled  
**Priority:** High  
**Type:** Integration

---

### TC-004
**Feature:** Auth / Login  
**Description:** Unconfirmed email account cannot log in  
**Preconditions:** User signed up but did not confirm email  
**Steps:**
1. Navigate to `/auth/login`
2. Enter email and password for unconfirmed account
3. Submit
**Expected Result:** Error indicating email not confirmed  
**Priority:** High  
**Type:** E2E

---

### TC-005
**Feature:** Auth / Sign-up  
**Description:** Successful sign-up sends confirmation email  
**Preconditions:** Email not already registered  
**Steps:**
1. Navigate to `/auth/sign-up`
2. Enter name, valid email, password >= 8 chars
3. Submit
**Expected Result:** "Check your email" confirmation screen shown; confirmation email received with `/auth/confirm?token_hash=...&type=signup` link  
**Priority:** Critical  
**Type:** E2E

---

### TC-006
**Feature:** Auth / Sign-up  
**Description:** Password shorter than 8 characters is rejected  
**Preconditions:** None  
**Steps:**
1. Navigate to `/auth/sign-up`
2. Enter valid email and a 7-character password
3. Submit
**Expected Result:** Client-side validation error ("Password must be at least 8 characters")  
**Priority:** High  
**Type:** Unit

---

### TC-007
**Feature:** Auth / Sign-up  
**Description:** Duplicate email shows error  
**Preconditions:** Email already registered and confirmed  
**Steps:**
1. Navigate to `/auth/sign-up`
2. Enter an already-registered email
3. Submit
**Expected Result:** Error message indicating email is already in use  
**Priority:** High  
**Type:** E2E

---

### TC-008
**Feature:** Auth / Email Confirmation  
**Description:** Valid token_hash confirms account and redirects  
**Preconditions:** User signed up, confirmation email received  
**Steps:**
1. Click the confirmation link in the email (format: `/auth/confirm?token_hash=...&type=signup`)
**Expected Result:** Account confirmed; user redirected to `/dashboard`  
**Priority:** Critical  
**Type:** E2E

---

### TC-009
**Feature:** Auth / Email Confirmation  
**Description:** Confirmation link works when opened in a different browser  
**Preconditions:** User signed up in Browser A, confirmation email received  
**Steps:**
1. Copy confirmation link
2. Open in Browser B (no session from sign-up)
3. Navigate to the link
**Expected Result:** Account confirmed; user redirected to `/dashboard` (token_hash flow, not PKCE)  
**Priority:** High  
**Type:** E2E

---

### TC-010
**Feature:** Auth / Email Confirmation  
**Description:** Invalid or expired token_hash redirects to error page  
**Preconditions:** None  
**Steps:**
1. Navigate to `/auth/confirm?token_hash=invalid_token&type=signup`
**Expected Result:** Redirect to `/auth/error`  
**Priority:** High  
**Type:** E2E

---

### TC-011
**Feature:** Auth / Password Reset  
**Description:** Forgot password sends reset email  
**Preconditions:** User account exists  
**Steps:**
1. Navigate to `/auth/forgot-password`
2. Enter registered email
3. Submit
**Expected Result:** "Check your email" message shown; reset email received with `/auth/confirm?token_hash=...&type=recovery&next=/auth/reset-password` link  
**Priority:** Critical  
**Type:** E2E

---

### TC-012
**Feature:** Auth / Password Reset  
**Description:** Reset link works in different browser (implicit flow)  
**Preconditions:** Password reset email received after request in Browser A  
**Steps:**
1. Copy reset link from email
2. Open in Browser B
3. Navigate to the link
4. Enter new password
5. Submit
**Expected Result:** Password changed successfully; user redirected to login or dashboard  
**Priority:** High  
**Type:** E2E

---

### TC-013
**Feature:** Auth / Password Reset  
**Description:** New password must be >= 8 characters  
**Preconditions:** User is on reset-password page with valid token  
**Steps:**
1. Enter a 7-character password in the new password field
2. Submit
**Expected Result:** Validation error shown  
**Priority:** High  
**Type:** Unit

---

### TC-014
**Feature:** Auth / OAuth  
**Description:** Google sign-in redirects to Google and returns to dashboard  
**Preconditions:** Google OAuth configured in Supabase  
**Steps:**
1. Navigate to `/auth/login`
2. Click "Continue with Google"
3. Authenticate with Google
**Expected Result:** Redirected to `/auth/callback`, session created, redirected to `/dashboard`  
**Priority:** High  
**Type:** E2E

---

### TC-015
**Feature:** Auth / OAuth  
**Description:** Microsoft sign-in redirects to Microsoft and returns to dashboard  
**Preconditions:** Microsoft/Azure OAuth configured in Supabase  
**Steps:**
1. Navigate to `/auth/login`
2. Click "Continue with Microsoft"
3. Authenticate with Microsoft
**Expected Result:** Redirected to `/auth/callback`, session created, redirected to `/dashboard`  
**Priority:** High  
**Type:** E2E

---

### TC-016
**Feature:** Auth / Session  
**Description:** "Remember me" unchecked — last_active written to localStorage  
**Preconditions:** User on login page  
**Steps:**
1. Uncheck "Remember me"
2. Log in
**Expected Result:** `hrhandle_remember_me = 'false'` and `hrhandle_last_active = <timestamp>` set in localStorage  
**Priority:** Medium  
**Type:** Unit

---

### TC-017
**Feature:** Auth / Session  
**Description:** "Remember me" checked — last_active NOT written to localStorage  
**Preconditions:** User on login page  
**Steps:**
1. Check "Remember me"
2. Log in
**Expected Result:** `hrhandle_remember_me = 'true'` in localStorage; `hrhandle_last_active` NOT set  
**Priority:** Medium  
**Type:** Unit

---

## Onboarding

### TC-018
**Feature:** Onboarding  
**Description:** New user without organization is onboarded on first dashboard visit  
**Preconditions:** User confirmed email but has no organization  
**Steps:**
1. Log in as new user
2. Navigate to `/dashboard`
**Expected Result:** `runOnboarding()` creates organization, profile (role=owner), subscription (trial), and seed data; user sees dashboard  
**Priority:** Critical  
**Type:** Integration

---

### TC-019
**Feature:** Onboarding  
**Description:** Onboarding is idempotent — second visit does not duplicate data  
**Preconditions:** User already onboarded  
**Steps:**
1. Log in
2. Navigate to `/dashboard` multiple times
**Expected Result:** No duplicate organizations or profiles created  
**Priority:** High  
**Type:** Integration

---

### TC-020
**Feature:** Onboarding / Invitation  
**Description:** User accepting an invitation skips regular onboarding  
**Preconditions:** User has an invite_token in user metadata  
**Steps:**
1. User clicks invitation link in email
2. Signs up or logs in
3. Dashboard layout detects invite_token and calls acceptInvitation instead of runOnboarding
**Expected Result:** User joins the inviting organization as the invited role; no new org created  
**Priority:** Critical  
**Type:** Integration

---

## Vacancies

### TC-021
**Feature:** Vacancies / Create  
**Description:** Create vacancy with all required fields  
**Preconditions:** User authenticated, on vacancies page  
**Steps:**
1. Click "New Vacancy"
2. Fill in title (required), sector, description
3. Submit
**Expected Result:** Vacancy created with status "draft"; appears in vacancies list  
**Priority:** Critical  
**Type:** Integration

---

### TC-022
**Feature:** Vacancies / Create  
**Description:** Vacancy title is required  
**Preconditions:** User on create vacancy form  
**Steps:**
1. Leave title empty
2. Submit form
**Expected Result:** Validation error: title is required  
**Priority:** High  
**Type:** Unit

---

### TC-023
**Feature:** Vacancies / Create  
**Description:** Salary max must be >= salary min  
**Preconditions:** User on create vacancy form  
**Steps:**
1. Set salary_min = 5000
2. Set salary_max = 4000
3. Submit
**Expected Result:** Validation error on salary range  
**Priority:** High  
**Type:** Unit

---

### TC-024
**Feature:** Vacancies / Create  
**Description:** End date must be >= start date  
**Preconditions:** User on create vacancy form  
**Steps:**
1. Set start_date = today
2. Set end_date = yesterday
3. Submit
**Expected Result:** Validation error on date range  
**Priority:** High  
**Type:** Unit

---

### TC-025
**Feature:** Vacancies / Create  
**Description:** Plan limit enforced — cannot create vacancy over plan limit  
**Preconditions:** User on trial plan with 5-vacancy limit, already has 5 active vacancies  
**Steps:**
1. Attempt to create a 6th vacancy
**Expected Result:** Error message about plan limit; vacancy not created  
**Priority:** High  
**Type:** Integration

---

### TC-026
**Feature:** Vacancies / Edit  
**Description:** Update vacancy title and save  
**Preconditions:** Vacancy exists  
**Steps:**
1. Open vacancy edit form
2. Change title
3. Save
**Expected Result:** Vacancy title updated; shown in list  
**Priority:** High  
**Type:** Integration

---

### TC-027
**Feature:** Vacancies / Delete  
**Description:** Delete (soft-delete) a vacancy  
**Preconditions:** Vacancy exists  
**Steps:**
1. Open vacancy options
2. Click delete / archive
3. Confirm
**Expected Result:** Vacancy no longer appears in active list (deleted_at set)  
**Priority:** High  
**Type:** Integration

---

### TC-028
**Feature:** Vacancies / Public Page  
**Description:** show_on_public_page=true makes vacancy appear on public jobs page  
**Preconditions:** Vacancy exists with status=active  
**Steps:**
1. Set show_on_public_page=true
2. Navigate to `/jobs/{org-slug}`
**Expected Result:** Vacancy appears in public listing  
**Priority:** High  
**Type:** E2E

---

### TC-029
**Feature:** Vacancies / Public Page  
**Description:** show_on_public_page=false hides vacancy from public jobs page  
**Preconditions:** Vacancy exists  
**Steps:**
1. Set show_on_public_page=false
2. Navigate to `/jobs/{org-slug}`
**Expected Result:** Vacancy does NOT appear in public listing  
**Priority:** High  
**Type:** E2E

---

## Candidates

### TC-030
**Feature:** Candidates / Create  
**Description:** Create candidate with required fields  
**Preconditions:** User authenticated  
**Steps:**
1. Navigate to candidates
2. Click "Add Candidate"
3. Fill first_name, last_name
4. Submit
**Expected Result:** Candidate created and appears in candidates list  
**Priority:** Critical  
**Type:** Integration

---

### TC-031
**Feature:** Candidates / Create  
**Description:** Email must be valid format if provided  
**Preconditions:** User on add candidate form  
**Steps:**
1. Enter "notanemail" in email field
2. Submit
**Expected Result:** Validation error on email field  
**Priority:** High  
**Type:** Unit

---

### TC-032
**Feature:** Candidates / Create  
**Description:** Empty email is accepted (optional)  
**Preconditions:** User on add candidate form  
**Steps:**
1. Leave email field empty
2. Fill required fields
3. Submit
**Expected Result:** Candidate created with null email  
**Priority:** High  
**Type:** Unit

---

### TC-033
**Feature:** Candidates / Create  
**Description:** LinkedIn URL must be valid URL if provided  
**Preconditions:** User on add candidate form  
**Steps:**
1. Enter "not-a-url" in linkedin_profile_url
2. Submit
**Expected Result:** Validation error on LinkedIn URL  
**Priority:** Medium  
**Type:** Unit

---

### TC-034
**Feature:** Candidates / Create  
**Description:** Date of birth must be at least 16 years in the past  
**Preconditions:** User on add candidate form  
**Steps:**
1. Enter a date of birth less than 16 years ago (e.g., 10 years ago)
2. Submit
**Expected Result:** Validation error — candidate must be at least 16  
**Priority:** High  
**Type:** Unit

---

### TC-035
**Feature:** Candidates / Create  
**Description:** Years of experience must be between 0 and 60  
**Preconditions:** User on add candidate form  
**Steps:**
1. Enter years_of_experience = 61
2. Submit
**Expected Result:** Validation error (max 60)  
**Priority:** Medium  
**Type:** Unit

---

### TC-036
**Feature:** Candidates / Create  
**Description:** Plan limit enforced — cannot add candidate over plan limit  
**Preconditions:** Trial plan, 100-candidate limit already reached  
**Steps:**
1. Attempt to add a new candidate
**Expected Result:** Error message about plan limit  
**Priority:** High  
**Type:** Integration

---

### TC-037
**Feature:** Candidates / Edit  
**Description:** Update candidate details  
**Preconditions:** Candidate exists  
**Steps:**
1. Open candidate profile
2. Edit phone number
3. Save
**Expected Result:** Phone number updated  
**Priority:** High  
**Type:** Integration

---

### TC-038
**Feature:** Candidates / Delete  
**Description:** Soft-delete a candidate  
**Preconditions:** Candidate exists  
**Steps:**
1. Open candidate options
2. Click delete
3. Confirm
**Expected Result:** Candidate no longer appears in active list (deleted_at set)  
**Priority:** High  
**Type:** Integration

---

### TC-039
**Feature:** Candidates / Documents  
**Description:** Upload PDF document  
**Preconditions:** Candidate exists  
**Steps:**
1. Open candidate profile
2. Navigate to documents tab
3. Upload a valid PDF (< 10MB)
**Expected Result:** Document uploaded; appears in document list  
**Priority:** High  
**Type:** E2E

---

### TC-040
**Feature:** Candidates / Documents  
**Description:** Upload rejected if file > 10MB  
**Preconditions:** Candidate exists  
**Steps:**
1. Attempt to upload a file > 10MB
**Expected Result:** Error: file size exceeds limit  
**Priority:** High  
**Type:** Integration

---

### TC-041
**Feature:** Candidates / Documents  
**Description:** Upload rejected for unsupported file type  
**Preconditions:** Candidate exists  
**Steps:**
1. Attempt to upload a .exe or .txt file
**Expected Result:** Error: unsupported file type  
**Priority:** High  
**Type:** Integration

---

### TC-042
**Feature:** Candidates / Documents  
**Description:** Download signed URL generates correctly  
**Preconditions:** Candidate has at least one document  
**Steps:**
1. Click download on a document
**Expected Result:** Signed URL generated; file downloads  
**Priority:** High  
**Type:** Integration

---

## Applications

### TC-043
**Feature:** Applications / Create  
**Description:** Add application — link candidate to vacancy  
**Preconditions:** At least one candidate and one vacancy exist  
**Steps:**
1. Navigate to vacancy applications tab
2. Add candidate to vacancy
**Expected Result:** Application created with initial status  
**Priority:** Critical  
**Type:** Integration

---

### TC-044
**Feature:** Applications / Status  
**Description:** Moving application to "hired" sets candidate general_status to "hired"  
**Preconditions:** Application exists  
**Steps:**
1. Change application status to "hired"
**Expected Result:** Candidate's general_status_id updated to "hired"  
**Priority:** High  
**Type:** Integration

---

### TC-045
**Feature:** Applications / Status  
**Description:** Moving application away from "hired" (no other hired application) reverts candidate to "active"  
**Preconditions:** Candidate has one application with status "hired"  
**Steps:**
1. Change that application status from "hired" to another status
**Expected Result:** Candidate's general_status_id reverts to "active"  
**Priority:** High  
**Type:** Integration

---

### TC-046
**Feature:** Applications / Status  
**Description:** Moving application away from "hired" when another application is "hired" keeps candidate as "hired"  
**Preconditions:** Candidate has two applications both in "hired" status  
**Steps:**
1. Change one application away from "hired"
**Expected Result:** Candidate remains "hired" (second hired application still active)  
**Priority:** Medium  
**Type:** Integration

---

### TC-047
**Feature:** Applications / Export  
**Description:** Export applications for a vacancy as CSV  
**Preconditions:** Vacancy has applications  
**Steps:**
1. Navigate to vacancy applications tab
2. Click "Export CSV"
**Expected Result:** CSV file downloaded with columns: First Name, Last Name, Email, Phone, LinkedIn, Application Status, Source, Applied At  
**Priority:** Medium  
**Type:** E2E

---

## Interviews

### TC-048
**Feature:** Interviews / Create  
**Description:** Create phone interview with valid data  
**Preconditions:** Application exists  
**Steps:**
1. Navigate to interviews
2. Create interview: select candidate, vacancy, type=phone, scheduled_at=future, duration=60
**Expected Result:** Interview created; appears in interviews list  
**Priority:** Critical  
**Type:** Integration

---

### TC-049
**Feature:** Interviews / Create  
**Description:** Interview scheduled_at must be in the future  
**Preconditions:** User on create interview form  
**Steps:**
1. Set scheduled_at to a past date/time
2. Submit
**Expected Result:** Validation error — must be in the future  
**Priority:** High  
**Type:** Unit

---

### TC-050
**Feature:** Interviews / Create  
**Description:** Duration must be between 15 and 480 minutes  
**Preconditions:** User on create interview form  
**Steps:**
1. Set duration_minutes = 10
2. Submit
**Expected Result:** Validation error (min 15)  
**Priority:** High  
**Type:** Unit

---

### TC-051
**Feature:** Interviews / Create  
**Description:** Duration of 481 minutes is rejected  
**Preconditions:** User on create interview form  
**Steps:**
1. Set duration_minutes = 481
2. Submit
**Expected Result:** Validation error (max 480)  
**Priority:** Medium  
**Type:** Unit

---

### TC-052
**Feature:** Interviews / Google Calendar  
**Description:** Create Google Meet interview when Google Calendar connected  
**Preconditions:** User has connected Google Calendar in Settings  
**Steps:**
1. Create interview with type=video
2. Google Meet link generated
**Expected Result:** Interview created; meeting_link contains a Google Meet URL; event appears in Google Calendar  
**Priority:** High  
**Type:** Integration

---

### TC-053
**Feature:** Interviews / Zoom  
**Description:** Create Zoom interview when Zoom connected  
**Preconditions:** User has connected Zoom in Settings  
**Steps:**
1. Create interview with type=video
2. Zoom meeting created
**Expected Result:** Interview created; meeting_link contains Zoom join URL  
**Priority:** High  
**Type:** Integration

---

### TC-054
**Feature:** Interviews / Microsoft Teams  
**Description:** Create Teams interview when Microsoft connected  
**Preconditions:** User has connected Microsoft in Settings  
**Steps:**
1. Create interview with type=video
2. Teams meeting created
**Expected Result:** Interview created; meeting_link contains Teams join URL  
**Priority:** High  
**Type:** Integration

---

### TC-055
**Feature:** Interviews / Email  
**Description:** Interview creation sends email notification  
**Preconditions:** Interview created, candidate has email  
**Steps:**
1. Create interview with candidate who has email
**Expected Result:** Email sent to candidate and/or org members (email failure is non-fatal)  
**Priority:** Medium  
**Type:** Integration

---

## Team Management

### TC-056
**Feature:** Team / Invite  
**Description:** Owner can invite a new team member  
**Preconditions:** User is owner, plan allows more members  
**Steps:**
1. Navigate to Settings > Team
2. Click "Invite Member"
3. Enter email and select role
4. Send invitation
**Expected Result:** Invitation created; email sent with invitation link  
**Priority:** Critical  
**Type:** Integration

---

### TC-057
**Feature:** Team / Invite  
**Description:** Member limit enforced — cannot invite beyond plan limit  
**Preconditions:** Trial plan (limit=3), already at 3 members  
**Steps:**
1. Attempt to invite a new member
**Expected Result:** Error message about member limit  
**Priority:** High  
**Type:** Integration

---

### TC-058
**Feature:** Team / Accept Invitation  
**Description:** Invited user can accept invitation and join organization  
**Preconditions:** Invitation email received  
**Steps:**
1. Click invitation link in email
2. Sign up (if new user) or log in
3. Dashboard detects invite_token and calls acceptInvitation
**Expected Result:** User added to organization with invited role  
**Priority:** Critical  
**Type:** E2E

---

### TC-059
**Feature:** Team / Accept Invitation  
**Description:** acceptInvitation handles user with no existing profile row  
**Preconditions:** New user accepted invite (profile row may not exist yet)  
**Steps:**
1. New user accepts invitation
**Expected Result:** Profile row created via upsert (not update) — no error  
**Priority:** High  
**Type:** Integration

---

### TC-060
**Feature:** Team / Roles  
**Description:** Non-owner cannot invite team members  
**Preconditions:** User is logged in with "member" role  
**Steps:**
1. Navigate to Settings > Team
2. Attempt to invite a new member
**Expected Result:** Action blocked; permission error  
**Priority:** High  
**Type:** Integration

---

### TC-061
**Feature:** Team / Remove Member  
**Description:** Owner can remove a team member  
**Preconditions:** At least 2 members in organization  
**Steps:**
1. Navigate to Settings > Team
2. Click remove on a member
3. Confirm
**Expected Result:** Member removed from organization  
**Priority:** High  
**Type:** Integration

---

## Notifications

### TC-062
**Feature:** Notifications  
**Description:** Notification created when public apply form submitted  
**Preconditions:** Organization has owners/admins, notifications table exists  
**Steps:**
1. Submit public apply form
**Expected Result:** Notification record inserted for org owners/admins  
**Priority:** High  
**Type:** Integration

---

### TC-063
**Feature:** Notifications  
**Description:** Notification failure is non-fatal  
**Preconditions:** Notifications table does not exist or query fails  
**Steps:**
1. Submit public apply form
**Expected Result:** Application created successfully despite notification failure  
**Priority:** Medium  
**Type:** Integration

---

### TC-064
**Feature:** Notifications  
**Description:** Notifications appear in the notifications panel  
**Preconditions:** User has unread notifications  
**Steps:**
1. Open notifications panel
**Expected Result:** Unread notifications listed  
**Priority:** Medium  
**Type:** E2E

---

## Public Jobs Page

### TC-065
**Feature:** Public Jobs / Listing  
**Description:** Public jobs page shows active vacancies with show_on_public_page=true  
**Preconditions:** Organization has active vacancies  
**Steps:**
1. Navigate to `/jobs/{org-public-slug}`
**Expected Result:** Active vacancies with public flag shown; draft/archived vacancies hidden  
**Priority:** Critical  
**Type:** E2E

---

### TC-066
**Feature:** Public Jobs / Listing  
**Description:** Public jobs page accessible via UUID token (backward compatibility)  
**Preconditions:** Old public_page_token (UUID) exists for organization  
**Steps:**
1. Navigate to `/jobs/{uuid-token}`
**Expected Result:** Public jobs page loads correctly  
**Priority:** Medium  
**Type:** E2E

---

### TC-067
**Feature:** Public Jobs / Vacancy Detail  
**Description:** Clicking a vacancy shows vacancy detail and apply button  
**Preconditions:** Vacancy is publicly listed  
**Steps:**
1. Navigate to public jobs page
2. Click a vacancy
**Expected Result:** Vacancy detail shown with apply CTA  
**Priority:** High  
**Type:** E2E

---

## Public Apply Form

### TC-068
**Feature:** Public Apply / Submit  
**Description:** Valid application submission succeeds  
**Preconditions:** Public vacancy exists  
**Steps:**
1. Navigate to `/apply/{vacancy-id}`
2. Fill first_name, last_name, email
3. Complete Turnstile CAPTCHA
4. Submit
**Expected Result:** Application created; confirmation message shown; confirmation email sent to applicant  
**Priority:** Critical  
**Type:** E2E

---

### TC-069
**Feature:** Public Apply / Rate Limit  
**Description:** More than 5 submissions from same IP in one hour are blocked  
**Preconditions:** 5 submissions already made from this IP in the last hour  
**Steps:**
1. Submit a 6th application
**Expected Result:** Rate limit error returned  
**Priority:** High  
**Type:** Integration

---

### TC-070
**Feature:** Public Apply / Duplicate  
**Description:** Same email applying to same vacancy again is silently accepted  
**Preconditions:** Candidate already applied to vacancy  
**Steps:**
1. Submit apply form with same email for same vacancy
**Expected Result:** Success message shown (no error); no duplicate application created  
**Priority:** High  
**Type:** Integration

---

### TC-071
**Feature:** Public Apply / Max Applications  
**Description:** Vacancy with 500+ applications rejects new submissions  
**Preconditions:** Vacancy has 500 non-deleted applications  
**Steps:**
1. Submit apply form for that vacancy
**Expected Result:** Error shown (vacancy at capacity)  
**Priority:** Medium  
**Type:** Integration

---

### TC-072
**Feature:** Public Apply / Honeypot  
**Description:** Bots filling the `website` honeypot field are silently rejected  
**Preconditions:** None  
**Steps:**
1. Submit apply form with non-empty `website` field
**Expected Result:** Response appears successful but no application is created  
**Priority:** Medium  
**Type:** Integration

---

### TC-073
**Feature:** Public Apply / CV Upload  
**Description:** Applicant can upload a CV (PDF/Word)  
**Preconditions:** Public vacancy exists  
**Steps:**
1. Submit apply form with a valid PDF CV file attached
**Expected Result:** Application created; CV stored in candidate-documents bucket  
**Priority:** High  
**Type:** E2E

---

### TC-074
**Feature:** Public Apply / Turnstile  
**Description:** Submission without Turnstile token is rejected  
**Preconditions:** None  
**Steps:**
1. Submit apply form without completing Turnstile
**Expected Result:** Server-side validation error; application not created  
**Priority:** High  
**Type:** Integration

---

## Settings

### TC-075
**Feature:** Settings / Profile  
**Description:** User can update display name and avatar  
**Preconditions:** User authenticated  
**Steps:**
1. Navigate to Settings > Profile
2. Change display name
3. Save
**Expected Result:** Profile updated; name change reflected in UI  
**Priority:** Medium  
**Type:** E2E

---

### TC-076
**Feature:** Settings / Organization  
**Description:** Owner can update organization name and slug  
**Preconditions:** User is owner  
**Steps:**
1. Navigate to Settings > Organization
2. Change org name
3. Save
**Expected Result:** Organization updated  
**Priority:** Medium  
**Type:** E2E

---

### TC-077
**Feature:** Settings / Custom Fields  
**Description:** Owner can create a custom field for candidates  
**Preconditions:** User is owner  
**Steps:**
1. Navigate to Settings > Custom Fields
2. Add new field (name, type)
3. Save
**Expected Result:** Custom field appears in candidate form  
**Priority:** Medium  
**Type:** E2E

---

### TC-078
**Feature:** Settings / Email Templates  
**Description:** Rejection template variables are substituted correctly  
**Preconditions:** Rejection template exists with {{candidate_name}} variable  
**Steps:**
1. Send rejection using template
2. Recipient receives email
**Expected Result:** {{candidate_name}} replaced with actual candidate name; HTML special characters escaped  
**Priority:** High  
**Type:** Integration

---

### TC-079
**Feature:** Settings / Email Templates  
**Description:** Missing template variable substituted with empty string  
**Preconditions:** Template has {{missing_var}} placeholder  
**Steps:**
1. Apply template without providing missing_var in vars map
**Expected Result:** {{missing_var}} replaced with empty string (not left as-is)  
**Priority:** Medium  
**Type:** Unit

---

### TC-080
**Feature:** Settings / Google Calendar  
**Description:** Connect Google Calendar via OAuth  
**Preconditions:** Google OAuth configured  
**Steps:**
1. Navigate to Settings > Integrations
2. Click "Connect Google Calendar"
3. Authorize in Google
**Expected Result:** Redirected to `/settings?google=connected`; tokens stored  
**Priority:** High  
**Type:** E2E

---

### TC-081
**Feature:** Settings / Google Calendar  
**Description:** Disconnect Google Calendar clears tokens  
**Preconditions:** Google Calendar connected  
**Steps:**
1. Click "Disconnect Google Calendar"
**Expected Result:** Redirected to `/settings?google=disconnected`; tokens cleared from profile  
**Priority:** Medium  
**Type:** E2E

---

### TC-082
**Feature:** Settings / Zoom  
**Description:** Connect Zoom via OAuth  
**Preconditions:** Zoom OAuth configured  
**Steps:**
1. Navigate to Settings > Integrations
2. Click "Connect Zoom"
3. Authorize in Zoom
**Expected Result:** Redirected to `/settings?zoom=connected`; tokens stored  
**Priority:** High  
**Type:** E2E

---

### TC-083
**Feature:** Settings / Microsoft  
**Description:** Connect Microsoft via OAuth  
**Preconditions:** Microsoft OAuth configured  
**Steps:**
1. Navigate to Settings > Integrations
2. Click "Connect Microsoft"
3. Authorize with Microsoft
**Expected Result:** Redirected to `/settings/integrations?microsoft=connected`; tokens stored  
**Priority:** High  
**Type:** E2E

---

### TC-084
**Feature:** Settings / Billing  
**Description:** Subscription status shown correctly  
**Preconditions:** User on trial plan  
**Steps:**
1. Navigate to Settings > Billing
**Expected Result:** Trial status shown with remaining days and limits  
**Priority:** Medium  
**Type:** E2E

---

## Data Isolation

### TC-085
**Feature:** Multi-tenancy  
**Description:** User cannot access another organization's data  
**Preconditions:** Two separate organizations exist  
**Steps:**
1. Log in as user from Org A
2. Attempt to access a candidate UUID belonging to Org B
**Expected Result:** 404 or empty result — RLS blocks cross-org access  
**Priority:** Critical  
**Type:** Integration

---

## Export

### TC-086
**Feature:** Export / Candidates  
**Description:** Export all candidates as CSV  
**Preconditions:** Organization has candidates  
**Steps:**
1. Navigate to Candidates
2. Click "Export CSV"
**Expected Result:** CSV downloaded with columns: First Name, Last Name, Email, Phone, Company, Position, Years Experience, Source, LinkedIn, Added  
**Priority:** Medium  
**Type:** E2E

---

## Cron

### TC-087
**Feature:** Cron / Expire Vacancies  
**Description:** Vacancies past end date are archived by cron job  
**Preconditions:** Vacancy with end_date in the past exists  
**Steps:**
1. Call `GET /api/cron/expire-vacancies` with valid `CRON_SECRET` header
**Expected Result:** Response 200 `{ ok: true }`; vacancy archived  
**Priority:** High  
**Type:** Integration

---

### TC-088
**Feature:** Cron / Expire Vacancies  
**Description:** Cron endpoint rejects requests without valid secret  
**Preconditions:** None  
**Steps:**
1. Call `GET /api/cron/expire-vacancies` without Authorization header (or with wrong secret)
**Expected Result:** 401 Unauthorized  
**Priority:** High  
**Type:** Integration

---

## Health

### TC-089
**Feature:** Health Check  
**Description:** Health endpoint returns 200 when database is reachable  
**Preconditions:** Database connected  
**Steps:**
1. Call `GET /api/health`
**Expected Result:** `{ status: "ok", checks: { database: "ok" } }`  
**Priority:** Medium  
**Type:** Integration

---

### TC-090
**Feature:** Health Check  
**Description:** Health endpoint returns 503 when database is unreachable  
**Preconditions:** Database unavailable  
**Steps:**
1. Call `GET /api/health`
**Expected Result:** `{ status: "degraded", checks: { database: "error" } }` with HTTP 503  
**Priority:** Medium  
**Type:** Integration
