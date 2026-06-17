# S10 · AI + Terminology system — flow analysis

> **Status:** Draft 1, authored 2026-06-17. The last flow doc — closes the redesign corpus.
>
> **Sources:** [`AI and Terminology System.dc.html`](../../../redesign/AI%20and%20Terminology%20System.dc.html), [`audit.md` §4.13](../audit.md#413-·-s10-·-ai--terminology-ai-and-terminology-systemdchtml). Plus the AI features in [S04d Creation flows §2.1](S04d-creation-flows.md#21-create-vacancy--5-step-wizard-publishable-after-step-1), [S02 Candidate profile §2.7](S02-candidate-profile.md#27-right-rail-structure-final), [S04 Vacancy detail §2.2 Tab 3](S04-vacancy-detail.md#tab-3--scorecard--questions). Distinct from [`ai-fit-analysis.md`](../ai-fit-analysis.md) — S10 governs the **existing 5 AI features**; AI Fit Analysis is its own system with stricter guardrails.
>
> **Why this is tenth (last).** S10 is a rulebook, not a screen. It governs every AI surface in the product and the terminology used across every other flow. The redesign explicitly calls this out: *"One page that governs all 5 AI features and the product's terminology — so the rebuild applies them identically everywhere. Not a screen; a rulebook."* All other flows already reference S10 inline.

---

## 1. Current implementation

### Six existing AI surfaces

| Feature | API route | Component | Lines | Where it appears today |
|---|---|---|---|---|
| **CV parse** | `app/api/parse-cv/route.ts` | inline in `apply-form.tsx` + `candidate-form.tsx` | — | Public apply form + Add candidate |
| **JD generation** | `app/api/ai/jd-generator/route.ts` | `components/vacancies/ai-jd-suggest.tsx` | 337 | Vacancy edit |
| **Bias check** | `app/api/ai/bias-check/route.ts` | `components/vacancies/ai-bias-check.tsx` | 306 | Vacancy edit |
| **Assessment suggester** (suggests scorecard attributes from JD) | `app/api/ai/assessment-suggester/route.ts` | `components/vacancies/ai-assessment-suggester.tsx` | 380 | Vacancy detail Assessment tab |
| **Candidate summary** | `app/api/ai/candidate-summary/route.ts` | `components/candidates/ai-summary-panel.tsx` | 194 | Candidate profile right rail |
| **Note extractor** (structures interview notes into scorecard fields) | `app/api/ai/note-extractor/route.ts` | `components/candidates/ai-notes-extractor.tsx` | 405 | Candidate profile right rail |
| ~~Email drafter~~ | (retired 2026-06-21 per G-015) | — | — | Already gone |
| **Interview questions** (per-vacancy AI Q set) | `app/api/ai/interview-questions/route.ts` | `components/vacancies/ai-interview-questions.tsx` | 470 | Vacancy detail Interview Questions tab — **TO BE RETIRED** per S04 |

Total: ~2,092 LOC of AI components + 6 API routes + supporting `lib/ai/*.ts` modules.

### Today's visual treatment — inconsistent

Per audit §2.8 and §4.13:

- **Loud alarm-orange "AI-GENERATED — RECRUITER HAS NOT REVIEWED OR EDITED"** stamp on JD generator outputs and others
- **Different styling per feature** — no shared "draft tag" component
- **Some always-visible AI panels** (notes extractor in candidate profile rail) vs **invocation-required** (JD suggest) — no consistent on-demand pattern
- **Persistent panels** create visual noise even when not in use

### Terminology drift today

Mixed usage across the product per audit §2.11 + §5:
- "Vacancy" vs "Job" vs "Role" used interchangeably in UI strings
- Status field ambiguous (candidate vs application — fixed by Q1 derived status, but copy needs sweep)
- "Active candidates" used in both senses (count of `general_status_id = active` AND count of non-terminal applications)
- "Incomplete" — flagged in redesign as "RETIRE" but audit §2.11 noted the term isn't in current taxonomy
- "Scorecard" used 3 ways (per audit CS-05): vacancy template / per-interview submission / public share URL
- "Stage" used 3 ways: `application_statuses` row / per-vacancy `pipeline_stages` row (post-Q3) / type enum

---

## 2. Proposed redesign — the rulebook

### 2.1 The AI principle (locked)

> *AI is a trusted assistant, not a hazard. Honesty stays (always says "draft" / "AI-assisted"); the alarm goes.*

Keep the disclosure (regulators want clear AI labeling). Drop the panic styling.

### 2.2 The single AI pattern: invoke → draft → review → confirm

Every AI surface in the product follows this 4-step pattern:

| Step | Visual treatment | Behavior |
|---|---|---|
| **1 · INVOKE** | Quiet brand-blue sparkle button — "Suggest with AI" / "Improve with AI" / "Draft with AI" | Off by default. Never auto-runs on page load. Never a permanent always-on panel. |
| **2 · DRAFT** | Output lands in an editable field tagged "AI draft" with calm accent border (brand-blue 1px) | The output is in an *editable surface* — recruiter can rewrite freely. |
| **3 · REVIEW** | Inline Edit / Regenerate / Cancel buttons; nothing saved yet | The user sees the draft, can modify, can request a new one. No DB write. |
| **4 · CONFIRM** | Brand-blue **Apply** button | Only human click commits to DB. The "AI-assisted" tag persists on the saved field for provenance. |

No skipping steps. No invisible AI. No "AI applied automatically" surfaces.

### 2.3 The shared `<AiDraftPanel />` component (Wave 1.6 deliverable)

Per [`roadmap.md` Wave 1.6](../roadmap.md):

> *Build `<AiDraftTag />` + `<AiDraftPanel />` once; replace orange tags across 5–6 features. Otherwise 5 parallel implementations drift.*

**`<AiDraftPanel />` shell** wraps any draft output:

```tsx
<AiDraftPanel
  tag="AI draft"               // or "AI-filled · review" / "AI suggestion"
  onApply={() => …}            // confirm action
  onRegenerate={() => …}       // re-invoke
  onCancel={() => …}           // discard
  status="ready" | "generating" | "error"
>
  {/* editable content */}
</AiDraftPanel>
```

Visual: brand-blue 1px accent border, brand-blue sparkle icon, low-contrast tag pill. **No orange. No alarm icons. No "NOT REVIEWED" capslock.**

**`<AiDraftTag />`** — small persistent provenance label that stays on the saved field after Apply:

```tsx
<AiDraftTag>AI-assisted</AiDraftTag>
```

Renders as a small calm-blue pill next to the field label. Doesn't block editing.

### 2.4 The 5 features mapped to the pattern

| Feature | Where it lives | Tag | Trigger label |
|---|---|---|---|
| **CV parse** | S5 Public apply form + S04d Step 0 Candidate wizard | "AI-filled · review" | (auto on file upload — fields land prefilled; can edit before Apply) |
| **JD generation** | S04d Vacancy wizard Step 3 + S04 JD tab | "AI draft" | "Suggest with AI" |
| **Bias check** | S04d Vacancy wizard Step 3 + S04 JD tab | "AI suggestion" | "Check inclusive language" |
| **Candidate summary** | S02 Candidate profile right rail (AI tools panel) | "AI draft" | "Generate summary" |
| **Scorecard from notes** | S02 Candidate profile right rail (AI tools panel) | "AI draft" | "Structure interview notes" |

Note: the redesign source lists **5** features but the codebase has **6** AI components today. The 6th (Interview Questions per-vacancy AI) is retired per [S04 §2.6](S04-vacancy-detail.md#what-gets-dropped-from-current) — no home in the 5-tab vacancy structure.

The **Assessment Suggester** (suggests scorecard attributes from JD on the Scorecard & questions tab) is treated as part of the broader scorecard system — per S04 it shows in vacancy detail Tab 3 with the "Suggest from JD" button. Still follows the S10 pattern.

### 2.5 AI Fit Analysis is separate

Per [`ai-fit-analysis.md`](../ai-fit-analysis.md) — that feature has **six additional guardrails** beyond the S10 pattern because it crosses into EU AI Act Annex III territory (high-risk employment AI). Don't confuse the two systems:

| System | Surfaces | Pattern |
|---|---|---|
| **S10 (this doc)** | CV parse, JD, Bias, Summary, Scorecard-from-notes | invoke → draft → review → confirm |
| **AI Fit Analysis** | One specific surface: candidate profile per-application analysis | All of S10 + 6 guardrails (strict advisory, org opt-in, no comparative scoring, provenance, audit log, EU geofence) |

### 2.6 Terminology rules

Six locked decisions for v1:

| Concept | Locked term | Avoid |
|---|---|---|
| The role you're hiring for | **Vacancy** | "Job", "Role", "Position" (occasional use ok for variety in UI copy, but `vacancies` table + nav label = "Vacancy") |
| The person | **Candidate** | "Applicant" only on `/apply/[token]` (matches candidate's framing); elsewhere "candidate" |
| Candidate in a specific vacancy's pipeline | **Application** | "Candidacy" (we don't use this term) |
| Candidate-level state | **Status** (derived: Active / Hired / Archived) | Never "general status" anywhere user-facing |
| Pipeline step | **Stage** (per-vacancy, customizable per Q3) | "Status" — that word is for candidate-level only |
| The 1–5 attribute grid | **Scorecard** (template = vacancy config; submission = per-interview) | "Evaluation" (technical, internal table name; not user-facing) |
| Candidate-form-answered Qs | **Screening questions** | "Knockout Qs" externally — internal flag only |
| Average of submitted scorecards | **Fit score** | "Rating", "Match score" |
| Interviewer's prompt list | **Interview guide** (deferred to v1.1) | — |

### 2.7 Copy rules (from design system)

- **Sentence case** for all UI labels, buttons, headings (NOT Title Case) — "Add candidate", not "Add Candidate"
- **Second person** in instructions — "When you're ready, accept or decline" / "Add a note about this candidate"
- **Plain CTA verbs** — "Schedule", "Send", "Save", "Cancel" (not "Submit", "Continue", "OK")
- **No emoji** — except: 🎉 on offer-accepted (S5c), 🌟 on first-run pipeline empty state (S01 empty state)
- **Warm empty states** — "No candidates yet — share your apply link to get started" (not "No data")
- **Badges = 8px radius** — not pills (16px radius reserved for action buttons)

### 2.8 What about "Incomplete"?

Per audit §2.11:

> *S10 says "RETIRE 'Incomplete' → say what's missing" — but `incomplete` is not in `application_statuses` or `candidate_statuses`. Grepped: I don't see this status anywhere. The complaint may refer to an old UI label that no longer exists.*

**Recommendation:** drop the "RETIRE Incomplete" item from S10. The term isn't in current taxonomy. If a future label uses it, the rule is: name what's missing instead. ("Missing CV", "Missing email", not "Incomplete").

---

## 3. Gaps + edge cases

### 3.1 Missing surfaces

| Surface | Why missing | Recommended action |
|---|---|---|
| Loading state for AI invocations | Each component has its own | `<AiDraftPanel status="generating" />` — shared spinner |
| Error state when AI call fails | Inconsistent today | `<AiDraftPanel status="error" />` — banner "Couldn't generate. [Try again]" |
| Long-running invocation (>10s) | No timeout indicator | After 10s: "Still working…" inline text; after 30s: "[Cancel]" link |
| Provenance — when was AI-assisted? | Today: not surfaced | The `<AiDraftTag />` could optionally show "AI-assisted Jun 17" on hover for audit transparency |
| User edited the AI draft significantly — still mark as AI-assisted? | Today: tag persists | Yes — any AI invocation that contributed to the final saved value gets the tag |
| Cost cap per org per month | Not surfaced | Defer to v1.1 — light-limits rate-limit per existing rate-limit memory pattern |

### 3.2 Edge cases

| Case | Today | New |
|---|---|---|
| Org has AI off (future per-org toggle) | N/A | Hide all invocation buttons; show "AI features off — enable in Settings" footer link |
| Long content piped into AI (e.g., 20-page CV) | Truncated or fails | Truncate with banner ("Using first 10K characters") |
| AI response in different language than UI | Returns as-is | Same — respect AI output; don't force translation |
| User clicks Apply with empty draft | Today: saves empty | Don't apply empty drafts — disable Apply when content is blank |
| User regenerates draft multiple times | Each call counts | Lightly rate-limit per session (e.g., 5 regenerates per minute) — light limits per repo memory |
| Streaming responses (token by token) | Not implemented for any feature | Out of scope v1; full response on completion |

### 3.3 Compliance

- **Disclosure**: "AI draft" / "AI-assisted" tags are sufficient under EU AI Act for low-risk advisory AI (the five S10 features). AI Fit Analysis requires more (see its own doc).
- **Provenance log**: each AI invocation writes to `activity_log` with `entity_type = 'ai_invocation'`, including feature + token cost. Existing pattern.
- **GDPR Art. 22**: humans confirm everything; no auto-applied AI. Pattern enforces.

---

## 4. Reuse opportunities

| Need | Reuse from | Notes |
|---|---|---|
| Existing AI components (UI shells) | Each `ai-*.tsx` component | **Wrap** in new `<AiDraftPanel />` shell; lift their internal logic; don't rewrite the AI calls |
| Existing API routes | Each `app/api/ai/*/route.ts` | Direct — unchanged |
| Existing `lib/ai/*.ts` modules | Direct — unchanged | The shape of the response is what flows into `<AiDraftPanel />` |
| Sparkle icon | `lucide-react` Sparkles icon | Direct (or wand2 — both used today; pick one) |
| Calm brand-blue token | Design system | Direct |
| Provenance audit log | `lib/audit-log.ts` | Add new `ai_invocation` event type |

**Net new code:**
- `<AiDraftPanel />` + `<AiDraftTag />` shared components (~200 LOC)
- Sweep through 5 AI components to wrap their UI in the shared shell
- Sweep through every UI label across the product to apply terminology rules
- Retire `<AiInterviewQuestions />` + corresponding API route + `vacancies.interview_questions` JSONB column (per S04)
- `activity_log` writes from each AI call

---

## 5. DB / API changes

### 5.1 Schema

**Drop column** (greenfield per Q14 — no migration safety needed):

```sql
ALTER TABLE public.vacancies
  DROP COLUMN interview_questions;
-- The orphaned column from retired AiInterviewQuestions feature.
-- Already covered by S04 §5.1.
```

**No new tables.** `activity_log` already exists; just add a new event type.

### 5.2 Server actions / API

**Unchanged:**

- `app/api/parse-cv/route.ts` and the 5 `app/api/ai/*/route.ts` routes — same input/output

**Modified:**

- Each AI call site (component or server action) writes an `activity_log` entry on invocation with `ai_invocation` event type, feature name, and optional token cost
- Email drafter G-015 retirement is already complete; just verify no dead code

**Retired:**

- `app/api/ai/interview-questions/route.ts` — delete
- `lib/ai/interview-questions.ts` — delete
- `components/vacancies/ai-interview-questions.tsx` — delete (per S04)

---

## 6. Effort estimate

### 6.1 Wave 1.6 — AI reframing (the redesign Wave 1 item)

| Task | Effort | Reuse |
|---|---|---|
| `<AiDraftPanel />` shared shell | `S` | New, ~120 LOC |
| `<AiDraftTag />` provenance pill | `S` | New, ~30 LOC |
| Sweep 5 existing AI components into shared shell | `S` × 5 | Refactor each |
| Calm-blue icon swap (sparkle vs alarm) | `S` | CSS / icon swap |
| Loading + error states in shared shell | `S` | Included |
| `activity_log` writes from each AI call | `S` | Add to call sites |
| Retire AiInterviewQuestions + drop column | `S` | Per S04 |
| Light rate-limit on regenerate (5/min/session) | `S` | Light limits per memory |

**Wave 1.6 total: ~M** (2 weeks elapsed).

### 6.2 Wave 1.5 — Terminology sweep

| Task | Effort | Reuse |
|---|---|---|
| Audit `docs/ui-texts.md` for current strings | `S` | Existing doc |
| Apply terminology rules (Vacancy / Stage / Status / Scorecard / Fit score) | `M` | Multi-file sweep |
| Apply copy rules (sentence case / second person / plain CTAs) | `M` | Multi-file sweep |
| Confirm "Incomplete" isn't in code (just to be sure) | `S` | grep |
| Confirm no emoji except sanctioned ones | `S` | grep |
| Update `docs/ui-texts.md` with locked terms | `S` | Documentation |

**Wave 1.5 total: ~M** (2-3 weeks elapsed — the sweep across 60+ pages is the bulk of the work).

### 6.3 Coordination

- **Wave 1.5 + 1.6 should run in parallel** — both are sweep work, both ship in the same release
- Coordinates with **every other flow** — S10 patterns are referenced inline in S01, S02, S04, S04d, S05, S05c
- Coordinates with **`ai-fit-analysis.md`** — AI Fit uses S10's `<AiDraftPanel />` + adds 6 extra guardrails

---

## 7. Open questions

### 7.1 RESOLVED via locked decisions

| Question | Status |
|---|---|
| Calm framing over alarm orange | ✅ Locked |
| Single AI pattern (4-step) | ✅ Locked |
| 5 features (not 6) | ✅ Confirmed — AI Interview Questions retires per S04 |
| AI Fit Analysis separate | ✅ Per `ai-fit-analysis.md` |
| "Incomplete" retirement | ✅ Stale per audit §2.11 — no action needed |
| 4-category Settings + Vacancy / Application / Stage / Status taxonomy | ✅ Per other locked decisions |

### 7.2 NEW — surfaced by this analysis

- **Q-S10-a:** **Provenance tag persistence** — does the "AI-assisted" tag stay on a field forever, or expire after N days / on next edit? *Lean: stay forever* — provenance is a compliance feature; recruiters can choose to remove it explicitly via field reset.
- **Q-S10-b:** **AI features org-level toggle** — ship in v1 (with a single org-level "AI off" toggle in Settings → Organization) or v1.1? *Lean: v1.1* — most orgs want AI on; toggle adds Settings surface complexity. AI Fit Analysis already has its own toggle.
- **Q-S10-c:** **Token cost surfacing** — show recruiters the AI cost per invocation (transparency) or hide (premium feel)? *Lean: hide for v1* — surfaces a cost model the recruiter didn't sign up to monitor.
- **Q-S10-d:** **Streaming responses** — for long AI outputs (JD generation, candidate summary), ship streaming UI v1 or v1.1? *Lean: v1.1* — adds Server-Sent Events infrastructure; current full-response pattern works fine at 5-10s latency.
- **Q-S10-e:** **Regenerate rate limit** — 5/min/session (lean) — or finer-grained per-feature limits? *Lean: 5/min/session global* — light limits per repo memory; per-feature adds Redis-scoped state.
- **Q-S10-f:** **Sanctioned emoji** — 🎉 on offer accept + 🌟 on first-run empty state. Add others (e.g., ✓ on success states)? *Lean: those two only* — keeps the design system constraint tight; check icons are SVGs, not emoji.
- **Q-S10-g:** **Sparkle icon — `Sparkles` or `Wand2`** (both in use today). *Lean: `Sparkles`* — neutral, broadly recognized; "wand" implies magic which conflicts with "AI is a tool, not magic" framing.

---

## 8. Test plan

### 8.1 Functional

- [ ] `<AiDraftPanel />` renders draft content with calm-blue accent
- [ ] Apply button commits to DB
- [ ] Regenerate calls AI again
- [ ] Cancel discards draft
- [ ] No orange / alarm styling on any AI surface
- [ ] All 5 features wrapped in `<AiDraftPanel />`
- [ ] "AI-assisted" tag persists on saved fields
- [ ] AI Interview Questions surface fully removed
- [ ] `vacancies.interview_questions` column dropped
- [ ] `activity_log` records every AI invocation
- [ ] Loading state shows during generation
- [ ] Error state shows on failure
- [ ] Long invocation shows "Still working…" + Cancel
- [ ] Empty draft can't be Applied
- [ ] Regenerate rate-limit caps at 5/min/session

### 8.2 Terminology sweep

- [ ] No "Job" / "Role" / "Position" in nav strings (Vacancy locked)
- [ ] No "General Status" anywhere user-facing
- [ ] No "Incomplete" anywhere
- [ ] No Title Case headings
- [ ] No first-person ("I", "my") in instructions
- [ ] No "Submit" / "Continue" / "OK" CTAs
- [ ] No emoji except 🎉 (offer accept) + 🌟 (first-run)
- [ ] All badges 8px radius
- [ ] Sentence case everywhere

### 8.3 Regression

- [ ] All 5 retained AI features still produce valid output
- [ ] CV parse continues to prefill fields correctly
- [ ] JD generation continues to draft section content
- [ ] Bias check continues to flag exclusionary phrases
- [ ] Candidate summary continues to generate on-demand
- [ ] Scorecard from notes continues to structure pasted text

### 8.4 Accessibility

- [ ] Calm-blue tag has sufficient contrast (WCAG AA)
- [ ] Sparkle icon has aria-label
- [ ] AI draft fields are properly labeled as editable
- [ ] Apply button has clear focus state

---

## 9. Verification

Aligned with [`docs/claude-code-workflow.md`](../../claude-code-workflow.md) Phase 5:

- [ ] All sub-tasks in §6 complete
- [ ] Tests in §8 pass
- [ ] Docs updated:
  - [ ] `docs/3-architecture/frontend.md` — `<AiDraftPanel />` pattern
  - [ ] `docs/8-decisions.md` — Q-S10-a through Q-S10-g decisions
  - [ ] `docs/ui-texts.md` — full terminology lock + copy rules (centerpiece doc for this flow)
  - [ ] `docs/9-compliance/ai-features.md` — confirm 5-feature accounting; AI Interview Questions retirement
- [ ] Ripple check — every AI surface uses the new shared shell
- [ ] Ripple check — every UI label conforms to terminology rules

---

## 10. What to do after reading

1. **Confirm Q-S10-a through Q-S10-g** (or override).
2. **Decide Q-S10-b (org-level AI toggle)** — affects Settings surface scope.
3. **Decide Q-S10-g (sparkle vs wand icon)** — quick visual decision.
4. **The corpus is complete.** All 10 flows + audit + roadmap + AI Fit + mobile docs are written. Next step in your process is implementation start — Phase 0 of the revised roadmap.

---

## Appendix — file inventory for this flow

**New files:**

| File | Purpose |
|---|---|
| `components/ui/ai-draft-panel.tsx` | The shared shell |
| `components/ui/ai-draft-tag.tsx` | Provenance pill |
| `lib/ai/rate-limit.ts` | Regenerate rate limit (5/min/session) |
| `lib/audit-log/ai-invocation.ts` | Helper to write `ai_invocation` event |
| `scripts/055_drop_vacancies_interview_questions.sql` | Per S04 |

**Modified files (wrap with shared shell):**

| File | Change |
|---|---|
| `components/vacancies/ai-jd-suggest.tsx` | Wrap in `<AiDraftPanel />`, drop alarm orange |
| `components/vacancies/ai-bias-check.tsx` | Same |
| `components/vacancies/ai-assessment-suggester.tsx` | Same |
| `components/candidates/ai-summary-panel.tsx` | Same |
| `components/candidates/ai-notes-extractor.tsx` | Same |
| `components/apply/apply-form.tsx` | CV parse "AI-filled · review" tag |
| `components/candidates/candidate-form.tsx` | Same |

**Retired files:**

| File | Reason |
|---|---|
| `components/vacancies/ai-interview-questions.tsx` | No home in 5-tab structure per S04 |
| `app/api/ai/interview-questions/route.ts` | Same |
| `lib/ai/interview-questions.ts` | Same |

**Terminology sweep — every file with user-facing strings (multi-file sweep):**

- `app/(dashboard)/**/page.tsx` (60+ files)
- `components/**/*.tsx` (200+ files)
- `app/auth/**/page.tsx` (~10 files)
- `app/jobs/`, `app/apply/`, `app/status/`, `app/offer/`, `app/scorecard/` (public)
- `docs/ui-texts.md` — central registry

**Docs touched:**
- `docs/3-architecture/frontend.md`
- `docs/8-decisions.md`
- `docs/ui-texts.md` (the big one — terminology + copy rules)
- `docs/9-compliance/ai-features.md` (confirm 5-feature accounting)

**Tests added:**
- `tests/components/ui/ai-draft-panel.test.tsx` — all 4 states (invoke / draft / review / confirm)
- `tests/components/ui/ai-draft-tag.test.tsx`
- `tests/lib/ai/rate-limit.test.ts` — 5/min cap
- `tests/lib/audit-log/ai-invocation.test.ts`
- Integration tests verifying each of the 5 AI surfaces uses the shared shell

---

## Bookend — the corpus is complete

With S10 written, the redesign corpus is finished:

- **Audit + roadmap + AI Fit Analysis** — three locked system documents
- **10 flow docs** — every screen and process specified
- **4 mobile design docs** — every must-work-on-phone surface
- **Source materials** — extracted in `redesign/` (gitignored)

**Next steps belong to implementation, not design.** Per the roadmap:

1. **Phase 0** — fix Migration 022 trigger bug, pick canonical screen files, design custom-stages schema, book legal consult for AI Fit Analysis
2. **Wave 1** — settings regroup, terminology sweep, AI reframing, trial pill, derive status
3. **Wave 2** — global pipeline, candidate profile rebuild, vacancy detail rebuild, scorecard system, custom stages, creation wizards
4. **Wave 3** — public pages polish, public offer flow, landing refresh, AI Fit Analysis (with six guardrails)

The redesign is no longer a stack of design files — it's a complete brief that ties every visual, every interaction, every flow, every server action, every schema change, every test, and every doc to a single coherent plan.
