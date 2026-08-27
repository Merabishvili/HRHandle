# AI Features — Design Principles & Inventory

_Last updated: 2026-07-22_
_Owner: Aleksandre Merabishvili (sole founder + DPO)_

## Document control

- **Tracked as:** [G-009](../issues-found.md) (initial AI features), [G-014](../issues-found.md) (assessment suggester). [G-015](../issues-found.md) (email drafter) was retired on 2026-06-21 — the founder didn't find the output useful and the per-candidate friction outweighed the productivity benefit. [G-001](../issues-found.md) (Gemini paid-tier prerequisite) was closed on 2026-06-09 when billing was enabled on the Gemini account.
- **Review cadence:** at every release that adds, modifies, or removes an AI feature; and at least quarterly
- **Related docs:** [`docs/9-compliance/ropa.md`](./ropa.md) (Activity P-3) · [`app/privacy/page.tsx`](../../app/privacy/page.tsx) §5.1 · [`docs/issues-found.md`](../issues-found.md)

## Design principles

These rules constrain every AI feature in HRHandle. They are non-negotiable and are restated at the top of every PR that touches `lib/ai/`.

### 1. Assistant only, never decider

No AI feature in HRHandle:

- Auto-fills a stored field on a candidate, vacancy, application, or interview record
- Auto-changes a candidate's status, stage, or pipeline position
- Auto-advances or auto-rejects an applicant
- Auto-sends an email
- Runs in the background without explicit user trigger

Every AI feature is invoked by an **explicit recruiter click**. The output is **read-only by default** and the recruiter must explicitly **copy / edit / save** to persist anything.

This keeps HRHandle safely outside GDPR Article 22 ("decisions based solely on automated processing... with legal or similarly significant effect") because the actual hiring decision always rests with a human.

### 2. Honest labelling

AI-generated content is always labelled. The label includes the phrase "AI-generated" plus an indication that the recruiter has not yet reviewed it. The label does not disappear when the recruiter saves the content as a note — saved notes are prefixed with `AI summary (not reviewed by recruiter):` or equivalent for the feature.

### 3. Minimum-necessary data

Each feature sends only the data necessary for its task. Specifically:

- CV parsing sends the **file content** (unavoidable for the task).
- Email drafter sends **candidate first name, role title, sender first name, recruiter free-text context, and (in improve mode) the recruiter's draft**. It does **NOT** send the candidate's email, phone, LinkedIn URL, last name, date of birth, or any application/evaluation history.
- Assessment suggester sends **vacancy text only** (title, description, responsibilities, requirements, sector, optional recruiter notes). No candidate data is sent.
- **AI Fit Analysis** sends **only sanitized, job-relevant data**: years of experience, languages, work-history entries, education entries, and screening answers — plus the vacancy's scorecard criteria names. It does **NOT** send the candidate's name, email, phone, LinkedIn/URLs, photo, age/DOB, gender, nationality, or any other protected attribute. Sanitization is **allowlist-by-construction** in [`lib/ai/cv-sanitizer.ts`](../../lib/ai/cv-sanitizer.ts) (`sanitizeForFitAnalysis`) — the raw record is never passed through; a new `SanitizedFitInput` is built field by field and free-text is scrubbed of contact details + the candidate name before it leaves the process. The categories removed are recorded on every analysis (`redacted_categories`) and shown to the recruiter.
- Future features must justify in code comments why each field is needed.

### 4. Traceability

Every AI feature invocation is logged in `activity_log` via `writeAuditLog`, with `action: 'ai_assist'` and a `details` payload containing:

- `feature` — the feature name (`cv_parsing`, `ai_fit`, etc.)
- `success` — boolean
- `reason` — if not success, why (e.g. `too_thin`, `timeout`, `failed`)

The AI output content itself is **not** logged — only the metadata that an AI call happened. This satisfies the EU AI Act's logging-and-traceability obligation for high-risk AI systems without creating a separate PII store.

