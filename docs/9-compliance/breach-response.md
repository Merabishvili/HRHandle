# Breach Response Procedure

_Last updated: 2026-06-03_
_Owner: Aleksandre Merabishvili (sole founder + DPO)_

## Purpose

A practical playbook for what to do **the moment a personal data breach is suspected or confirmed** at HRHandle, written for a solo-founder reality (no 24/7 team). The goal is two things:

1. **Hit the 72-hour GDPR Article 33 clock** if reportable breach happens. The clock is short and unforgiving — this document exists so you don't have to think about *what* to do at 2am, only *that* it needs doing.
2. **Document every breach internally** even when no external notification is required, so that you have a record under Article 33(5) if a regulator ever asks.

When in doubt, **treat as a reportable breach until proven otherwise.** Under-reporting is the expensive failure mode; over-reporting is not.

---

## HRHandle's two roles

For breach response, HRHandle wears two hats depending on which data is involved. The notification rules differ.

| Data category | HRHandle's role | Who must HRHandle notify? |
|---|---|---|
| Account / profile data (recruiter accounts, login credentials, billing, OAuth tokens for connected calendars) | **Controller** | The competent supervisory authority directly, within 72 hours (Art. 33). Affected individuals if "high risk" (Art. 34). |
| Candidate data (candidates, CVs, applications, notes, interview records, custom field values, IP addresses of public applicants) | **Processor** on behalf of each customer organisation | The **customer** (controller) without undue delay (Art. 33(2)). The customer then decides whether to notify their supervisory authority. |

This split is mirrored in [Privacy Policy §1](../../app/privacy/page.tsx) and the apply-form notice ([G-002](../issues-found.md)).

---

## What counts as a "personal data breach"?

Per GDPR Article 4(12), a personal data breach is "a breach of security leading to the **accidental or unlawful destruction, loss, alteration, unauthorised disclosure of, or access to**, personal data."

Three things to remember:

- **It does not have to be malicious.** Accidentally emailing a CV to the wrong recruiter is a breach.
- **It does not have to involve outsiders.** A staff member accessing data without need-to-know is a breach.
- **Confidentiality, integrity, and availability all count.** A ransomware event that locks up the DB *without* exfiltration is still a breach (loss of availability).

---

## Concrete examples for an ATS

