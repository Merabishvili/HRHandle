# Tech debt — redesign project

> **Purpose.** One file collecting everything that's accumulated as
> tech debt across the redesign work — partial implementations,
> deferred follow-ups, design-system extractions, lint warnings, and
> known gaps the audits have surfaced. Lives alongside
> [`fidelity-audit.md`](fidelity-audit.md): the audit tracks "does the
> implementation match the design", this doc tracks "is the
> implementation itself paid down".
>
> **Process going forward:** add a row when work is deferred; strike
> through + move to the Changelog when paid down. Don't let things
> hide in commit messages.

## Severity legend

- 🔴 **Blocks future work** — until paid down, the next planned wave can't ship cleanly.
- 🟡 **Known limitation users feel** — visible behaviour gap or partial wiring.
- 🟢 **Cleanup / consolidation** — internal hygiene, no user-visible effect.

---

## 1 · Schema cutover pending

### Wave 2.6 — fully shipped ✅

All five slices landed end-to-end. See the changelog below for what each one covered.


---

## 2 · Forward-compat surfaces partially wired

### 🟡 Notification preferences — email side not consumed

`profiles.notification_preferences` JSONB column collects all 6 email + 2 in-product toggles. In-product side is wired (the bell respects the toggles). Email side is collected but the dispatcher never consults them.

