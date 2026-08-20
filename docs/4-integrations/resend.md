# Resend Email Integration

_Last updated: 2026-05-08_

## Changelog

- 🔄 No code changes since previous audit. Send failures still log via `console.error` and are non-fatal (caller continues). See `M-silent-email-failures` for the suggestion to wire these into Sentry.

---

## Overview

Transactional emails are sent via the [Resend](https://resend.com) API. The `resend` npm package (v6.12.2) is used. All email sending is server-side only.

Sender address for org-branded emails: `{senderName} <noreply@hrhandle.com>`
Sender address for system emails: `HRHandle <noreply@hrhandle.com>`

DKIM/SPF/DMARC for `hrhandle.com` is verified in Resend. The same domain is configured as the SMTP sender in Supabase for auth emails (see `docs/4-integrations/supabase.md`).

## Environment Variable

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend API key. Optional in `lib/env.ts` but required at runtime for email sending. |

The `getResend()` helper in `lib/email.ts` throws `Error('RESEND_API_KEY is not set')` at call time if the key is missing. Email failures in actions are caught and treated as non-fatal (interview was created, status was updated, etc.).

## Email Types

### 1. Team Invitation (`sendTeamInviteEmail`)

**Trigger:** `inviteTeamMember()` in `lib/actions/invitations.ts`
**From:** `HRHandle <noreply@hrhandle.com>`
**To:** The invited email address
**Subject:** `{inviterName} invited you to join {organizationName} on HRHandle`
**Content:** Join URL (`{BASE_URL}/join?token={token}`), role label (Admin/Member), 7-day expiry notice
**No template variables** — content is hardcoded in `lib/email.ts`

### 2. Interview Invitation (`sendInterviewInvitationEmail`)

**Trigger:** `createInterview()` and `rescheduleInterview()` in `lib/actions/interviews.ts`
**From:** `{senderName} <noreply@hrhandle.com>` (Reply-To: `senderEmail`)
**To:** Candidate's email
**Subject:** From email template or default `Interview Invitation — {{role}} at {{company}}`
**Variables available:** `candidate_name`, `role`, `company`, `interview_date`, `interview_time`, `meeting_link`, `interviewer_name`
**Content includes:** Date, time (formatted with timezone), duration, interview type label, optional meeting link button
**Rescheduled:** Subject overridden to `Interview Rescheduled: {vacancyTitle}`, heading changes to "Interview Rescheduled"

### 3. Application Confirmation (`sendApplicationConfirmationEmail`)

**Trigger:** `submitPublicApplication()` in `lib/actions/public-apply.ts`
**From:** `HRHandle <noreply@hrhandle.com>`
**To:** Applicant's email
**Subject:** From email template or default `You applied for {{role}} at {{company}}`
**Variables available:** `candidate_name`, `role`, `company`
**Content:** Confirmation message, reply-not instructions

### 4. Application Rejection (`sendApplicationRejectionEmail`)

**Trigger:** `rejectApplication()` in `lib/actions/applications.ts`
**From:** `{senderName} <noreply@hrhandle.com>` (Reply-To: `senderEmail`)
**To:** Candidate's email
**Subject:** From custom override, stored rejection template, or default `An update from {{company}} — {{role}}`
**Variables available:** `candidate_name`, `role`, `company`
**Content:** Rejection message, contact info for follow-up

## Template Variable System

### `applyVariables(text, vars)` — `lib/email-template-utils.ts`

Replaces `{{variable_name}}` placeholders in a string:

```ts
applyVariables('Hi {{candidate_name}}', { candidate_name: 'Alice' })
// → 'Hi Alice'
```

- Regex: `/\{\{(\w+)\}\}/g`
- Missing variables: replaced with empty string (`vars[key] ?? ''`)
- All substituted values are HTML-escaped via `escapeHtml()`
- Keys must match word characters only (`\w+`)

### `escapeHtml(str)` — `lib/email-template-utils.ts`

Escapes HTML special characters: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`, `'` → `&#x27;`.

### `DEFAULT_TEMPLATES` — `lib/email-template-utils.ts`

Built-in fallback templates for all three email types:

| Template Type | Default Subject | Default Body |
|---|---|---|
| `application_received` | `You applied for {{role}} at {{company}}` | "We have received your details and will review them shortly..." |
| `interview_invitation` | `Interview Invitation — {{role}} at {{company}}` | "You have been invited to an interview for the {{role}} position..." |
| `rejection` | `An update from {{company}} — {{role}}` | "After careful consideration, we have decided to move forward with other candidates..." |

### `resolveTemplate(saved, type)`

Returns the saved org-specific template if it exists, otherwise the matching default.

## Subject/Body Resolution for Rejection Emails

Rejection emails apply a three-level override:
1. Custom subject/body passed directly from the caller (e.g. edited in the dialog)
2. Template stored in `rejection_templates` table (looked up by `templateId`)
3. Built-in default from `DEFAULT_TEMPLATES.rejection`

**Localization of the seeded default (#8).** Onboarding seeds a "General"
`rejection_templates` row with the default subject/body. Both the send path
(`rejection-actions.ts`) and the settings display (`getRejectionTemplates`)
detect an untouched default via `isDefaultTemplateContentAnyLocale` and swap it
for `defaultTemplate('rejection', orgContentLocale)` — so an org whose content
language is Georgian sees, and sends, the Georgian default even though the
stored seed is English. Once the recruiter edits the template, it's kept
verbatim. Self-healing: no migration; follows the org's current content locale.

## Relevant Files

- `lib/email.ts` — all four `send*` functions, HTML templates
- `lib/email-template-utils.ts` — `TemplateType`, `EmailTemplate`, `DEFAULT_TEMPLATES`, `resolveTemplate`, `escapeHtml`, `applyVariables`, `DEFAULT_REJECTION_SUBJECT`, `DEFAULT_REJECTION_BODY`

## Supabase Auth Email (SMTP)

Supabase auth emails (signup confirmation, password reset, magic link) are also delivered via Resend, but through Supabase's SMTP configuration — not the `resend` npm package. Config: host `smtp.resend.com`, port `465`, username `resend`, sender `HRHandle <noreply@hrhandle.com>`.