**AI Fit Analysis** logs a richer, feature-specific trail (its higher risk warrants it): distinct actions `ai_fit_invoked`, `ai_fit_agreed`, `ai_fit_overridden`, `ai_fit_enabled`, `ai_fit_disabled` — plus an **append-only** provenance row per analysis in `ai_fit_analyses` (criteria snapshot, sanitized-input hash, redacted categories, model + prompt version, and the recruiter's mandatory Agree/Override assessment with reason). The rendered analysis is stored so the recruiter's decision is reproducible; it is never surfaced in reports, lists, bulk actions, or CSV exports.

### 5. Graceful degradation

Every feature works around AI being unavailable. If the model is down, rate-limited, or returns garbage, the surrounding workflow proceeds and the recruiter completes the task manually.

### 6. Human-readable failure

If the AI cannot help (e.g. data too thin, model timeout, rate limit hit), the UI says so in plain language. No silent failures. No technical error codes shown to the recruiter.

## Current feature inventory

| Feature | Status | Endpoint | UI location | Sub-processor | Rate limit |
|---|---|---|---|---|---|
| **CV parsing** | Live | `POST /api/parse-cv` | Public apply form (`/apply/[token]`) — runs on file upload | Google Gemini | 30 / hour / IP |
| ~~**Candidate summary**~~ | Removed 2026-08-20 | — | Retired as low-value (AI Fit Analysis covers candidate assessment better). Fully removed: `/api/ai/candidate-summary` route, `lib/ai/candidate-summary.ts`, `components/candidates/ai-summary-panel.tsx`, its test, and the "Generate summary" surfaces on the candidate profile + pipeline Review Mode. | — | — |
| **JD generator** | Live | `POST /api/ai/jd-generator` | Vacancy create/edit form, inside the Vacancy Details card — collapsible AI assist panel with per-section Generate, per-section Copy, and an explicit "Apply all to form" button (confirms before overwriting existing text) | Google Gemini | 100 / hour / org |
| ~~**Interview questions**~~ | Removed 2026-07-04 | — | The separate "AI interview questions" section on the Scorecard & interview tab was retired (redesign S04) — it duplicated the Assessment suggester. Fully removed 2026-07-04: `/api/ai/interview-questions` route, `lib/ai/interview-questions.ts`, `lib/actions/interview-questions.ts`, and its test are deleted, and migration `20260704_drop_vacancy_interview_questions.sql` drops the `vacancies.interview_questions` JSONB column. | — | — |
| **Interview-note structuring** | ~~Live~~ **Retired 2026-08-28** | ~~`POST /api/ai/note-extractor`~~ | Removed by product decision — the "Structure interview notes" panel (recruiter pastes raw notes → AI summary/strengths/concerns/skills/follow-ups). Route + `lib/ai/note-extractor.ts` + `<AiNotesExtractor>` deleted. Historical `activity_log` rows with `feature: 'note_extractor'` are preserved as immutable audit history (the `auditMsg.ai_assist.note_extractor` label is kept so they still render). | — | — |
| **Inclusive-language check** | Live | `POST /api/ai/bias-check` | Vacancy create/edit form, inside the Vacancy Details card (collapsible panel below the JD generator) — single Run-check button scans description/responsibilities/requirements for biased phrasing and returns a list of findings (field, exact phrase, category, reason, suggested replacement). Per-finding Copy of the suggestion. Form is never modified. Server-side filter rejects findings whose phrase isn't an exact substring of the input — guards against model hallucination. | Google Gemini | 100 / hour / org |
| **Assessment suggester** | Live | `POST /api/ai/assessment-suggester` | Vacancy detail page → Scorecard & interview tab — single full-width "Suggest with AI" panel above the Scorecard + Interview guide cards (the only AI panel on this tab as of 2026-07-03). One Generate button drafts a single list of suggestions; each row carries a destination badge (**→ Scorecard** for scored attributes, **→ Interview guide** for open-ended prompts) and a single **Add** action that persists via the existing `addVacancyQuestion` server action (one row in `vacancy_questions`, type `score` or `text`). Already-added items show a "✓ Added" marker so the recruiter can't double-add by regenerating; a bottom "Regenerate" link re-runs the batch. No Copy actions. No candidate data sent. | Google Gemini | 100 / hour / org |
| **AI Fit Analysis** | Live — **opt-in, default OFF** | `requestAiFitAnalysis` server action (`lib/actions/ai-fit.ts`) | Candidate profile → collapsed "AI fit analysis" card (`ai-fit-card.tsx`), explicit "Run analysis" button. **Runs asynchronously** — the action inserts a `pending` row and processes the model in the background via Next's `after()`, so the request returns immediately ("requested" toast, card shows "generating…"). When it finishes the row flips to `completed`/`failed`, the polling card updates, and an in-app **notification** (`ai_fit_ready`) alerts the requester even if they navigated away. Assesses the application against the vacancy's scorecard criteria and returns **"Meets N of M must-haves"** (a factual count, **never an overall score**), per-criterion match % + evidence, strengths, gaps to verify, and suggested screening questions. Advisory only — never advances, rejects, ranks, or compares candidates. The recruiter **must** record a mandatory Agree/Override assessment (override requires a reason). Higher-risk, so it is gated behind an owner opt-in with EU-AI-Act acknowledgement (Settings → Organization) and geofencing (`lib/ai/fit-geofence.ts`). See the dedicated guardrails section below. | Google Gemini | 100 analyses / month / org |
| ~~**Email drafter**~~ | Retired 2026-06-21 | — | Originally shipped as G-015 on 2026-06-09. Removed after founder use indicated the recruiter-managed templates (existing application_received / interview_invitation / rejection / status_change_* / offer_sent) covered the real customer-facing email needs, and the AI-drafted output added friction without enough leverage to keep the feature alive. Code, route, prompt rules, and tests deleted in the removal commit. | — | — |

### AI Fit Analysis — the six guardrails, as built

AI Fit Analysis (redesign S11 / roadmap Wave 3.1) is the only feature that crosses into EU AI Act **Annex III high-risk** territory ("to evaluate candidates"). Its full spec, regulatory analysis, and competitive positioning live in [`docs/redesign/ai-fit-analysis.md`](../redesign/ai-fit-analysis.md); the flow is [`docs/redesign/flows/S11-ai-fit-analysis.md`](../redesign/flows/S11-ai-fit-analysis.md). The six non-negotiable guardrails and where they are enforced in code:

1. **Decision support, not decision-making.** No overall score/grade — only "Meets N of M must-haves" (a count derived from per-criterion thresholds, computed server-side in `parseFitResponse`, not by the model). Never advances, rejects, ranks, or compares candidates. The recruiter's Agree/Override is a **required** step (`submitFitAssessment`) before the analysis is considered acted on — EU AI Act Art. 14 human oversight, and it keeps the feature outside GDPR Art. 22.
2. **Criteria-locked.** The model may only assess the vacancy's own scorecard criteria (`vacancy_questions`); invented criteria are dropped by the parser. It is told never to add its own.
3. **Sanitize by construction.** Protected attributes never reach the model — `sanitizeForFitAnalysis` builds an allowlisted `SanitizedFitInput` and scrubs free text of contact details + name. Redacted categories are recorded and shown.
4. **Evidence-based + confidence.** Every match, strength, and gap must cite evidence from the candidate data; the model returns a confidence level; thin data yields low match with evidence "not evidenced" rather than a guess.
5. **Opt-in + geofenced + acknowledged.** Default OFF. Only an owner can enable it, and enabling requires an explicit advisory/EU-AI-Act acknowledgement (`setAiFitEnabled` + `canEnableAiFit`). EU orgs cannot enable without the acknowledgement.
6. **Fully transparent + auditable.** Applicants see an Art. 22 disclosure on the apply form when the org uses the feature; recruiters see the sanitization banner + audit rail; admins get a bias-oversight surface (Settings → Data → AI oversight) tracking usage and the override log; every run/agree/override is in the audit log; each analysis keeps an append-only provenance row.

### Planned features (not yet shipped)

- _(none currently — AI Fit Analysis, formerly the deferred "AI screening" concept, shipped 2026-07-22 as an opt-in, default-OFF feature with the guardrails above.)_

## Prompt-update policy

Prompt strings live in `lib/ai/<feature>.ts` as exported or module-level constants. Changes to prompts:

- Are reviewed in PR like any other code change
- Must preserve the "advisory, neutral, factual" stance of the prompt
- Must not introduce judgement language (e.g. "rate this candidate's fit", "rank these candidates")
- Should include the "TOO_THIN" / "I don't know" / equivalent escape hatch so the model can decline to fabricate when input is sparse

## EU AI Act mapping

HRHandle's AI features fall under the EU AI Act's **high-risk** category (Annex III, hiring/employment). The applicable obligations and how HRHandle satisfies them at current scale:

| Obligation | How HRHandle addresses it |
|---|---|
| Risk management | This document plus the per-feature comments in `lib/ai/<feature>.ts` |
| Data governance | Minimum-necessary data principle (principle 3); excluded fields documented per feature |
| Logging and traceability | `writeAuditLog` entry on every AI invocation (principle 4) |
| Transparency to users | Privacy Policy §5.1; apply-form Article 13 notice (G-002) |
| Human oversight | Principle 1 ("assistant only, never decider") — every AI output is reviewed by the recruiter before any action is taken |
| Accuracy & robustness | Two-model fallback (Gemini 2.5 Flash → 2.5 Flash Lite), timeout per call, "too thin" guard against fabrication |
| Post-market monitoring | Audit log analytics + recruiter feedback (planned: thumbs-up/down on AI output per feature) |

**AI Fit Analysis** is the first feature that engages the high-risk obligations directly. Beyond the shared measures above, it adds: mandatory human sign-off per analysis (Art. 14), applicant transparency on the apply form (Art. 13 / GDPR Art. 22), append-only provenance per analysis, an admin bias-oversight surface (override-rate monitoring, Settings → Data → AI oversight), sanitize-by-construction data governance, and an owner opt-in with EU acknowledgement + geofencing. It ships **default OFF**; an organisation is expected to complete its own EU AI Act review (roadmap Phase 0.8 legal consult) before enabling it, which the acknowledgement gate records.

## Quarterly review checklist

- [ ] Confirm every shipped feature still follows the six design principles (no auto-fill, no auto-decision, etc.). Spot-check the route handlers and UI components.
- [ ] Re-read each prompt string and confirm it has not drifted toward judgement language.
- [ ] Review `activity_log` for `action = 'ai_assist'` patterns: are usage volumes within expected bounds? Any features that no one uses?
- [ ] Re-confirm Gemini account is still on the paid tier (billing active, no quota-exhaustion errors). The privacy claim in §5.1 depends on this being true.
- [ ] Sanity-check the rate limits against actual usage.

## Changelog

| Date | Change | Reviewer |
|---|---|---|
| 2026-06-05 | Initial creation. CV parsing + candidate summary live. Six design principles documented. EU AI Act mapping table added. | Aleksandre Merabishvili |
| 2026-06-05 | JD generator added (G-010). Per-section Generate buttons, per-section Copy, and an explicit "Apply all to form" action that confirms before overwriting any non-empty form field. No candidate data sent to the AI for this feature. | Aleksandre Merabishvili |
| 2026-06-05 | Interview questions added (G-011). Four categories (behavioural, technical, situational, closing). Strict no-protected-class / no-salary prompt guard. Per-question Copy + per-category Copy-all. "Save to vacancy" persists the set to a new `vacancies.interview_questions` JSONB column (migration 032). Per-question Delete on the saved view. No candidate data sent to the AI for this feature. | Aleksandre Merabishvili |
| 2026-06-05 | Interview-note structuring added (G-012). Right-sidebar panel on candidate page. Sends recruiter-pasted notes + candidate name + role title to Gemini. Strict prompt rules: no protected-class inference, no hiring recommendation, no salary in output. Per-section Copy + explicit "Save as note" via existing `createNote` action. Audit log records feature + raw-notes length only; output content is not logged. | Aleksandre Merabishvili |
| 2026-06-05 | Inclusive-language check added (G-013). Collapsible panel below the JD generator in the Vacancy Details card. Sends vacancy text only — no candidate data. Server-side filter enforces the "exact substring of the input" rule on every finding (guards against model hallucination) and rejects findings with invalid category values. Per-finding Copy of the suggestion. Audit log records feature + findings count only. | Aleksandre Merabishvili |
| 2026-06-09 | Assessment suggester added (G-014). Full-width AI panel on the Assessment tab. Suggests skill labels (score-type, scored 1–10) and open-ended prompts (text-type). Sends vacancy text only — no candidate data. Per-item Add button persists via the existing `addVacancyQuestion` server action; recruiter chooses what to add. Already-added items are marked so regeneration cannot duplicate. Strict prompt rules forbid protected-class language, salary criteria, and coded language. Audit log records feature + skill/prompt counts only. | Aleksandre Merabishvili |
| 2026-06-09 | Email drafter added (G-015). Collapsible right-sidebar panel on candidate detail page. Generate-from-scratch and improve-my-draft modes for rejection / interview invite / offer / follow-up / custom emails. Sends candidate **first name only**, role title (optional), sender first name, and the recruiter's free-text context (and draft in improve mode). Does NOT send email/phone/LinkedIn/DOB/last name. No send action — recruiter copies the result into their email tool. Strict prompt rules: never reference protected characteristics, never invent dates/salaries/products, use placeholders, never promise outcomes in follow-ups, never write a binding offer. Audit log records feature + email type + mode + draft-char count only. | Aleksandre Merabishvili |
| 2026-07-22 | **AI Fit Analysis** shipped (redesign S11 / roadmap Wave 3.1) — the first Annex III high-risk feature. Opt-in, default OFF, owner-enabled with an EU-AI-Act acknowledgement gate + geofencing. Assesses an application against the vacancy's scorecard criteria and returns "Meets N of M must-haves" (**no overall score**), per-criterion match + evidence, strengths, gaps, and suggested questions. Six guardrails enforced in code: decision-support-only + mandatory recruiter Agree/Override (Art. 14), criteria-locked parser, sanitize-by-construction (protected fields never sent), evidence + confidence, opt-in/geofence/acknowledge, and full transparency (applicant disclosure on apply form, admin bias-oversight surface, append-only provenance, distinct audit actions). No AI output appears in reports/lists/bulk/CSV. Files: `lib/ai/{cv-sanitizer,fit-analysis,fit-geofence}.ts`, `lib/actions/ai-fit.ts`, `lib/types/ai-fit.ts`, `components/candidates/profile/ai-fit-card.tsx`, `components/settings/ai-fit-policy-card.tsx`, `app/(dashboard)/settings/ai-fit/`, migration `20260722_ai_fit_analysis.sql`. | Aleksandre Merabishvili |
| 2026-08-24 | **AI Fit 503 resilience + async hardening.** (a) Gemini kept returning an instant `503 "high demand"` on `gemini-2.5-flash`; the fixed 4-attempt retry burned out in ~10s and gave up. `runFitAnalysis` now **cycles four model families** (`gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.0-flash`, `gemini-2.0-flash-lite`) with backoff until a **45s budget** is spent — a 503 on one family's capacity pool no longer fails the request when another family is free. (b) The background `after()` run was hitting Vercel's 60s limit and leaving the row stuck `pending` (spinner forever) → added a hard **50s deadline** in `processFitAnalysis` that marks the row `failed`/`timeout` before the kill, and the card stops the "generating…" spinner after a **5-min ceiling** with Retry. `FIT_TIMEOUT_MS` 25s→18s. | Aleksandre Merabishvili |
| 2026-08-23 | **AI Fit Analysis made asynchronous.** The model call previously ran inline in `runAiFitAnalysis`, blocking the request for the whole retry budget (up to 6 attempts × 25s), which Vercel killed → "temporarily unavailable". Split into `requestAiFitAnalysis` (inserts a `pending` row, returns immediately) + a background `processFitAnalysis` (Next `after()`, admin client) that flips the row to `completed`/`failed` and fires an `ai_fit_ready` in-app notification. The card polls the row and shows generating/failed/completed states with a Retry. New migration `20260823_ai_fit_async.sql` (adds `status` + `error_reason`, relaxes NOT NULL on output columns) — **apply on BOTH Supabase projects.** No change to the guardrails, sanitization, cap, or audit trail. | Aleksandre Merabishvili |
| 2026-08-20 | **Candidate summary removed.** Retired as low-value (AI Fit Analysis covers candidate assessment better, with proper guardrails). Fully removed: `/api/ai/candidate-summary` route, `lib/ai/candidate-summary.ts`, `components/candidates/ai-summary-panel.tsx`, its test, and the "Generate summary" surfaces on the candidate profile + pipeline Review Mode. Privacy policy AI-features list updated to drop the candidate-summary processing activity. | Aleksandre Merabishvili |
| 2026-06-21 | Email drafter (G-015) **retired**. Founder use confirmed the recruiter-managed templates (existing application_received / interview_invitation / rejection / status_change_* / offer_sent) already cover the real customer-facing email needs, and the AI-drafted output didn't earn its keep. Removed `lib/ai/email-drafter.ts`, `app/api/ai/email-drafter/route.ts`, `components/candidates/ai-email-drafter.tsx`, `lib/__tests__/ai-email-drafter.test.ts`, and the mount on the candidate detail page. Audit-log `feature: 'email_drafter'` rows are preserved (immutable history); the action is no longer reachable. | Aleksandre Merabishvili |
