# Records of Processing Activities (ROPA)

_Last updated: 2026-07-21_
_Owner: Aleksandre Merabishvili (sole founder + DPO)_
_GDPR reference: Article 30_

## Document control

- **Tracked as:** [G-005](../issues-found.md)
- **Review cadence:** at every release that adds or changes a processing activity, and at least quarterly
- **🆕 (2026-07-21 audit) Deltas to formally incorporate on next review:** (1) **2FA/TOTP + recovery codes** (G-032, shipped 2026-06-25) — new authentication data; added to activity C-1 below. (2) New **sub-processors / recipients**: **Calendly** (USA — interview scheduling when a customer connects it, G-031) and customer-configured **Slack / Microsoft Teams** incoming webhooks (G-030) that deliver notification metadata to the customer's own workspace. These should be reflected in the relevant interview/notification activity rows + the sub-processor register.
- **Related docs:** [`app/privacy/page.tsx`](../../app/privacy/page.tsx) · [breach response](./breach-response.md) · [`docs/3-architecture/`](../3-architecture/) · [`docs/4-integrations/`](../4-integrations/) · [`docs/issues-found.md`](../issues-found.md)

## Why HRHandle keeps a ROPA

GDPR Article 30(5) exempts orgs with under 250 employees, *unless* the processing:
- is likely to result in a risk to the rights and freedoms of data subjects, **or**
- is not occasional, **or**
- includes special categories of data under Art. 9 or criminal-conviction data.

HRHandle's processing meets all three triggers (continuous candidate data processing; CV contents can incidentally include Art. 9 special categories such as health, religion, trade-union membership), so the exemption does not apply.

## Two-role disclosure

HRHandle wears two distinct controller/processor hats. Each is captured separately below to match Art. 30(1) (controller record) and Art. 30(2) (processor record).