**Why:** when this was deferred, almost all email sends went to candidates / invitees (external recipients who can't opt out). The opt-out table only matters for recruiter-facing emails, which is a smaller set.

**What needs to happen:**
- Identify recruiter-facing email events (digest summaries, vacancy-activity alerts).
- Update each dispatcher branch to read `notification_preferences.email.{event_key}` and skip if `false`.
- Add a `lib/notifications/email-preferences.ts` helper that wraps the read so callers don't reach into the JSONB shape directly.

**Files touched on integration:** any place that calls `sendEmail()` for a recruiter — currently scattered in `lib/actions/applications.ts`, `lib/actions/interviews.ts`, etc.

### 🟡 `<AiDraftPanel />` shell — built but underused

The shell was built in Wave 1.6 to be the standard 4-state container (`idle / generating / ready / error`) for AI features. Each existing AI component has its own state machine that pre-dates the shell.

**Why deferred:** the existing components already use `<AiDraftTag />` for the calm-tag swap (per Wave 1.6 proper), which was the user-visible win. Migrating them to the shell is purely internal consolidation.

**Files:**
- [`components/candidates/ai-summary-panel.tsx`](../../components/candidates/ai-summary-panel.tsx)
- [`components/candidates/ai-notes-extractor.tsx`](../../components/candidates/ai-notes-extractor.tsx)
- [`components/vacancies/ai-jd-suggest.tsx`](../../components/vacancies/ai-jd-suggest.tsx)
- [`components/vacancies/ai-bias-check.tsx`](../../components/vacancies/ai-bias-check.tsx)
- [`components/vacancies/ai-interview-questions.tsx`](../../components/vacancies/ai-interview-questions.tsx)
- [`components/vacancies/ai-assessment-suggester.tsx`](../../components/vacancies/ai-assessment-suggester.tsx)

### 🟡 CV parse — fields auto-fill silently, no provenance affordance

When a candidate uploads a CV to [`/apply/[token]`](../../app/apply/[token]/page.tsx) and the parse succeeds, the form fields fill in with no visible "AI-filled · review" tag. The design ([`AI and Terminology System.dc.html`](../../redesign/AI and Terminology System.dc.html) §3) specifies that this surface should carry the tag — every AI feature gets the same calm-tag treatment.

**What needs to happen:** add `<AiDraftTag label="AI-filled · review" />` above the "About you" section in [`components/apply/apply-form.tsx`](../../components/apply/apply-form.tsx) when `parseState === 'done'`, conditional on the candidate having actually accepted the prefill (not when they manually clear it).

Effort: S.

---

## 3 · Wave 2.1 — features dropped from initial scope

### 🟡 Compact-mode "Sort: fit ▾" dropdown

Version C of [`Pipeline Versions.dc.html`](../../redesign/Pipeline Versions.dc.html) shows a "Sort: fit ▾" trigger between the Board/List toggle and the Review-new button when density is `compact`. The dropdown lets the recruiter sort the column-internal card order by fit score (high → low) so the highest-scoring candidates float to the top.

**Why deferred:** the Wave 2.1 V-B build needed to ship; sort was a secondary affordance.

**What needs to happen:** add a `sortMode: 'default' | 'fit-desc' | 'fit-asc'` state to [`CrossVacancyBoard`](../../components/pipeline/cross-vacancy-board.tsx), expose it only in compact density, sort `cardData` inside `cardsByStageCode` accordingly. The List view should respect it too.

Effort: S.

### 🟡 Bulk reject — currently does a silent status flip, no personalised email

The `BulkBar`'s "Reject" action moves all selected applications to the rejected status with no per-candidate rejection email. The audit notes this is by design ("for the cases where the recruiter just wants to clear the column") but it's a sharp edge — single-card rejection runs the full personalised rejection-email flow via `RejectionDialog`.

**What needs to happen:** decide whether to surface a "Send rejection email to all" toggle inside `BulkBar` that runs the rejection-template per candidate. Or keep the silent flip and add an explicit note in the confirm dialog.

Effort: S.

---

## 4 · Design-system extraction debt

### 🟡 Brand `oklch` values repeated inline across many files

Tier 1–3 fidelity fixes shipped with arbitrary Tailwind values like `bg-[oklch(0.55_0.18_250)]` (brand-blue primary), `bg-[oklch(0.93_0.05_250)]` (pale brand-blue tint), `text-[oklch(0.42_0.16_250)]` (brand-blue text). Same triplet now lives in:

- [`components/offers/offer-respond-form.tsx`](../../components/offers/offer-respond-form.tsx)
- [`components/settings/settings-nav.tsx`](../../components/settings/settings-nav.tsx)
- [`app/jobs/[slug]/page.tsx`](../../app/jobs/[slug]/page.tsx)
- [`app/apply/[token]/page.tsx`](../../app/apply/[token]/page.tsx)
- [`components/apply/apply-form.tsx`](../../components/apply/apply-form.tsx)
- [`app/offer/[token]/page.tsx`](../../app/offer/[token]/page.tsx)
- [`lib/pipeline/stage-style.ts`](../../lib/pipeline/stage-style.ts)
- [`components/pipeline/cross-vacancy-card.tsx`](../../components/pipeline/cross-vacancy-card.tsx)
- (and a few more)

**What needs to happen:** define CSS variables in [`app/globals.css`](../../app/globals.css) for the redesign palette — `--brand-primary`, `--brand-primary-pale-bg`, `--brand-primary-pale-text`, `--brand-amber-urgent`, `--brand-amber-soon` etc. Then replace inline `oklch(...)` arbitrary values with `bg-[var(--brand-primary)]` (or build a small Tailwind plugin / theme extension that maps them to tokens).

Once that's done, future surfaces don't need to remember exact oklch coordinates and the brand can be re-themed in one file.

Effort: S — mechanical extraction, but touches every Tier 1–3 file.

### 🟢 Avatar hues hardcoded

[`components/pipeline/cross-vacancy-card.tsx`](../../components/pipeline/cross-vacancy-card.tsx) defines a 5-element `AVATAR_HUES` array inline. The same scheme is used (or should be) on the candidate-profile header avatar and the settings-nav avatar.

**What needs to happen:** lift to `lib/avatar-hues.ts` (or wherever fits), make sure all avatars on the recruiter surfaces use the same deterministic-by-seed scheme.

---

## 5 · Status page — design language drift

### 🟡 Bucket labels don't match candidate-friendly design copy

[`Public Pages.dc.html`](../../redesign/Public Pages.dc.html) §3 status-page section uses **"Received" / "Under review" / "Interview" / "Decision"** as the candidate-facing stage labels. The code in [`lib/application-status-bucket.ts`](../../lib/application-status-bucket.ts) renders **"Applied" / "In review" / "Interview" / "Decision"** — "Applied" reads less candidate-friendly than "Received".

**What needs to happen:** swap `BUCKET_LABELS.applied` from `'Applied'` to `'Received'` and `BUCKET_LABELS.in_review` from `'In review'` to `'Under review'`. Tests at [`lib/__tests__/application-status-bucket.test.ts`](../../lib/__tests__/application-status-bucket.test.ts) hard-code the current labels and will need updates.

Effort: S — but watch for snapshot-style test assertions.

### 🟡 Stepper visual on `/status/[token]` doesn't match design

Design shows each bucket pill in its own colour-tinted shape with a ring shadow on the current bucket (`box-shadow: 0 0 0 3px oklch(0.55 0.18 250 / 0.12)`). Existing [`StatusStepper`](../../components/status/status-stepper.tsx) renders a different visual.

Effort: S — purely visual swap on the existing component.

---

## 6 · Settings sub-pages — fidelity not yet applied

Tier 2 paid down the **sidebar chrome**. The actual sub-page panels (Organization, Team, Custom fields, Email templates, Rejection reasons, Integrations, Audit log, Trash) still don't read against [`Settings.dc.html`](../../redesign/Settings.dc.html). Each panel has design specifics (input shapes, prefix-segmented URL field on Organization, member-row layout on Team, etc.) that haven't been audited screen-by-screen.

**What needs to happen:** extend [`fidelity-audit.md`](fidelity-audit.md) with one section per settings panel, then patch each per Tier 1–3 style.

Effort: M — 8 small per-screen audits + targeted patches.

---

## 7 · Unbuilt mobile designs

Four `mobile/*.md` design docs exist in [`docs/redesign/mobile/`](mobile/) and none are built:

- [`mobile/apply-form.md`](mobile/apply-form.md) — single-column form, sticky CTA, camera-as-CV fallback, screening questions
- [`mobile/candidate-profile.md`](mobile/candidate-profile.md) — collapsing rail to below content, stage-contextual block as bottom sheet
- [`mobile/offer-approval.md`](mobile/offer-approval.md) — hero summary tile, accept/decline as primary surface, countdown visibility
- [`mobile/today-interviews.md`](mobile/today-interviews.md) — phone-checking-interviews surface

**Partially shipped:** mobile **autofill hints** + the brand-blue submit on `/apply/[token]` landed in earlier polish commits. The structural layouts (sticky CTA, bottom-sheet rail) haven't.

Effort: M per mobile flow.

---

## 8 · Lint warnings (pre-existing — 23 total)

Acceptable today (no errors), worth a future cleanup pass:

| Rule | Count | Severity | Notes |
|---|---|---|---|
| `jsx-a11y/no-autofocus` | 6 | 🟢 | `autoFocus` on inputs in danger-zone delete confirm, date picker, rejection-reasons add, add-candidate-to-vacancy dialog. Mostly intentional UX. |
| `@typescript-eslint/no-unused-vars` | 2 | 🟢 | `actionTypes` type-only var in two `use-toast` files. shadcn boilerplate. |
| `@next/next/no-img-element` | 1 | 🟡 | `<img>` in `organization-form.tsx` logo preview. Switching to `next/image` needs dynamic-src config. |
| `jsx-a11y/role-has-required-aria-props` | 1 | 🟡 | `combobox` role on `searchable-select.tsx` missing `aria-controls` / `aria-expanded`. Real a11y bug. |
| `jsx-a11y/anchor-has-content` | 1 | 🟡 | `PaginationLink` shadcn component — false positive (children come from props) but worth a typed-children fix. |
| Other | 12 | 🟢 | Mix of `no-autofocus` echoes and shadcn defaults. |

---

## 9 · Old per-vacancy kanban — keep or unify?

`/vacancies/[id]/pipeline` uses the legacy [`KanbanBoard`](../../components/pipeline/kanban-board.tsx) + [`KanbanColumn`](../../components/pipeline/kanban-column.tsx) + [`CandidateCard`](../../components/pipeline/candidate-card.tsx). The new cross-vacancy board has [`TintedKanbanColumn`](../../components/pipeline/tinted-kanban-column.tsx) + [`CrossVacancyCard`](../../components/pipeline/cross-vacancy-card.tsx) with the Version B colour treatment.

The per-vacancy board now looks **visually inconsistent** with the cross-vacancy board (plain dashed columns vs colour-tinted; neutral cards vs coloured spines).

**Two paths:**
1. **Unify** — replace the per-vacancy `KanbanBoard` with a thin wrapper around `CrossVacancyBoard` that pre-applies a single-vacancy filter and hides the role-filter dropdown. Pro: one code path. Con: a bigger touch.
2. **Match-style** — keep the two boards separate but bring the per-vacancy board's columns/cards up to the same Version B treatment. Pro: smaller change. Con: two code paths to maintain.

Path 1 is the right long-term call after Wave 2.6 (per-vacancy custom stages need the per-vacancy board to read from `pipeline_stages`, not the global table). Worth doing at the same time.

Effort: M as part of Wave 2.6.

---

## 10 · Other small items

### 🟢 `/api/onboarding` HTTP route still exists

[`app/api/onboarding/route.ts`](../../app/api/onboarding/route.ts) is the legacy entry point for self-fetch onboarding. The dashboard layout now calls [`runOnboarding()`](../../lib/onboarding.ts) directly per the CLAUDE.md "do not revert to HTTP self-fetch" note. The HTTP route is kept for "external use" but has no documented external consumer. Candidate for deletion if no one's hitting it.

### 🟢 Bulk-reject confirm uses native `confirm()`

[`CrossVacancyBoard.handleBulkReject`](../../components/pipeline/cross-vacancy-board.tsx) uses `window.confirm()` for the bulk-reject confirm. Native `confirm()` looks rough on mobile. Same fix the offer page already did (swap to `AlertDialog`).

Effort: S.

### 🟢 Apply form "ABOUT THE JOB" header

The source string is `'About the job'` (sentence case per my earlier sweep), but the className still includes `uppercase`. CSS forces it to render as `ABOUT THE JOB`. The design intentionally renders uppercase via CSS — so the visual is correct, but the source string is misleading. Either drop the CSS uppercase + use literal `'ABOUT THE JOB'`, or document the source-vs-render mismatch.

Effort: trivial.

---

## Changelog — paid down

- **2026-06-20 — Wave 2.5 Slice 1 (scorecard attribute must-have flag).** Migration [`047_vacancy_questions_must_have.sql`](../../scripts/047_vacancy_questions_must_have.sql) added `vacancy_questions.must_have BOOLEAN NOT NULL DEFAULT false`. New `bulkCreateVacancyQuestions` and `toggleVacancyQuestionMustHave` server actions in [`lib/actions/evaluations.ts`](../../lib/actions/evaluations.ts). The vacancy create wizard's Step 4 attributes now persist with their star flags; the vacancy detail Scorecard tab renders + edits the star inline. Slice 2 (screening questions) remains as a separate tech-debt entry above.
- **2026-06-20 — Wave 2.5 Slice 2a (screening questions schema + recruiter UI).** Migration [`048_vacancy_screening_questions.sql`](../../scripts/048_vacancy_screening_questions.sql) added two tables: `vacancy_screening_questions` (label + answer_type + is_knockout + knockout_answer + sort_order) and `application_screening_answers` (pre-computed `is_knockout_flag` per application × question). New actions in [`lib/actions/screening-questions.ts`](../../lib/actions/screening-questions.ts) (`bulkCreateScreeningQuestions`, `listScreeningQuestionsForVacancy`, `deleteScreeningQuestion`). The vacancy create wizard's Step 4 now persists screening questions as `yes_no` rows; the vacancy detail Scorecard tab grew a new "Screening questions" card with add/remove/knockout-toggle. Slice 2b (apply form integration + answers writer) tracked separately above.
- **2026-06-22 — Wave 2.5 cleanup (non-yes/no answer types in the wizard).** Closes the 🟢 follow-up. The vacancy-create wizard's Step 4 + the vacancy-detail Scorecard tab's Screening Questions card now both capture all four `answer_type` values (`yes_no` / `short_text` / `number` / `select`). For `select`, a comma-separated options input feeds into the schema's `options` JSONB column. Knockout toggle is gated to `yes_no` and `select` (the only types with a canonical wrong-answer comparison). [`normalizeScreeningQuestionEntries`](../../lib/screening-questions/normalize.ts) enforces the invariants — short_text / number always normalize to informational; select drops entries with no usable options; the first option becomes the knockout answer when set. 11 vitest cases (was 5). [`bulkCreateScreeningQuestions`](../../lib/actions/screening-questions.ts) now writes the `options` column. The apply form was already wired to render every answer type in Slice 2b, so no candidate-side changes were needed.
- **2026-06-22 — Migration 052 (recreate candidate-status sync trigger on pipeline_stage_id).** Closes the small UX regression Migration 051 left behind: the candidate-index "inactive when all apps closed" sweep is restored. Migration [`052_recreate_candidate_status_sync_trigger.sql`](../../scripts/052_recreate_candidate_status_sync_trigger.sql) recreates `trg_sync_candidate_status` keyed on `applications.pipeline_stage_id` and `pipeline_stages.is_terminal` instead of the legacy `status_id` + `application_statuses.code` join. Custom rejection stages ("Closed - not a fit") count as closed because they're flagged terminal. Idempotent.
- **2026-06-20 — Wave 2.6 Slices 2c + 4 (tail reads cutover + Migration 051).** Closes Wave 2.6. Migration [`051_drop_applications_status_id.sql`](../../scripts/051_drop_applications_status_id.sql) drops the legacy `applications.status_id` column. Prior to the drop: every reader switched off it ([candidate detail page](<../../app/(dashboard)/candidates/[id]/page.tsx>) bucket-maps via the joined `pipeline_stages` row; [reports/queries.ts](../../lib/reports/queries.ts) uses an in-app bucket filter for hired-derived metrics; [export route](../../app/api/export/applications/route.ts) labels by `pipeline_stages.name`; the two pipeline pages joined the stage directly). Every writer stopped setting status_id (`createCandidate` linked path, `createApplication`, `updateApplicationStatus`, `rejectApplication`, `withdrawApplicationByToken`, `submitPublicApplication`, offers accept-hire). `moveApplicationsBatch`'s skip-detection now compares the bucket-mapped current code against the target status's code instead of comparing status_ids directly. [`Application` type](../../lib/types/application.ts) + [Zod schema](../../lib/validations/application.ts) have status_id replaced by pipeline_stage_id. The canonical `application_statuses` table itself stays (still used by the cross-vacancy board's column model, the wizard's starting-stage picker, and the rejection dialog's `rejectedStatusId` handoff). Wave 2.6 is now complete.
- **2026-06-20 — Wave 2.6 Slice 3 (Pipeline Stages Manager UI).** The Vacancy Detail Settings tab's old "+ Add stage SOON" pill is replaced by a real editor. New server actions [`lib/actions/pipeline-stages.ts`](../../lib/actions/pipeline-stages.ts) (createPipelineStage / updatePipelineStage / deletePipelineStage / reorderPipelineStages) cover name edits, type picker (standard / review / interview / offer), drag-reorder, and add/delete. New component [`components/vacancies/pipeline-stages-manager.tsx`](../../components/vacancies/pipeline-stages-manager.tsx) uses @dnd-kit/sortable + an Add-stage dialog with a 2×2 type-card grid (per the Custom Stages design). Delete is blocked when any application currently sits on the stage (the FK is ON DELETE SET NULL — we'd rather make the recruiter move them than orphan rows). Cap-10 enforced both client-side (button disabled at 10) and by the existing Migration 046 trigger. Org-admin role gate matches `bulkCreateVacancyQuestions` et al.
- **2026-06-20 — Wave 2.6 Slice 2b (per-vacancy pipeline view cutover).** The `/vacancies/[id]/pipeline` page now reads `pipeline_stages` directly and renders the vacancy's own custom-stage names + types. New server action [`updateApplicationPipelineStage`](../../lib/actions/applications.ts) delegates to `updateApplicationStatus` for audit/email/webhook reuse, then overwrites `pipeline_stage_id` with the recruiter's specific drop target so custom stages like "Sourced" don't collapse to the canonical default. `rejectApplication` grew an optional `targetPipelineStageId` so dropping onto a custom rejection stage ("Closed - not a fit") keeps that stage rather than snapping to the seeded "Rejected". `KanbanBoard` + `KanbanColumn` rebuilt around a generic `PipelineColumn` shape ({id, name, type, is_terminal, sort_order}); column badge color uses the bucket-mapper to pick from the canonical palette. `RejectionDialog` accepts + threads `targetPipelineStageId`. No DB changes — Slice 1's dual-write made this purely a read-side refactor.
- **2026-06-20 — Wave 2.6 Slice 2a (cross-vacancy bucket-mapper + `/pipeline` cutover).** New pure helper [`lib/pipeline-stages/bucket.ts`](../../lib/pipeline-stages/bucket.ts) maps a `pipeline_stages` row (type + name + is_terminal) to a canonical `application_statuses.code` (applied / screening / interview / offer / hired / rejected / withdrawn) so per-vacancy custom stages collapse back to the cross-vacancy board's unified column model. Includes case-insensitive keyword fallback for custom terminal names ("Re-hired" → hired, "Closed - not a fit" → rejected). 9 vitest cases. The [`/pipeline` page](<../../app/(dashboard)/pipeline/page.tsx>) joins `pipeline_stages` on each application and uses the bucket-mapper to resolve which canonical column each app sits in; the `CrossVacancyBoard` component contract is unchanged. Tail reads (per-vacancy pipeline view, candidate profile, reports) tracked separately above.
- **2026-06-20 — Wave 2.6 Slice 1 (pipeline_stage_id foundation).** Migration [`049_applications_pipeline_stage_id.sql`](../../scripts/049_applications_pipeline_stage_id.sql) added `applications.pipeline_stage_id UUID REFERENCES pipeline_stages(id)` (nullable for now), seeded `pipeline_stages` for every vacancy that didn't have them, and backfilled `pipeline_stage_id` from the legacy `status_id` → `application_statuses.code` → `pipeline_stages.name` mapping. New pure helper [`lib/pipeline-stages/resolve.ts`](../../lib/pipeline-stages/resolve.ts) (with 9 vitest cases) maps a legacy code to the matching per-vacancy stage. Every application writer now sets both columns: [`createCandidate`](../../lib/actions/candidates.ts) (linked-vacancy path), [`createApplication`](../../lib/actions/applications.ts), [`updateApplicationStatus`](../../lib/actions/applications.ts), [`rejectApplication`](../../lib/actions/applications.ts), [`withdrawApplicationByToken`](../../lib/actions/applications.ts), [`submitPublicApplication`](../../lib/actions/public-apply.ts). [`createVacancy`](../../lib/actions/vacancies.ts) now calls `seed_default_pipeline_stages()` after insert; [`duplicateVacancy`](../../lib/actions/vacancies.ts) copies the source's stages instead. Reads still go through `status_id` — Slice 2 flips them.
- **2026-06-20 — Wave 2.5 Slice 2b (apply-form integration + knockout flag surface).** The public apply form ([`/apply/[token]`](../../app/apply/[token]/page.tsx)) now renders the vacancy's screening questions between personal details and the GDPR notice; `yes_no` answers are rendered as a brand-blue Yes/No pill pair, the other answer types as text/number/select inputs. The form posts `screening_answers_json`; [`submitPublicApplication`](../../lib/actions/public-apply.ts) persists `application_screening_answers` with `is_knockout_flag` pre-computed via the new [`computeIsKnockoutFlag`](../../lib/screening-questions/compute-flag.ts) helper (case-insensitive, trimmed match against `knockout_answer`). The candidate profile's Screening-stage block now shows a "Screening flags" callout listing each flagged question with the candidate's answer + expected answer, so the recruiter sees the gate signal before deciding whether to advance. Per the design, candidates are never told their answer triggered a flag.
