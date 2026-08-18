# S11 · AI Fit Analysis — flow analysis (as built)

> **Status:** ✅ **Shipped 2026-07-22 — opt-in, default OFF.** This is the as-built flow. The canonical spec, regulatory analysis, and competitive positioning live in [`ai-fit-analysis.md`](../ai-fit-analysis.md); the compliance inventory + the six guardrails as-built are in [`9-compliance/ai-features.md`](../../9-compliance/ai-features.md).
>
> **Sources:** [`AI Fit Analysis.dc.html`](../../../redesign/AI%20Fit%20Analysis.dc.html), [`ai-fit-analysis.md`](../ai-fit-analysis.md), the compliance FIX-PROMPT. Distinct from [S10](S10-ai-terminology.md), which governs the five low-risk advisory features — AI Fit Analysis is its own system with stricter guardrails (Annex III high-risk).
>
> **Why this is its own flow.** It is the only feature that "evaluates candidates" in EU AI Act terms. Every UI and data decision here is a compliance decision.

---

## 1. What ships

A collapsed, advisory **AI fit analysis** card on the candidate profile. On explicit "Run analysis" it assesses the application against the vacancy's own scorecard criteria (`vacancy_questions`) and renders:

- **"Meets N of M must-have criteria"** — a factual count, computed server-side from per-criterion thresholds. **There is no overall score, grade, or ranking, ever.**
- per-criterion match % + a short evidence quote + one-line explanation
- strengths (each cites evidence), gaps "to verify" (framed as verification, not weakness), and suggested screening questions
- a sanitization banner (which protected categories were stripped) + a confidence level
- a **mandatory** "Your assessment" block — Agree, or Override with a required reason — before the analysis counts as acted on
- an audit rail (model, prompt version, generated/reviewed timestamps)

Renders nothing at all unless the org has enabled the feature.

## 2. The path

```
Owner: Settings → Organization → "AI Fit Analysis" card
  └─ tick "Enable" → EU-AI-Act acknowledgement appears → tick → Enable
       setAiFitEnabled(true, acknowledged) → organizations.ai_fit_enabled = true (+ _at/_by/eu_ack)

Recruiter: Candidate profile → "AI fit analysis" card (collapsed) → Run analysis
  runAiFitAnalysis(applicationId):
    1. opt-in + geofence gate (canEnableAiFit)
    2. monthly cap (100 / org / month)
    3. load application + candidate + vacancy_questions (criteria) + experience/education/screening answers
    4. sanitizeForFitAnalysis(...) → SanitizedFitInput  (protected fields never leave the process)
    5. runFitAnalysis(sanitized, criteria) → Gemini 2.5 Flash → Flash-Lite fallback, fail-soft
    6. parseFitResponse → drop invented criteria, clamp, compute meets_count server-side
    7. insert append-only ai_fit_analyses row + writeAuditLog('ai_fit_invoked')
  Recruiter reviews → Agree / Override(reason)
    submitFitAssessment → writeAuditLog('ai_fit_agreed' | 'ai_fit_overridden')

Applicant: apply/[token] shows an Art. 22 disclosure when the org uses the feature.
Admin: Settings → Data → "AI oversight" — usage vs cap, agree/override split, override log.
```

## 3. Key files

| Concern | File |
|---|---|
| Sanitize by construction | `lib/ai/cv-sanitizer.ts` (`sanitizeForFitAnalysis`) |
| Engine + versioned prompt + defensive parser | `lib/ai/fit-analysis.ts` (`FIT_PROMPT_VERSION`, `MEETS_THRESHOLD`, `parseFitResponse`, `runFitAnalysis`) |
| Geofence | `lib/ai/fit-geofence.ts` (`isEuCountry`, `canEnableAiFit`) |
| Server actions | `lib/actions/ai-fit.ts` (`runAiFitAnalysis`, `getAiFitAnalysis`, `submitFitAssessment`, `setAiFitEnabled`, `getAiFitOversight`) |
| Types | `lib/types/ai-fit.ts` |
| Profile card | `components/candidates/profile/ai-fit-card.tsx` (mounted via `profile-shell.tsx`, gated by `aiFitEnabled`) |
| Owner opt-in | `components/settings/ai-fit-policy-card.tsx` (Settings → Organization) |
| Applicant disclosure | `app/apply/[token]/page.tsx` (shown only when `ai_fit_enabled`) |
| Admin oversight | `app/(dashboard)/settings/ai-fit/page.tsx` (Settings → Data → AI oversight) |
| Schema | `supabase/migrations/20260722_ai_fit_analysis.sql` — `ai_fit_analyses`, `ai_fit_bias_reviews`, `organizations.ai_fit_*` |

## 4. Guardrails → enforcement (summary)

The six guardrails and their code home are documented once, canonically, in [`9-compliance/ai-features.md` → "AI Fit Analysis — the six guardrails, as built"](../../9-compliance/ai-features.md#ai-fit-analysis--the-six-guardrails-as-built). In short: (1) decision-support-only + mandatory human sign-off, (2) criteria-locked, (3) sanitize-by-construction, (4) evidence + confidence, (5) opt-in + geofence + acknowledge, (6) full transparency + auditability.

## 5. Deliberately NOT built

- **No overall fit score.** Only "Meets N of M". A single number invites ranking/auto-decisioning — exactly what Annex III + Art. 22 constrain.
- **No AI output anywhere except the card.** Never in the pipeline board, candidate lists, Review Mode, reports, bulk actions, or CSV exports (verified by grep). Review Mode's fit-analysis line stays hidden (see [roadmap A-2](../roadmap.md)).
- **No cross-application CSV export** of analyses. Oversight is the in-app audit log + the AI-oversight surface + the append-only provenance rows — not a spreadsheet of candidate assessments.
- **No auto-run.** Always an explicit recruiter click; never background or on-apply.

## 6. Follow-ups

- Signed-off **periodic bias reviews** into `ai_fit_bias_reviews` (table exists; the live surface currently reads aggregates from `ai_fit_analyses`).
- Per-analysis recruiter thumbs-up/down feedback signal (shared with S10's planned feedback loop).
- **USER action required:** apply migration `20260722_ai_fit_analysis.sql` on staging, then production, before enabling.