| Role | Data category | This document section |
|---|---|---|
| **Controller** | Account holders, team members, organisation configuration, billing, product telemetry | [Section 1](#section-1--controller-activities-art-301) |
| **Processor** (on behalf of each customer) | Candidate data, application data, interview data, custom fields | [Section 2](#section-2--processor-activities-art-302) |

## Controller / processor contact details (Art. 30(1)(a) / 30(2)(a))

| Field | Value |
|---|---|
| Name | Aleksandre Merabishvili, Individual Entrepreneur |
| Registration number | 01019062001 |
| Address | Tbilisi, Georgia |
| Contact | hrhandle26@gmail.com |
| DPO | Aleksandre Merabishvili (no formal DPO designation required at current scale; sole founder acts as the point of contact) |
| EU representative (Art. 27) | **Not yet appointed.** Required before public marketing to EU markets — tracked in the audit plan. |
| Supervisory authority | Georgian Personal Data Protection Service (and, once an EU representative is appointed, the relevant lead supervisory authority in the EU) |

---

# Section 1 — Controller activities (Art. 30(1))

For each activity: purpose, legal basis, data subject categories, personal data categories, recipients, retention, transfer mechanism, security reference.

## C-1 — Account creation, authentication, profile management

| Field | Value |
|---|---|
| Purpose | Allow recruiter accounts to sign up, sign in, recover passwords, and maintain their profile and organisation settings. |
| Legal basis (Art. 6) | (b) Contract performance — providing the Service the account holder signed up for. |
| Data subject categories | Recruiter account holders; team members invited into a customer organisation. |
| Personal data categories | Email address, full name, hashed password (for email/password sign-in), Supabase auth session tokens, Google or Microsoft OAuth identity (when used to sign in), avatar URL, organisation name, role assignment, sign-in preference; **TOTP two-factor factor (managed by Supabase Auth) and SHA-256-hashed recovery codes** (2FA, G-032 — raw codes never stored); language + notification preferences. |
| Recipients / sub-processors | Supabase Auth + Postgres (USA, AWS us-east-1); Resend (USA — sign-up confirmation, password reset emails); Cloudflare Turnstile (CAPTCHA verification). |
| Retention | Active for the life of the account. After account termination: 30-day export/recovery window, then permanent deletion ([Privacy §7](../../app/privacy/page.tsx)). Backups follow Supabase's standard retention. |
| Transfer mechanism | Standard Contractual Clauses with Supabase, Resend, Cloudflare. |
| Security (Art. 32) | TLS in transit; encryption at rest by Supabase; RLS on every public table; Turnstile on login + sign-up + forgot-password; per-request CSP nonce ([S-014 fix](../issues-found.md)); rate limits on auth endpoints ([S-002 / S-003 fixes](../issues-found.md)); optional **2FA/TOTP** with an owner-enforceable org-wide policy (G-032). |

## C-2 — Team invitations and membership management

| Field | Value |
|---|---|
| Purpose | Allow an organisation owner/admin to invite colleagues to their HRHandle organisation, track acceptance, and manage roles. |
| Legal basis (Art. 6) | (b) Contract performance. |
| Data subject categories | The recruiter sending the invitation; the recruiter receiving the invitation. |
| Personal data categories | Inviter user ID; invitee email address; invitation token; organisation reference; role; expiry timestamp; invitation status. |
| Recipients / sub-processors | Supabase Postgres; Resend (delivery of the invitation email). |
| Retention | Pending invitations expire automatically. Accepted / cancelled invitations retained for organisation audit until the parent organisation is deleted (then purged by the daily cron, [G-003](../issues-found.md)). |
| Transfer mechanism | SCCs (as C-1). |
| Security (Art. 32) | Per-user rate limit on invitation creation ([S-003 fix](../issues-found.md)); RLS scoped to organisation; invitation tokens are random and single-use. |

## C-3 — Subscription management and billing

| Field | Value |
|---|---|
| Purpose | Manage trial state, plan tier, billing cycle, payment status, plan limits. |
| Legal basis (Art. 6) | (b) Contract performance; (c) Legal obligation (Georgian tax and accounting requirements for invoicing records once billing is live). |
| Data subject categories | Account holders representing a paying customer organisation. |
| Personal data categories | Plan code; billing cycle; subscription status; trial timestamps; payment-provider order/subscription references; payment status. **No payment card details are stored** — card data is handled by the payment provider (Flitt) under PCI DSS. |
| Recipients / sub-processors | Supabase Postgres; **Flitt** (payment gateway, established in Georgia) — receives customer name, email, country, and payment details at checkout. HRHandle is the seller of record (Flitt is a gateway, **not** a Merchant of Record), so HRHandle carries sanctions-screening (see `docs/9-compliance/sanctions-screening.md`). |
| Retention | Active for the life of the subscription. Invoicing records retained for the period required by Georgian tax law (commonly 6 years; verify with your accountant once billing is live). Other subscription state retained per [Privacy §7](../../app/privacy/page.tsx). |
| Transfer mechanism | SCCs (as C-1). Flitt is established in Georgia; card data handled by Flitt under PCI DSS. |
| Security (Art. 32) | RLS; no payment card details in HRHandle's database; payment provider handles PCI scope. |

## C-4 — Product telemetry, error monitoring, and analytics

| Field | Value |
|---|---|
| Purpose | Understand product usage to improve the Service; detect and diagnose technical errors. |
| Legal basis (Art. 6) | (f) Legitimate interest — operating, securing, and improving the Service. Balancing test: telemetry uses person-profile-only-for-identified-users, no advertising/tracking cookies, no cross-site profiling; intrusion is minimal. |
| Data subject categories | Authenticated recruiter account holders (PostHog identifies them by Supabase user id only — no email/name on identify); anonymous visitors to public pages (no PostHog person profile created). |
| Personal data categories | Page views, click events, in-app product events ([`lib/analytics.ts`](../../lib/analytics.ts)); for Sentry: error stack traces, browser/OS, request metadata — scrubbed of names, emails, candidate data, OAuth tokens, IPs by [`lib/sentry-scrub.ts`](../../lib/sentry-scrub.ts) before send. |
| Recipients / sub-processors | PostHog (EU, `eu.i.posthog.com`); Vercel Analytics (US/global CDN, privacy-friendly, no cross-site cookies); Sentry (USA, PII-scrubbed). |
| Retention | PostHog and Vercel Analytics per provider's retention policy. Sentry stack traces per Sentry's retention. None retained beyond what providers offer. |
| Transfer mechanism | SCCs with Sentry and Vercel; PostHog is EU-cloud (no transfer). |
| Security (Art. 32) | PostHog `person_profiles: 'identified_only'`; Sentry `beforeSend` PII scrub ([S-007 fix](../issues-found.md)); Sentry Session Replay configured with `maskAllText` + `blockAllMedia`. |

## C-5 — Customer support correspondence

| Field | Value |
|---|---|
| Purpose | Respond to user-initiated emails about bugs, feature requests, billing, account questions, and GDPR rights requests. |
| Legal basis (Art. 6) | (b) Contract performance for existing customers; (f) Legitimate interest for prospects and general enquiries. |
| Data subject categories | Anyone who emails `hrhandle26@gmail.com`. |
| Personal data categories | Email address; the content of the message (which may contain whatever the sender chose to disclose). |
| Recipients / sub-processors | Google Workspace (the mailbox at gmail.com). |
| Retention | Email retained per the inbox owner's normal practice; tickets/threads relating to specific compliance requests retained at least until the matter is closed plus a reasonable audit period. |
| Transfer mechanism | SCCs with Google. |
| Security (Art. 32) | Strong account credentials, 2FA on the mailbox account. |

---

# Section 2 — Processor activities (Art. 30(2))

In Section 2, HRHandle acts **on behalf of each customer organisation**, who is the controller for the data. Customers' lawful basis for processing candidate data is their concern (typically Art. 6(1)(b) pre-contractual steps with the candidate, or 6(1)(f) legitimate interest), and HRHandle does not independently determine purposes. Customers are responsible for (a) confirming a lawful basis, (b) issuing privacy notices to candidates, and (c) responding to candidate rights requests. HRHandle assists each customer with those obligations where required.

The per-controller list (Art. 30(2)(a) requires naming each controller HRHandle processes for) is the live list of customer organisations in the `organizations` table. Snapshot it on request — it is not duplicated here to avoid stale data.

## P-1 — Candidate record management

| Field | Value |
|---|---|
| Categories of processing | Storing, organising, displaying, updating, exporting, **bulk-importing via CSV ([G-028](../issues-found.md))**, and deleting candidate records — names, contact, evaluation scores, recruiter notes — under the recruiter customer's direction. CSV import is admin-only at `/candidates/import`, parses files client-side, re-validates every row server-side, skips duplicate emails, and respects the candidate plan cap per batch. Imported records follow the same retention + RLS + audit rules as records entered through the manual form. **Scorecard sharing ([G-025](../issues-found.md))**: owners/admins can generate a token-gated public URL at `/scorecard/<token>` to share a candidate's evaluation answers + scores with a non-HRHandle stakeholder (typically a hiring manager who is not on the customer's team). The page exposes only the candidate's full name, role title, organisation name, recruiter-entered evaluation content, and the name + date of whoever first shared. It does NOT expose the candidate's contact information, application status, recruiter notes, AI-generated content, offer details, or audit trail. The token is revocable at any time, after which the URL stops working immediately. |
| Data subject categories | Candidates (job applicants and passive candidates added by recruiters). |
| Personal data categories | First and last name; email address; phone; LinkedIn URL; current company and position; years of experience; location; timezone; languages; salary expectation; notice period; source; general status; recruiter-authored notes (with optional `mentions` array of internal teammate ids tagged via @-mention — [G-021](../issues-found.md)); structured evaluation scores; application status history. |
| Sub-processors | Supabase Postgres (USA). |
| Retention | Active while the customer subscription is active. On candidate or document soft-delete, hard-deletion within 30 days by the [purge-deleted cron (G-003)](../issues-found.md). |
| Transfer mechanism | SCCs with Supabase. |
| Security (Art. 32) | RLS on every public table; organisation-scoped queries; signed URLs for document download; per-request CSP nonce; PII scrub on error reports. |

## P-2 — Public apply form intake

| Field | Value |
|---|---|
| Categories of processing | Receiving anonymous applications from candidates through the customer's public apply page, creating a candidate record + application record (with a per-application `public_token` for the candidate-facing status page — [G-016](../issues-found.md)), sending the candidate a confirmation email that includes the status-page link. Optionally (per-org opt-in per stage — [G-017](../issues-found.md)) sending a single transactional email when an application moves to "screening" or "interview", containing the role title, organisation name, and a link back to the candidate's status page. **Offers ([G-018](../issues-found.md))**: when a recruiter sends an offer, an `offers` row is created with a unique `public_token`; the candidate receives an email with a link to `/offer/<token>` where they review the structured terms (role title, optional compensation amount / currency / period, optional start and respond-by dates, plain-text body, optional recruiter note) and accept or decline directly. Decline can carry an optional free-text reason. Offer acceptance moves the application to "hired" via the same path as a recruiter-initiated status change. **Candidate self-withdraw ([G-022](../issues-found.md))**: the status page exposes a Withdraw button for non-terminal applications; on confirm, the application is moved to `withdrawn`, any active offer is automatically marked `withdrawn`, and recruiter owners + admins are notified. An optional free-text reason is stored alongside the audit row. |
| Data subject categories | Candidates applying via the public apply form. |
| Personal data categories | All of P-1 above, plus the **IP address** of the submitting browser, retained alongside the application for abuse-prevention purposes (see Privacy §2.4). The candidate is told this in the GDPR Art. 13 notice rendered above the submit button ([G-002](../issues-found.md)). The per-application `public_token` is an opaque 32-char hex string — not personal data on its own; combined with the URL it lets the holder view that one application's abstracted status. |
| Sub-processors | Supabase; Resend (confirmation email); Cloudflare Turnstile (CAPTCHA); Google Generative AI / Gemini (for P-3 below). |
| Retention | Same as P-1. IP address and `public_token` are deleted with the application record. |
| Transfer mechanism | SCCs (all sub-processors). |
| Security (Art. 32) | Turnstile invisible challenge on the form ([S-006 fix](../issues-found.md)); per-IP + per-vacancy rate limits; admin-client usage gated behind token verification ([S-010 rationale](../issues-found.md)). |

## P-3 — AI-assisted features via Google Gemini

> ℹ️ **[G-001](../issues-found.md) closed 2026-06-09** — billing is enabled on the Gemini account. The same API key now authenticates under Google's paid-services terms, which prohibit Google from using submitted prompts or responses to improve their models. Privacy Policy §5.1 has been updated to reflect this truthfully.

> 🎯 **Design principle:** every AI feature in HRHandle is **advisory only and explicitly triggered**. No auto-running, no auto-fill of stored fields, no automated decisions. See [`docs/9-compliance/ai-features.md`](./ai-features.md) for the full inventory, prompt-update policy, and EU AI Act mapping.

| Field | Value |
|---|---|
| Categories of processing | Sending candidate or vacancy data to Google's Gemini API on explicit recruiter request, to generate informational output (CV field extraction, professional summary, etc.) that the recruiter then reviews. No automated hiring decision is taken. Article 22 GDPR does not apply. |
| Current features | **CV parsing** (file → structured fields, via `/api/parse-cv`); **candidate summary** (button-triggered 2-3 sentence neutral summary, via `/api/ai/candidate-summary`); **JD generator** (button-triggered per-section job description draft, via `/api/ai/jd-generator` — vacancy-side, no candidate data sent); **interview question suggestions** (button-triggered categorised question set, via `/api/ai/interview-questions` — vacancy-side, no candidate data sent; optionally saved to `vacancies.interview_questions` JSONB column); **interview-note structuring** (recruiter pastes free-text notes → structured view via `/api/ai/note-extractor` — sends candidate name + role title + the pasted notes; output is not persisted unless recruiter explicitly saves as a candidate note); **inclusive-language check** (button-triggered review of vacancy text via `/api/ai/bias-check` — vacancy-side, no candidate data sent; output is a list of flagged passages with suggested replacements, never auto-applied); **assessment suggester** (button-triggered evaluation-criteria + open-ended-prompt suggestions for a vacancy via `/api/ai/assessment-suggester` — vacancy-side, no candidate data sent; recruiter adds items to the vacancy one-by-one via the existing `addVacancyQuestion` action). The **email drafter** (G-015) was retired on 2026-06-21; its route + code are removed. Historical `activity_log` rows with `feature: 'email_drafter'` are preserved as immutable audit history. |
| Data subject categories | Candidates whose CV is uploaded; candidates whose summary is requested by a recruiter. |
| Personal data categories | The candidate fields explicitly chosen for each feature. For CV parsing: full file contents (may include Art. 9 special categories if the candidate volunteered them). For candidate summary: name, current role/company, location, languages, work-history entries, education entries — **email, phone, LinkedIn URL, date of birth are NOT sent**. For assessment suggester, JD generator, interview questions, and inclusive-language check: vacancy text only — **no candidate data is sent**. |
| Sub-processors | Google Generative AI (Gemini API). |
| Retention | Google's paid-services terms: prompts and responses retained briefly for abuse detection only; not used for model training. AI output content is not persisted by HRHandle unless the recruiter explicitly chooses to (e.g. "Save as note" for note structuring, "Add" for assessment suggester). |
| Internal logging | Every AI feature invocation is logged in `activity_log` with `action: 'ai_assist'` and feature metadata, for EU AI Act traceability. The AI output content itself is not logged. |
| Transfer mechanism | SCCs with Google. The EU/UK/Switzerland safe-harbour clause in Google's Gemini API terms does not apply to a Georgian-registered controller. |
| Security (Art. 32) | API key kept server-side; no exposure to the browser; per-IP rate limit on `/api/parse-cv` (30/hr); per-org rate limit on the seven authenticated AI endpoints (100/hr each); authenticated endpoints (except the public apply-form CV parse) require an active session and a candidate/vacancy scoped to the user's organization. |

## P-4 — Interview scheduling and integration calendar events

| Field | Value |
|---|---|
| Categories of processing | Creating, updating, and cancelling interview events in the recruiter's connected Google Calendar / Microsoft Outlook Calendar (with Teams) / Zoom account, with the candidate as an invitee. Storing the resulting external event reference and any returned conferencing link inside the interview record. |
| Data subject categories | Candidates being interviewed; recruiter interviewers. |
| Personal data categories | Interview date/time; candidate's name and email (in the calendar invite); recruiter's identity; vacancy title; meeting link. |
| Sub-processors | Google Calendar / Google Meet; Microsoft Graph (Outlook Calendar + Teams); Zoom. |
| Retention | The HRHandle interview row follows the candidate-deletion lifecycle (purged via [G-003 cron](../issues-found.md)). The external calendar event lives in the recruiter's calendar account and is governed by the recruiter's own provider settings; HRHandle deletes the external event when the recruiter explicitly cancels in HRHandle. |
| Transfer mechanism | SCCs with each provider. |
| Security (Art. 32) | OAuth refresh tokens encrypted at rest by Supabase; least-scope OAuth (calendar.events for Google; Calendars.ReadWrite + OnlineMeetings.ReadWrite for Microsoft); state cookies for OAuth flow ([S-012 audited](../issues-found.md)); CSRF protection on connect/disconnect routes ([S-013 documented](../issues-found.md)). |

## P-5 — Custom field collection

| Field | Value |
|---|---|
| Categories of processing | Allowing the customer to define their own per-organisation fields (text, number, date, dropdown, etc.) and store values for those fields against candidates. HRHandle does not know the semantics of customer-defined fields. |
| Data subject categories | Candidates. |
| Personal data categories | Whatever the customer chooses to capture. The customer must ensure they have a lawful basis for any additional categories they define (the data processing agreement with the customer requires this once the DPA is in place). |
| Sub-processors | Supabase. |
| Retention | Custom field *values* follow the candidate lifecycle (P-1 retention). Custom field *definitions* persist until the customer deletes them; soft-deleted definitions are hard-deleted by the daily cron ([G-003](../issues-found.md)). |
| Transfer mechanism | SCCs with Supabase. |
| Security (Art. 32) | RLS scoped to organisation; per-field schema validation. |

---

# Appendix A — Sub-processor summary

The authoritative sub-processor list is in [Privacy Policy §5](../../app/privacy/page.tsx). The table below links each sub-processor to the activities that use it.

| Sub-processor | Activities | Role | Region |
|---|---|---|---|
| Supabase (Postgres + Storage + Auth) | C-1, C-2, C-3, C-4, P-1, P-2, P-4, P-5 | Database, storage, authentication | USA (AWS us-east-1) |
| Resend | C-1, C-2, P-2 | Transactional email | USA |
| Vercel + Vercel Analytics | All (hosting); C-4 (analytics) | Hosting, CDN, basic analytics | USA / Global |
| Sentry | C-4 | Error monitoring (PII-scrubbed) | USA |
| PostHog | C-4 | Product analytics | EU (eu.i.posthog.com) |
| Cloudflare Turnstile | C-1, P-2 | CAPTCHA | USA / Global |
| Google (OAuth, Calendar, Meet) | C-1 (sign-in), P-4 | Authentication and calendar integration | USA / Global |
| Google Generative AI (Gemini API) | P-3 | AI-assisted CV parsing + 7 other AI features (paid tier; no model-training use) | USA / Global |
| Microsoft (Graph, Outlook, Teams) | C-1 (sign-in), P-4 | Authentication and calendar integration | USA / Global |
| Zoom | P-4 | Video meeting creation | USA / Global |
| LinkedIn | (planned) | Vacancy posting | USA / Global |
| Flitt | C-3 | Payment processing (gateway) | Georgia |

---

# Appendix B — Cross-border transfer mechanisms

All current sub-processors are accessed under data processing agreements that incorporate Standard Contractual Clauses (SCCs), except PostHog which is on EU cloud and therefore involves no transfer for EU data subjects.

For each customer-controller's own SCC needs: HRHandle's DPA with the customer covers the onward-transfer position. The DPA itself is **not yet published** — tracked in the audit plan. Without a DPA, HRHandle's processor-side onward transfers do not have a clean contractual chain to point at when an EU customer's lawyer asks.

---

# Appendix C — Security measures (Art. 32(1))

Rather than duplicating the architecture, this appendix points to the canonical source for each measure.

| Measure | Where it lives |
|---|---|
| Encryption in transit (TLS) | Enforced by Vercel + Supabase + all sub-processors |
| Encryption at rest | Supabase standard; OAuth refresh tokens in `profiles` use Supabase's at-rest encryption |
| Authentication and session management | [`lib/supabase/*`](../../lib/supabase/) ; [CLAUDE.md auth-flows section](../../CLAUDE.md) |
| Row-level security on every public table | Verified via `pg_policies`; see [S-004 retraction in issues-found.md](../issues-found.md) |
| Per-request CSP nonce | [`lib/security-headers.ts`](../../lib/security-headers.ts) ; [S-014 fix](../issues-found.md) |
| CAPTCHA on public forms | Turnstile in `apply-form`, `sign-up-form`, `login`, `forgot-password` |
| Rate limiting (auth + invites + apply) | [S-002 / S-003 / S-005 / S-006 fixes](../issues-found.md) |
| Error reporting PII scrub | [`lib/sentry-scrub.ts`](../../lib/sentry-scrub.ts) ; [S-007 fix](../issues-found.md) |
| Audit log for sensitive actions | [`lib/audit-log.ts`](../../lib/audit-log.ts) ; [F-2 partial fix](../issues-found.md) |
| Soft-delete + 30-day hard purge | [`app/api/cron/purge-deleted/route.ts`](../../app/api/cron/purge-deleted/route.ts) ; [G-003](../issues-found.md) |
| Breach response | [`docs/9-compliance/breach-response.md`](./breach-response.md) ; [G-004](../issues-found.md) |

---

# Review log

| Date | Reviewer | Outcome | Changes since previous review |
|---|---|---|---|
| 2026-06-03 | Aleksandre Merabishvili | Initial creation | All sections written from scratch. Flagged G-001 (Gemini paid-tier deferral). Flagged EU representative gap. Flagged DPA gap. |
