# AI Features — Design Principles & Inventory

_Last updated: 2026-06-21_
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
- Candidate summary sends **name, current role/company, location, languages, work-history entries, education entries**. It does **NOT** send email, phone, LinkedIn URL, or date of birth.
- Email drafter sends **candidate first name, role title, sender first name, recruiter free-text context, and (in improve mode) the recruiter's draft**. It does **NOT** send the candidate's email, phone, LinkedIn URL, last name, date of birth, or any application/evaluation history.
- Assessment suggester sends **vacancy text only** (title, description, responsibilities, requirements, sector, optional recruiter notes). No candidate data is sent.
- Future features must justify in code comments why each field is needed.

### 4. Traceability

Every AI feature invocation is logged in `activity_log` via `writeAuditLog`, with `action: 'ai_assist'` and a `details` payload containing:

- `feature` — the feature name (`candidate_summary`, `cv_parsing`, etc.)
- `success` — boolean
- `reason` — if not success, why (e.g. `too_thin`, `timeout`, `failed`)

The AI output content itself is **not** logged — only the metadata that an AI call happened. This satisfies the EU AI Act's logging-and-traceability obligation for high-risk AI systems without creating a separate PII store.

### 5. Graceful degradation

Every feature works around AI being unavailable. If the model is down, rate-limited, or returns garbage, the surrounding workflow proceeds and the recruiter completes the task manually.

### 6. Human-readable failure

If the AI cannot help (e.g. data too thin, model timeout, rate limit hit), the UI says so in plain language. No silent failures. No technical error codes shown to the recruiter.

## Current feature inventory

| Feature | Status | Endpoint | UI location | Sub-processor | Rate limit |
|---|---|---|---|---|---|
| **CV parsing** | Live | `POST /api/parse-cv` | Public apply form (`/apply/[token]`) — runs on file upload | Google Gemini | 30 / hour / IP |
| **Candidate summary** | Live | `POST /api/ai/candidate-summary` | Candidate detail page, top of left column — explicit "Generate" button | Google Gemini | 100 / hour / org |
| **JD generator** | Live | `POST /api/ai/jd-generator` | Vacancy create/edit form, inside the Vacancy Details card — collapsible AI assist panel with per-section Generate, per-section Copy, and an explicit "Apply all to form" button (confirms before overwriting existing text) | Google Gemini | 100 / hour / org |
| ~~**Interview questions**~~ | Removed 2026-07-04 | — | The separate "AI interview questions" section on the Scorecard & interview tab was retired (redesign S04) — it duplicated the Assessment suggester. Fully removed 2026-07-04: `/api/ai/interview-questions` route, `lib/ai/interview-questions.ts`, `lib/actions/interview-questions.ts`, and its test are deleted, and migration `20260704_drop_vacancy_interview_questions.sql` drops the `vacancies.interview_questions` JSONB column. | — | — |
| **Interview-note structuring** | Live | `POST /api/ai/note-extractor` | Candidate detail page → right sidebar, collapsible "Structure interview notes" panel — recruiter pastes raw notes (50-8000 chars), clicks Extract, gets summary + strengths + concerns + skills demonstrated + follow-ups. Per-section Copy + explicit "Save as note" (one note, prefixed "AI interview notes (not reviewed by recruiter)"). Output never auto-saved. | Google Gemini | 100 / hour / org |
| **Inclusive-language check** | Live | `POST /api/ai/bias-check` | Vacancy create/edit form, inside the Vacancy Details card (collapsible panel below the JD generator) — single Run-check button scans description/responsibilities/requirements for biased phrasing and returns a list of findings (field, exact phrase, category, reason, suggested replacement). Per-finding Copy of the suggestion. Form is never modified. Server-side filter rejects findings whose phrase isn't an exact substring of the input — guards against model hallucination. | Google Gemini | 100 / hour / org |
| **Assessment suggester** | Live | `POST /api/ai/assessment-suggester` | Vacancy detail page → Scorecard & interview tab — single full-width "Suggest with AI" panel above the Scorecard + Interview guide cards (the only AI panel on this tab as of 2026-07-03). One Generate button drafts a single list of suggestions; each row carries a destination badge (**→ Scorecard** for scored attributes, **→ Interview guide** for open-ended prompts) and a single **Add** action that persists via the existing `addVacancyQuestion` server action (one row in `vacancy_questions`, type `score` or `text`). Already-added items show a "✓ Added" marker so the recruiter can't double-add by regenerating; a bottom "Regenerate" link re-runs the batch. No Copy actions. No candidate data sent. | Google Gemini | 100 / hour / org |
| ~~**Email drafter**~~ | Retired 2026-06-21 | — | Originally shipped as G-015 on 2026-06-09. Removed after founder use indicated the recruiter-managed templates (existing application_received / interview_invitation / rejection / status_change_* / offer_sent) covered the real customer-facing email needs, and the AI-drafted output added friction without enough leverage to keep the feature alive. Code, route, prompt rules, and tests deleted in the removal commit. | — | — |

### Planned features (not yet shipped)

- **AI screening** *(later, with full EU AI Act prep)* — applicant list per vacancy, "AI screening" tab showing advisory fit indicators per candidate. Never changes candidate state automatically.

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

For higher-risk features (AI screening), a more formal risk assessment + bias-monitoring framework will be required. Those features are deferred until the appropriate framework exists.

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
| 2026-06-21 | Email drafter (G-015) **retired**. Founder use confirmed the recruiter-managed templates (existing application_received / interview_invitation / rejection / status_change_* / offer_sent) already cover the real customer-facing email needs, and the AI-drafted output didn't earn its keep. Removed `lib/ai/email-drafter.ts`, `app/api/ai/email-drafter/route.ts`, `components/candidates/ai-email-drafter.tsx`, `lib/__tests__/ai-email-drafter.test.ts`, and the mount on the candidate detail page. Audit-log `feature: 'email_drafter'` rows are preserved (immutable history); the action is no longer reachable. | Aleksandre Merabishvili |