| Scenario | Breach? | Likely severity |
|---|---|---|
| A bug surfaces a signed URL for one candidate's CV to a different organisation's user | Yes | High (confidentiality of CV) |
| `SUPABASE_SERVICE_ROLE_KEY` leaks publicly (e.g. committed to GitHub) | Yes | Critical (every tenant exposed) |
| A laptop with active staging credentials is stolen | Yes | Medium–High (depending on session lifetime) |
| Sentry shows a stack trace containing a candidate's email (scrubbing missed it) | Yes (minor disclosure to Sentry) | Low–Medium |
| A customer reports they received a password-reset email they didn't request, repeatedly | Yes (potential enumeration / credential-stuffing in progress) | Low–Medium |
| A vendor security notice — Supabase / Vercel / Resend / Cloudflare / Google announces a breach affecting their service | Possibly | Depends on vendor scope (request their breach notice) |
| RLS misconfiguration allows authenticated user to query another org's `candidates` | Yes | High |
| The purge cron stops running and 30-day deletion promise (Privacy §7) is breached for >30 days | **Not a breach under Art. 4(12)** — it's a compliance failure, not a security incident — but document and remediate immediately. |
| An OAuth refresh token is exfiltrated from `profiles` table | Yes | High (gives access to recruiter's Google Calendar / Microsoft Outlook) |
| Activity log accidentally records a candidate's email in `details` JSON | Yes (internal disclosure) | Low |

---

## How a breach may be detected

These are the realistic detection channels for HRHandle today:

1. **Sentry alert** — error monitoring is wired across server, client, edge (with PII scrub per [S-007](../issues-found.md)). Patterns to watch:
   - Spikes in 401 / 403 / 500
   - New stack traces in `lib/supabase/*` or `lib/actions/*`
   - "permission denied for table" or RLS-related errors
2. **Supabase advisor warnings** — check `get_advisors` periodically; flagged RLS / security_definer issues are pre-breach indicators
3. **Customer report** — a recruiter contacts `support@hrhandle.com` saying they saw data that shouldn't be theirs
4. **Candidate report** — someone applying contacts to say something is wrong
5. **Vendor notice** — Supabase / Vercel / Resend / Cloudflare / Google sends a security advisory
6. **Suspicious activity in Vercel / Supabase logs** — repeated probing of an endpoint, unexpected admin-client invocations
7. **Manual discovery** — you spot something while debugging an unrelated issue (this is more common than people admit)

The 72-hour clock starts the moment **any** of the above brings the breach to your *awareness* — not the moment of compromise. Awareness includes "high probability" — you don't need certainty.

---

## Severity classification

Decide severity within the **first hour**. It controls notification obligations.

| Tier | Criteria | Notification obligation |
|---|---|---|
| **Low** | Limited disclosure of low-sensitivity data to a small, identifiable set of recipients who can be contacted. No CVs, no large volumes. Example: an email-template misconfiguration sends one rejection email to a candidate naming the wrong company. | Log internally. No external notification required, but record the assessment. |
| **Medium** | Confidentiality / integrity breach affecting one customer's account but not their candidates. OR potential exposure that you can't yet confirm scope of. Example: a single recruiter's Google refresh token may have leaked. | Notify the affected customer (Art. 33(2)) and assess whether 72-hour Art. 33 notice is required for HRHandle as controller. |
| **High** | Breach of candidate data (any volume) OR breach affecting >1 customer OR loss of integrity of the database OR exposure of service-role credentials. | Notify supervisory authority within 72 hours (for HRHandle's controller-side data) AND notify all affected customers without undue delay (for processor-side data). If "high risk to rights and freedoms of natural persons" → also notify affected individuals (Art. 34). |

When uncertain between two tiers, escalate up.

---

## The 72-hour clock — when "aware" starts

Article 33 wording: *"the controller shall, without undue delay and, where feasible, not later than 72 hours after having become aware of it, notify the personal data breach to the competent supervisory authority"*.

- "Aware" = you have reasonable certainty that an incident occurred. Not the moment of compromise; the moment you (or your monitoring) catch it.
- The 72 hours include weekends and holidays.
- If you can't notify within 72 hours, the late notification must include reasons for the delay.
- For HRHandle's **processor** breaches (candidate data), the clock for the customer-controller starts when *you tell them*. So notifying customers fast matters even though you don't notify the regulator directly for that data.

---

## Response timeline

### Hour 0–1 — Immediate response

Do these in order, regardless of severity:

- [ ] **Write down the time you became aware.** Plain text, in the [internal breach log](#internal-breach-log) below. This is the start of the clock.
- [ ] **Snapshot the evidence.** Take screenshots of the alert, log lines, customer email, etc. before anything is rotated or scrubbed. Save to a folder named `incidents/YYYY-MM-DD-short-name/`.
- [ ] **Stop the bleeding if obvious and safe.** Examples:
  - Compromised key → rotate it in the relevant service dashboard (Supabase, Resend, Cloudflare, Google) and update Vercel env vars.
  - Buggy code path leaking data → roll back the deployment in Vercel.
  - Open RLS → apply a temporary deny-all policy.
  - Compromised user account → force a Supabase Auth sign-out for that user.
- [ ] **Do not modify or delete logs.** They are evidence.
- [ ] **Classify severity** using the [Severity classification](#severity-classification) table.

If you cannot decide whether to act (e.g. rotating a key would break production), pick the option that **minimises further data exposure**, even at the cost of availability. GDPR doesn't care about your uptime SLA.

### Hour 1–24 — Containment + assessment

- [ ] **Confirm scope.** Which tables / files / users / candidates / orgs? Cite specific record IDs in the breach log.
- [ ] **Confirm cause.** Code bug, misconfiguration, leaked credential, vendor incident, insider, external attacker?
- [ ] **Identify affected customers and candidates** by org. Pull this from the DB before remediation makes it harder.
- [ ] **Decide notification tier** per [Severity classification](#severity-classification).
- [ ] **Begin drafting notification templates** ([below](#notification-templates)) even if not yet sure whether you'll send. Drafting forces clarity about facts.
- [ ] **If High severity**: send the customer-notification (processor path) **immediately** for affected orgs. Don't wait for the 72-hour drafting window — your customers have their own 72-hour clock.

### Hour 24–72 — Notification

- [ ] **Notify supervisory authority** if required (controller-side):
  - **Primary**: Georgian Personal Data Protection Service. [TODO: verify current name + portal — check sda.gov.ge and the EU-aligned 2024 Georgian data protection law for the up-to-date submission channel.]
  - **EU representative**: not yet appointed ([G-001 / EU-rep item](../issues-found.md)). If/when appointed, route EU-data-subject breaches through the representative to the lead supervisory authority.
- [ ] **Notify each affected customer (controller)** if you haven't already (processor-side), using Template B.
- [ ] **Notify affected individuals directly** (Art. 34) if "high risk to rights and freedoms" applies. For candidate data, the customer usually does this — but coordinate.
- [ ] **Record everything sent** in the breach log: timestamp, recipient, summary, link to message archive.

### Post-72-hour — Remediation + record

- [ ] **Root cause analysis.** Write a one-page postmortem in `incidents/YYYY-MM-DD-short-name/postmortem.md`:
  - What happened
  - How was it detected
  - What was the impact
  - What was the root cause
  - What was done to remediate
  - What will prevent recurrence
- [ ] **Track preventative work as issues** in `docs/issues-found.md` (use the `G-` prefix if compliance-shaped; reuse the existing `S-` or `B-` prefixes if security or bug).
- [ ] **Update the breach log** with the final outcome (notified Y/N, decisions made, references).
- [ ] **Communicate the resolution** to affected customers within 30 days of the incident — even if you already notified once, a clear "this is what we learned and what we changed" message rebuilds trust.

---

## Notification templates

Adapt; don't paste verbatim. Replace `{placeholders}`.

### Template A — Notice to supervisory authority (HRHandle as controller)

Required content per Art. 33(3):

```
Subject: Personal data breach notification — HRHandle ({YYYY-MM-DD})

Notifying party:
  Aleksandre Merabishvili, Individual Entrepreneur
  Registration number: 01019062001, Tbilisi, Georgia
  Contact: support@hrhandle.com
  Service: HRHandle (https://hrhandle.com)

1. Nature of the breach
   {Confidentiality / integrity / availability — describe what happened in 2–3 sentences.}

2. Categories and approximate number of data subjects concerned
   {e.g. "approximately N recruiter accounts and N candidate records across N customer organisations".}

3. Categories and approximate number of personal data records concerned
   {e.g. "account credentials (emails), OAuth tokens for connected calendars, CVs and candidate contact details".}

4. Likely consequences
   {What could happen to affected individuals? Unauthorised access to calendars, identity-related risks, etc.}

5. Measures taken or proposed
   {Rotation, deployment rollback, RLS hardening, customer notification, individual notification, etc.}

6. Contact point for further information
   Aleksandre Merabishvili — support@hrhandle.com

7. Date and time of detection
   {YYYY-MM-DD HH:MM UTC}

If any of the above is not yet available, it will be provided in stages without further undue delay.
```

### Template B — Notice to customer (HRHandle as processor of candidate data)

```
Subject: Important — security incident affecting your HRHandle organisation

Hello,

We are writing to inform you of a security incident that may have affected
personal data of candidates stored in your HRHandle organisation, in line
with our obligations under GDPR Article 33(2) and our role as data processor
on your behalf.

What happened
  {Plain-language description, 2–3 sentences.}

When we became aware
  {YYYY-MM-DD HH:MM UTC}

What data may be affected for your organisation
  {Concrete — "candidates created between X and Y", "their email addresses and CVs", etc.}

What we have done
  {Containment, remediation, ongoing investigation.}

What you should do
  {Specific actions: rotate API keys you used with us, watch for unusual activity,
   consider whether you need to notify your supervisory authority and/or
   affected candidates.}

We will send a follow-up message within {N} days with the results of our
root-cause analysis and any further actions we recommend.

If you have questions, reply to this email or contact support@hrhandle.com.

— HRHandle
```

### Template C — Notice to affected individuals (Art. 34)

Use only when "high risk to rights and freedoms" applies and you (or the customer-controller) are the right party to send. For candidate data, the customer normally sends; HRHandle assists.

```
Subject: Important security notice about your data

We are writing to inform you of a security incident affecting personal data
relating to you.

What happened
  {Plain-language, 2 sentences.}

What data was affected
  {Be specific. Do not over-claim, do not under-claim.}

What we have done
  {Concrete remediation.}

What you should do
  {Concrete steps — change password, watch for phishing, etc. If nothing
   actionable, say so honestly.}

We are very sorry that this happened. If you have any questions, please
contact: {your or customer's contact email}.
```

---

## Internal breach log

Maintain this even for low-severity incidents that don't require external notification. Required by Art. 33(5).

Recommended location: `docs/9-compliance/breach-log.md` (private, do not commit publicly if it contains specific user identifiers; keep PII out of the markdown — use placeholders and link to a separate non-public record).

Minimum fields per entry:

```
## Incident YYYY-MM-DD short-name

- Detected: YYYY-MM-DD HH:MM UTC, via {Sentry / customer report / log review / vendor notice}
- Reporter: {who first surfaced it}
- Severity: Low / Medium / High
- Affected data categories: {…}
- Approximate scope: {N accounts, N candidates, N orgs}
- Root cause: {one sentence}
- Notifications sent: {supervisory authority Y/N, customers Y/N, individuals Y/N}
- Remediation actions: {one-line list}
- Postmortem: {link to incidents/YYYY-MM-DD-short-name/postmortem.md}
- Outstanding follow-ups: {linked to docs/issues-found.md IDs}
```

---

## Quarterly review

Once per quarter (set a recurring calendar reminder):

- [ ] Re-read this document. Update anything that no longer reflects how HRHandle works.
- [ ] Re-read the [breach log](#internal-breach-log) and confirm every outstanding follow-up is tracked in `docs/issues-found.md`.
- [ ] Verify `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, OAuth client secrets are not older than your rotation policy. (If you don't have a rotation policy yet, set one: 12 months for most, 6 months for service-role.)
- [ ] Skim Supabase advisors and Sentry for issues that have been open >30 days.
- [ ] Confirm the purge cron (`/api/cron/purge-deleted`, [G-003](../issues-found.md)) has run successfully every day since the last review.

---

## Key contacts and resources

| Purpose | Who | How |
|---|---|---|
| Sentry | sentry.io | Your project dashboard — alerts come here first |
| Supabase incident & status | status.supabase.com | Vendor breach notices |
| Vercel incident & status | www.vercel-status.com | Vendor breach notices |
| Resend incident & status | status.resend.com | Vendor breach notices |
| Cloudflare Turnstile incident & status | www.cloudflarestatus.com | Vendor breach notices |
| Google AI / Gemini | status.cloud.google.com | Vendor breach notices |
| Georgian Personal Data Protection Service | sda.gov.ge | [TODO: verify the current submission channel for breach notifications under the updated 2024 Georgian data protection law] |
| EU representative | **Not yet appointed** — see [EU-rep item in audit plan](../issues-found.md) | When appointed, add address + email here |
| HRHandle DPO / founder | Aleksandre Merabishvili | support@hrhandle.com |

---

## Document control

- **Owner:** Aleksandre Merabishvili
- **Created:** 2026-06-03
- **Tracked as:** [G-004](../issues-found.md)
- **Review cadence:** quarterly
- **Related docs:** [`docs/issues-found.md`](../issues-found.md), [`app/privacy/page.tsx`](../../app/privacy/page.tsx), [`docs/3-architecture/backend.md`](../3-architecture/backend.md)
