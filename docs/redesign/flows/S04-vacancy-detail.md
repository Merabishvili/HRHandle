# S4 · Vacancy detail — flow analysis

> **Status:** Draft 1, authored 2026-06-17. Built against the user-uploaded `Vacancy Detail.dc.html` (Version B Overview locked).
>
> **Sources:** [`Vacancy Detail.dc.html`](../../../redesign/Vacancy%20Detail.dc.html), [`audit.md` §4.4](../audit.md#44-·-s4-·-vacancy-detail-vacancy-detaildchtml), [`roadmap.md` Wave 2.4–2.6](../roadmap.md). Mobile: out of scope (vacancy detail is desktop-by-nature).
>
> **Why this is second.** Vacancy detail is the per-role workspace. Wave 2.4 rebuild + Wave 2.5 scorecard system + Wave 2.6 custom stages all converge on this surface. It also resolves the audit's biggest ambiguity (where does the Candidates list live?) per the locked Q9 decision: applications list moves to the Pipeline deep-link route.

---

## 1. Current implementation

### Route

[`app/(dashboard)/vacancies/[id]/page.tsx`](../../../app/(dashboard)/vacancies/[id]/page.tsx) — **706 lines**, the biggest dashboard page in the app. Edit form lives at [`app/(dashboard)/vacancies/[id]/edit/page.tsx`](../../../app/(dashboard)/vacancies/[id]/edit/page.tsx).

### Tabs today (4 tabs)

| Tab | Code anchor | What it shows |
|---|---|---|
| **Candidates** (default) | [line 482](../../../app/(dashboard)/vacancies/[id]/page.tsx#L482) | Toolbar (search + status filter) + Add candidate + Export CSV + applications list (`VacancyApplicationsList`) + Overview + Description + Requirements + Custom fields rail |
| **Assessment** (`?tab=qe`) | [line 636](../../../app/(dashboard)/vacancies/[id]/page.tsx#L636) | AI assessment suggester + two columns: Text questions (Questionary) + Score criteria (1–10) |
| **Apply Link** (`?tab=application-form`) | [line 684](../../../app/(dashboard)/vacancies/[id]/page.tsx#L684) | `ApplicationFormTab` — public token + copy link |
| **Interview questions** (`?tab=interview-questions`) | [line 694](../../../app/(dashboard)/vacancies/[id]/page.tsx#L694) | AI-generated interview Q set saved as JSONB on `vacancies.interview_questions` |

### Header today

- Back arrow → vacancies list
- Title + `VacancyStatusSelect` (Open/Draft/On hold/Closed/Archived)
- Meta row: Department, Location, Salary, "Posted Nd ago"
- Action buttons (right side):
  - `LinkedInPostJobButton` (if integration connected)
  - **`Pipeline` button** (`/vacancies/[id]/pipeline`) — **already exists** ([line 426](../../../app/(dashboard)/vacancies/[id]/page.tsx#L426))
  - `DuplicateVacancyButton`
  - `DeleteVacancyButton`
  - "Edit vacancy" button → `/vacancies/[id]/edit`

### Right rail today (only on Candidates tab)

- **Overview card:** Status / Applicants count / Employment / Openings / Sector / Start date / End date / Salary
- **Job Description** card (whitespace-pre-wrap)
- **Requirements** card
- **Additional Information** (custom field values)

### Components in scope

| Component | Path | Lines | Reuse fate |
|---|---|---|---|
| `VacancyApplicationsList` | `components/vacancies/vacancy-applications-list.tsx` | 267 | Moves to Pipeline route ([S01](S01-pipeline.md)) — no longer rendered on vacancy detail |
| `VacancyApplicationsToolbar` | `components/vacancies/vacancy-applications-toolbar.tsx` | 86 | Same — moves to Pipeline |
| `VacancyQuestions` | `components/vacancies/vacancy-questions.tsx` | — | Becomes part of new Scorecard & questions tab; gets `must_have` flag + 1–5 scale |
| `AiAssessmentSuggester` | `components/vacancies/ai-assessment-suggester.tsx` | — | Moves to Scorecard & questions tab; relabeled per S10 ("AI draft · review") |
| `ApplicationFormTab` | `components/vacancies/application-form-tab.tsx` | — | Substantial rebuild — becomes drag-reorder field builder with live preview |
| `AiInterviewQuestions` | `components/vacancies/ai-interview-questions.tsx` | — | **Retired.** No home in 5-tab structure. Spec doesn't surface elsewhere |
| `LinkedInPostJobButton` | `components/vacancies/linkedin-post-job-button.tsx` | — | Stays in header |
| `DuplicateVacancyButton` | `components/vacancies/duplicate-vacancy-button.tsx` | — | Moves into header `⋯` menu (Duplicate) |
| `DeleteVacancyButton` | `components/vacancies/delete-vacancy-button.tsx` | — | Moves to Settings tab → Danger zone |
| `VacancyStatusSelect` | `components/vacancies/vacancy-status-select.tsx` | — | Moves to Settings tab → Status & visibility |
| `AddCandidateToVacancyDialog` | `components/vacancies/add-candidate-to-vacancy-dialog.tsx` | — | Header action (right side) |

### DB tables touched

| Table | Used for | Notes |
|---|---|---|
| `vacancies` | the row | `interview_questions` JSONB column gets dropped (orphaned with `AiInterviewQuestions` retirement). Migration 032 retires. |
| `vacancy_questions` | scorecard config | Greenfield rebuild per Q14 — add `must_have BOOLEAN`, change score scale 1–10 → 1–5 |
| `application_statuses` | legacy global 7-stage list | **Replaced** by per-vacancy `pipeline_stages` per Q3 |
| `pipeline_stages` | **NEW** — per-vacancy stages | Schema in [`roadmap.md` 2.6](../roadmap.md#26-✏️-revise-·-custom-stages-per-vacancy) |
| `custom_field_values` + `custom_field_schemas` | per-vacancy custom fields | Same as today |
| `applications` | for the Overview's "candidates peek" + counts | Read-only on this page; mutations happen on Pipeline route |
| `offers` | for "offer awaiting reply" alert in Overview | Read-only on this page |
| `interviews` | for "interview tomorrow" alert in Overview | Read-only on this page |

---

## 2. Proposed redesign

### Header — locked spec from upload

```
┌────────────────────────────────────────────────────────────────────────┐
│  Vacancies ›  Senior Business Analyst              [◄ Prev] [Next ►]   │
├────────────────────────────────────────────────────────────────────────┤
│  [briefcase icon] Senior Business Analyst  [Open]                       │
│  Full-time · Analytics · Tbilisi · opened 12d ago · ends 9/10/2026     │
│                                                                         │
│           [Copy apply link]  [View pipeline →]  [⋯]                    │
└────────────────────────────────────────────────────────────────────────┘
    Overview │ Job description │ Scorecard & questions │ Apply form │ Settings
```

- **Breadcrumb + prev/next role:** new — adds keyboard-style navigation between vacancies (sorted by recent activity).
- **Status badge** stays inline with title (read-only here; editable in Settings tab).
- **`[Copy apply link]`** is the new primary always-visible action — most-used on this page.
- **`[View pipeline →]`** replaces the current "Pipeline" button in icon/Layout-grid form. Same destination (`/vacancies/[id]/pipeline`), same component, more prominent.
- **`[⋯]` menu** consolidates: Duplicate · LinkedIn post (if connected) · Add candidate · Archive · Export CSV.

### Five tabs

#### Tab 1 — Overview (Version B locked + time-to-fill benchmark)

Two-column layout. Left = action-oriented content. Right rail = at-a-glance facts.

**Left column:**

1. **"Needs your attention · N" card** (amber accent) — the redesign's "Today" philosophy applied per-role. Lists:
   - Offer awaiting reply (with candidate avatar + days outstanding)
   - Interview today/tomorrow (with candidate avatar + time + "add scorecard after" link if completed)
   - New applicants to review (count + "Review →" link to `/vacancies/[id]/pipeline/review`)
   - Stale candidates (count, > 5 days no movement per Q-S01-c)
   - If nothing needs attention: card disappears entirely (don't show "All clear" — wastes vertical space).

2. **Compact funnel strip:** horizontal stage bar showing count per stage. 5–7 segments (one per non-terminal stage). Colored per `pipeline_stages.type`. Clickable per stage → opens Pipeline filtered to that stage.

3. **Candidates peek (top 5)** — small inline list:
   - Avatar + name + current stage badge + fit score
   - Sorted by fit score descending (NOT a comparative leaderboard — see [`ai-fit-analysis.md` Guardrail 1](../ai-fit-analysis.md#guardrail-1--strict-advisory-framing-never-ranks-never-filters-never-decides) for the constraint — the sort is by *human-entered* scorecard score, not AI score)
   - "View all in pipeline →" → `/vacancies/[id]/pipeline`

**Right rail:**

1. **At a glance card:** Time open · Active candidates · Salary range · End date · **Health** (green / amber / red — derived) · **Time-to-fill benchmark** (was Version A's contribution — kept per audit recommendation).
2. **Hiring team card:** Manager + Recruiters + "Add teammate" link.
3. **Share card:** Apply link with Copy button (same as `[Copy apply link]` header button — kept here for proximity to other share actions).

#### Tab 2 — Job description

Left card: formatted JD with **"Improve with AI"** (calm blue per S10) and **"Edit"** buttons. Edit opens an inline editor (no separate `/edit` route hop).

Right rail:
- **Posting details:** Visibility (Public/Private), Language, Last edited
- **Preview** card: "See exactly what candidates see on the public apply page" → opens public preview in new tab

#### Tab 3 — Scorecard & questions

The redesign's biggest structural addition. Two-card layout.

**Left: Interview scorecard** — locked 1–5 scale (per Q14). Each attribute row:
- Drag handle
- Attribute name (free text)
- **Must-have** tag (`★`) OR Nice-to-have tag
- "1–5" badge
- Delete (`X`)

Plus:
- **`[+ Add attribute]`** dashed row at bottom
- Header has **`[✨ Suggest from JD]`** — calls `AiAssessmentSuggester` (already exists) but with updated calm styling

**Right rail:**

1. **Screening questions card:**
   - Each question row: Q text + answer type tag (Knockout / Number / Short text / Select)
   - Knockout questions render in red with "Must = Yes" hint
   - **`[+ Add question]`** dashed row
2. **"How this drives scoring" explainer card** (blue accent):
   1. Questions → knockout flags at screening
   2. Attributes → 1–5 grid interviewers fill
   3. Average → fit score on cards
   4. Same attributes across candidates → comparable Reports

#### Tab 4 — Apply form

**Left: drag-reorder field builder.** Each field row:
- Drag handle
- Field name (e.g., "Full name", "Email", "CV / Resume upload")
- Required / Optional / Screening tag (different colors)

Standard fields (always present, can mark required):
- Full name (required by default)
- Email (required)
- CV upload (required)
- LinkedIn URL (optional)
- Phone (optional)
- Cover letter (optional)

**Screening questions** auto-injected from Scorecard & questions tab — shown with `Screening` tag, indented or highlighted. Recruiter can reorder them within the screening section but not delete (delete from Scorecard tab instead).

**Right rail: LIVE PREVIEW** of the public `/apply/[token]` page. Updates in real-time as the recruiter edits the builder.

#### Tab 5 — Settings

Grid layout, two columns + full-width bottom card.

**Top-left card — Role details:**
- Title
- Department / Location
- Type / End date

**Top-right card — Status & visibility:**
- Status pills: Open / On hold / Closed (radio-style)
- "Visible on public careers page" toggle

**Top-right card #2 — Pipeline stages (custom stages UI per Q3):**
- Chips for each stage with color per `type`
- Drag-reorder
- `[+ Add stage]` chip — opens modal with Name field + Type picker (Standard / Interview / Offer / Review)
- "10 / 10 used" counter when at cap
- "Customize per role — extra rounds, assessment, etc." helper text

**Bottom (full-width) — Danger zone:**
- "Closing stops new applications. Deleting removes the role and its candidates — this can't be undone."
- `[Close vacancy]` outline-red button
- `[Delete vacancy]` solid-red button

### What gets dropped from current

- **Candidates tab** — gone. List moves to `/vacancies/[id]/pipeline` (Q9 locked).
- **Interview questions tab + `vacancies.interview_questions` JSONB column** — retired. No replacement.
- **`/vacancies/[id]/edit` separate page** — folds into Settings tab. Route can stay as a redirect or be deleted.
- **`interview_questions` column data** — greenfield clean-up per Q14, no migration.

---

## 3. Gaps, missing screens, edge cases

### 3.1 Missing screens

| Surface | Why missing | Recommended action |
|---|---|---|
| Empty Scorecard & questions tab (new vacancy, no attributes yet) | Not drawn | "No attributes yet" + bigger "Suggest from JD" CTA + "Add attribute" |
| Empty Candidates peek (vacancy with 0 active candidates) | Not drawn | "No candidates yet" + "Share apply link" + "Add candidate" buttons inline |
| Pipeline stages at the 10-cap | Counter shown but no over-limit state | At 10/10, Add stage chip disables with tooltip "Maximum 10 stages per vacancy" |
| Stage type picker modal | Mentioned but not drawn | Name input + 4 radio cards with icons + brief type description (Standard = "move forward/back, notes" / Interview = "schedule + Join + scorecard" / etc.) |
| Conflict on delete stage when applications are in it | Not drawn | Modal: "5 candidates are in 'Technical Interview' — move them to [stage picker] first." |
| Closed vacancy state | Not drawn | All tabs read-only with banner "This role is closed. [Reopen]" |
| "Health" calculation | "Good/amber/bad" shown but no rule | Define: Good = average movement < 5 days per stage; Amber = > 5 days but < stale threshold; Red = stale (matches Q-S01-c definition) |
| Time-to-fill benchmark source | Mentioned but no data source | Use org-internal historical average; if < 3 hires total → hide the benchmark line |
| Mobile (vacancy detail on phone) | Out of scope per redesign's own framing | Show "Open on desktop for full editing" banner; render header + Overview tab read-only |

### 3.2 Edge cases

| Case | Today | New |
|---|---|---|
| Vacancy with 0 applications | Tabs render empty | Overview "Needs attention" card hides; Candidates peek hides; "Share apply link" CTA prominent |
| Vacancy in Draft status | Tabs render | Banner: "This vacancy is a draft and not yet published. [Publish]" |
| Vacancy with > 10 stages (after Q3 lock) | N/A | Cannot happen — schema enforces cap |
| Recruiter without admin role | All tabs editable | Settings tab + Danger zone hidden; Edit buttons on JD + Scorecard hidden; Overview + Apply form preview still visible read-only |
| Deleted-but-not-archived vacancy | `notFound()` per current implementation | Same |
| Pipeline stages reordered while applications exist | N/A (global stages) | Applications keep their `pipeline_stage_id`; only the visual order on the board changes |
| Pipeline stage renamed | N/A | Allowed any time. Cards re-render with new name. Audit log entry. |
| Pipeline stage type changed | N/A | Allowed but **warning modal** — "Changing 'HR Interview' from Interview to Standard will hide the scorecard from candidates currently in this stage. Continue?" |

### 3.3 Race conditions

- Two admins editing the JD simultaneously: last-write-wins (acceptable — JD edits are rare).
- Two admins reordering stages simultaneously: optimistic UI + server returns the canonical order on success; second client reconciles silently.

---

## 4. Reuse opportunities

| Need | Reuse from | Notes |
|---|---|---|
| Tab strip | Existing Radix Tabs in `vacancies/[id]/page.tsx:447` | Direct lift; add 1 tab (4 → 5), rename 3 |
| JD edit + AI improve | `AiJdSuggest` + existing edit form on `/vacancies/[id]/edit` | JD tab embeds these; AI gets calm-blue styling per S10 |
| Scorecard attribute list | `VacancyQuestions` component | Restructured for must-have flag + 1–5 scale |
| AI Suggest from JD | `AiAssessmentSuggester` | Lift unchanged, restyle to S10 |
| Field builder for Apply form | Substantial new — but reuse field-row component pattern from Custom Fields manager | `components/custom-fields/custom-fields-manager.tsx` has drag-handle + type-tag pattern |
| Live preview of apply page | Render `app/apply/[token]/page.tsx` content with a sample candidate, in an iframe or inline | iframe is safest — actual production renderer |
| Header `⋯` menu | DropdownMenu from `@/components/ui/dropdown-menu` (used elsewhere) | Standard pattern |
| Pipeline stage chips | Custom new — but follow chip styling from filter-tab pattern in vacancies list | `components/vacancies/vacancies-toolbar.tsx` |
| Add stage modal | AlertDialog pattern | Used elsewhere for AlertDialog confirmations (per BL-013, F-012) |
| Stage type picker | New radio-card UI | New small component; reused in vacancy create flow (S4d) |
| Status & visibility on Settings tab | `VacancyStatusSelect` | Direct lift |
| Danger zone | `DeleteVacancyButton` + new Close button | Existing Delete; Close is a status change wrapped in AlertDialog |
| Prev/Next role | New — query the org's vacancies ordered by recent activity, find current, link to neighbors | New server util at `lib/actions/vacancies.ts` |
| Time-to-fill benchmark | Reuse `lib/reports/time-to-hire.ts` (G-029) | Filter to this vacancy's department or role-type |
| Health calculation | New — but `last_status_changed_at` already exists on applications | Server-side computation |
| Needs attention card sources | Reuse: `offers` query (offers awaiting reply > 0), `interviews` query (today/tomorrow), `applications` query (applied < N hours ago) | All exist in some form |

---

## 5. DB / API changes

### 5.1 Schema

**New table:** `pipeline_stages` per [`roadmap.md` 2.6](../roadmap.md#26-✏️-revise-·-custom-stages-per-vacancy).

**Modified table:** `vacancy_questions`:
```sql
ALTER TABLE public.vacancy_questions
  ADD COLUMN must_have BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'attribute' CHECK (kind IN ('attribute', 'screening_question'));
-- Rename `type` (text/score) → maybe collapse into kind, or keep both
-- Since this is greenfield: drop the old `type` column entirely, switch to:
--   kind = 'attribute' → scorecard attribute (1-5 + must_have)
--   kind = 'screening_question' → screening Q on apply form
ALTER TABLE public.vacancy_questions
  ADD COLUMN screening_answer_type TEXT CHECK (
    screening_answer_type IN ('yes_no_knockout', 'number', 'short_text', 'select')
  );
-- Score scale change: candidate_evaluation_answers.score_value 1-10 → 1-5
ALTER TABLE public.candidate_evaluation_answers
  ADD CONSTRAINT score_value_range_v2 CHECK (score_value IS NULL OR (score_value >= 1 AND score_value <= 5));
-- Drop old constraint after data clean
```

**Modified table:** `candidate_evaluations`:
```sql
ALTER TABLE public.candidate_evaluations
  ADD COLUMN recommendation TEXT CHECK (recommendation IN ('strong_yes', 'yes', 'lean_no', 'no')),
  ADD COLUMN reason TEXT;
-- Anti-anchoring: submitted_at column to gate visibility of others' scorecards
ALTER TABLE public.candidate_evaluations
  ADD COLUMN submitted_at TIMESTAMPTZ;
```

**Dropped:** `vacancies.interview_questions` JSONB column (replace Migration 032 with a drop migration).

**Migration of legacy stages → per-vacancy:**
For each existing vacancy, INSERT 7 `pipeline_stages` rows (the default template). Then UPDATE all `applications` rows to point at the new vacancy-scoped stage IDs. Per Q14, data is being cleaned anyway — this migration only matters for in-flight test data.

### 5.2 Server actions

**New:**
- `lib/actions/pipeline-stages.ts`:
  - `listStages(vacancyId)`
  - `createStage(vacancyId, name, type)`
  - `updateStage(stageId, { name?, type?, sort_order? })`
  - `deleteStage(stageId, { reassignToStageId? })` — fails if applications are in it without a reassignment target
  - `reorderStages(vacancyId, orderedIds: string[])` — single transactional reorder
- `lib/actions/vacancies.ts` additions:
  - `getVacancyOverviewSignals(vacancyId)` — returns `{ offersAwaiting, interviewsToday, newApplicants, staleCandidates, health, timeToFillBenchmark }`
  - `getAdjacentVacancies(vacancyId)` — returns prev/next IDs
  - `closeVacancy(vacancyId)` — single-purpose action used by Settings/Danger zone
- `lib/ai/apply-form-suggest.ts` (if AI suggests field additions — out of scope v1)

**Modified:**
- `lib/actions/vacancy-questions.ts` (rename from `vacancy-questions` if needed) — handles new `kind` enum + `must_have` + `screening_answer_type`
- `lib/actions/candidate-evaluations.ts` — submit accepts `recommendation` + `reason`; server filters answers from other reviewers unless current user has `submitted_at IS NOT NULL`

### 5.3 Routes

| Route | Status | Action |
|---|---|---|
| `/vacancies/[id]` | KEEP | The 5-tab Vacancy detail. URL param `?tab=` for tab selection (Overview / job-description / scorecard / apply-form / settings). |
| `/vacancies/[id]/edit` | REMOVE | Functionality moves to Settings tab. Route can stay as a redirect to `/vacancies/[id]?tab=settings` for one release, then deleted. |
| `/vacancies/[id]/pipeline` | KEEP | The deep-link route to the Pipeline workspace, scoped to one vacancy. See [S01 §5.4](S01-pipeline.md#54-routes). |
| `/vacancies/[id]/pipeline/review` | NEW | Per-vacancy Review mode entry (per Q-S01-b locked: also per-vacancy). |

---

## 6. Effort estimate

### 6.1 Phase 0 prerequisites

- 0.1 fix trigger bug (independent)
- 0.5 pipeline_stages schema design (`S`, smaller than originally scoped)

### 6.2 Wave 2.4 — Vacancy detail rebuild

| Task | Effort | Reuse |
|---|---|---|
| 5-tab structure scaffolding | `S` | Existing Radix Tabs |
| Header redesign (Copy apply link / View pipeline / ⋯ menu / breadcrumb / prev-next) | `S` | Existing buttons + new `getAdjacentVacancies` |
| Overview tab — "Needs your attention" card | `M` | New aggregate query |
| Overview tab — compact funnel strip | `S` | Pipeline stages data + counts |
| Overview tab — candidates peek (top 5) | `S` | Applications query w/ limit |
| Overview tab — At a glance + Health calc | `S` | `last_status_changed_at` + simple thresholds |
| Overview tab — time-to-fill benchmark | `S` | Lift from G-029 reports |
| Overview tab — Hiring team card | `S` | Profiles query |
| Overview tab — Share card | `S` | Existing apply token |
| JD tab — inline edit + AI improve | `S` | Reuse `AiJdSuggest`; restyle |
| JD tab — preview link | `S` | Open public page in new tab |
| Settings tab — Role details | `S` | Lift from current edit page |
| Settings tab — Status & visibility | `S` | Reuse `VacancyStatusSelect` |
| Settings tab — Danger zone | `S` | Reuse delete button; add close button |
| Move applications list to Pipeline route | `S` | Done as part of S01 |
| Retire `/vacancies/[id]/edit` (redirect) | `S` | One-line redirect |

**Wave 2.4 total: ~M-L** (3–4 weeks elapsed).

### 6.3 Wave 2.5 — Scorecard & questions tab

| Task | Effort | Reuse |
|---|---|---|
| Schema rebuild (greenfield) | `S` | No migration |
| Server actions for scorecard CRUD (with must-have, 1-5) | `S` | Modify existing `vacancy-questions` actions |
| Scorecard attribute list UI (drag-reorder, must-have toggle) | `M` | Custom-fields manager pattern |
| Screening questions list UI | `S` | Same component pattern |
| AI Suggest from JD button | `S` | Reuse `AiAssessmentSuggester`, restyle |
| "How this drives scoring" explainer | `S` | Static card |
| Anti-anchoring: server-side filter of other reviewers' answers | `S` | Add `.eq('submitted_at', ...)` guard |
| Recommendation + reason fields on submission UI | `S` | Per-evaluation form |
| Public scorecard share — greenfield rebuild | `S` | New `/scorecard/[token]` route shape |

**Wave 2.5 total: ~M** (2–3 weeks elapsed).

### 6.4 Wave 2.6 — Custom stages (per Q3 locked)

| Task | Effort | Reuse |
|---|---|---|
| `pipeline_stages` schema + RLS | `S` | New table |
| Server actions (list/create/update/delete/reorder) | `M` | New |
| Pipeline stages chip UI on Settings tab | `S` | Filter-tab chip pattern |
| Add stage modal (name + type picker) | `S` | AlertDialog + radio cards |
| Drag-reorder with optimistic UI | `S` | `@dnd-kit` (already in use) |
| Delete-with-reassignment dialog | `S` | New small modal |
| Default template seeder for new vacancies | `S` | Server-side on vacancy create |
| Update all 20+ `applications.status_id` callers to use `pipeline_stage_id` | `M` | Greenfield helps — no compat layer |

**Wave 2.6 total: ~M** (2 weeks; previously XL before Q3 constraints + Q14 greenfield).

### 6.5 Wave (TBD) — Apply form field builder

| Task | Effort | Reuse |
|---|---|---|
| Field-row component with drag-handle | `S` | Custom-fields manager pattern |
| Reorder + required toggle | `S` | New |
| Screening questions auto-inject (read-only here, editable on Scorecard tab) | `S` | New |
| Live preview iframe | `S` | iframe `<iframe src={`/apply/${token}?preview=true`} />` |
| Preview safe rendering (no submit) | `S` | URL param disables form submit |

**Apply form builder total: ~M** (could be folded into 2.4 or sequenced after).

---

## 7. Open questions

Most are answered by locked decisions. Two new ones surface from writing this doc.

### 7.1 RESOLVED via locked decisions

| Question | Status |
|---|---|
| 5-tab structure | ✅ Locked. Overview / Job description / Scorecard & questions / Apply form / Settings |
| Where does the applications list live? | ✅ Locked Q9 → at `/vacancies/[id]/pipeline` |
| Scorecard scale | ✅ Locked Q14 → 1–5 (greenfield) |
| Custom stages | ✅ Locked Q3 → per-vacancy, cap-10, enum types |
| Migration | ✅ Locked Q14 → none |
| Wizard creation | ✅ Locked Q13 → stepped wizard (see S4d flow doc, future) |

### 7.2 NEW — surfaced by this analysis

- **Q-S04-a:** When a recruiter changes a stage's `type` mid-flight (e.g. "HR Interview" from `interview` → `standard`), what happens to existing applications in that stage? Their stage-contextual block on the candidate profile (per S2) would suddenly stop showing the interview toolkit. *Recommendation:* show a confirmation modal warning the implication; the change is allowed but UI surfaces a heads-up. Don't auto-migrate the applications.
- **Q-S04-b:** Should the **header `[Copy apply link]` button** copy to clipboard silently, or copy + show a sonner toast confirmation? *Lean: toast confirmation* — the no-feedback state is confusing for first-time use. ("Apply link copied to clipboard.")
- **Q-S04-c:** **Hiring team card on Overview** — who can add teammates? Today there's no per-vacancy "hiring team" — every org member with `view` access sees every vacancy. The redesign implies a per-vacancy assignment. *Recommendation:* defer per-vacancy hiring-team feature; show all org members under "Hiring team" with the manager flagged, hide the "Add teammate" CTA, treat as a v2.
- **Q-S04-d:** **Time-to-fill benchmark** — comparing against what corpus? Same role type across the org? Industry average? *Recommendation:* org-internal hires of vacancies with the same `department` value (light heuristic). If < 3 hires available, hide the benchmark line entirely. Industry data is out of scope v1.
- **Q-S04-e:** **Health indicator** — what defines green/amber/red? *Recommendation:* hardcode initial rules. Green = at least one application moved a stage in last 5 days. Amber = no movement in 5–10 days. Red = no movement in > 10 days OR all applications terminal. Promote to per-org setting only if customers ask.

---

## 8. Test plan

### 8.1 Functional

- [ ] Vacancy detail renders for an org with vacancies + apps
- [ ] All 5 tabs render and persist via `?tab=` URL param
- [ ] Header `[Copy apply link]` copies to clipboard and shows toast
- [ ] Header `[View pipeline →]` navigates to `/vacancies/[id]/pipeline`
- [ ] Header `[⋯]` menu shows Duplicate / LinkedIn post / Add candidate / Archive / Export CSV
- [ ] Breadcrumb prev/next navigates to adjacent vacancies (by recent activity)
- [ ] Overview "Needs attention" card hides when N=0
- [ ] Overview funnel strip click → opens Pipeline filtered to that stage
- [ ] Overview Candidates peek shows top 5 by fit score
- [ ] Overview Health indicator renders correct color per rules
- [ ] Overview time-to-fill benchmark renders or hides per `< 3 hires` rule
- [ ] JD tab inline edit + AI improve work without route change
- [ ] JD tab preview opens public apply page
- [ ] Scorecard tab attribute list renders, must-have toggle works
- [ ] Scorecard tab AI Suggest from JD adds attributes draft
- [ ] Scorecard tab drag-reorder persists
- [ ] Screening questions tab shows separately
- [ ] Apply form tab drag-reorder field works
- [ ] Apply form tab live preview iframe renders public page
- [ ] Settings tab — Role details edit + save
- [ ] Settings tab — Status & visibility radio + public toggle
- [ ] Settings tab — Pipeline stages chips + add (with type picker) + reorder + delete
- [ ] At 10 stages, Add stage chip disables
- [ ] Delete stage with apps in it shows reassignment modal
- [ ] Type change shows warning modal
- [ ] Settings tab — Danger zone Close + Delete buttons work
- [ ] `/vacancies/[id]/edit` redirects to `?tab=settings`

### 8.2 Non-functional

- [ ] Overview tab loads < 800ms on warm cache
- [ ] Scorecard suggest from JD < 5s (AI call latency)
- [ ] Apply form preview iframe doesn't allow form submission (read-only)
- [ ] Mobile detail shows "Open on desktop" banner with read-only Overview
- [ ] All 5 tabs accessible via keyboard tab navigation
- [ ] All form actions have audit log entries

### 8.3 Regression

- [ ] Existing apply links (`vacancies.application_form_token`) still work
- [ ] Existing LinkedIn cross-post integration unchanged
- [ ] Existing public `/jobs/[slug]` listing unchanged
- [ ] Candidate profile per-application stage chips still reflect new `pipeline_stages` (Wave 2.6 ripple)
- [ ] G-024 bulk move on Pipeline still works (since Candidates tab is removed, this surface moves)

---

## 9. Verification

Aligned with [`docs/claude-code-workflow.md`](../../claude-code-workflow.md) Phase 5:

- [ ] All sub-tasks in §6 complete
- [ ] Tests in §8 pass
- [ ] Docs updated:
  - [ ] `docs/3-architecture/frontend.md` — new 5-tab structure
  - [ ] `docs/3-architecture/backend.md` — pipeline_stages CRUD, vacancy overview signals
  - [ ] `docs/3-architecture/database.md` — new pipeline_stages table, modified vacancy_questions, modified candidate_evaluations
  - [ ] `docs/7-api/endpoints.md` — new server actions
  - [ ] `docs/8-decisions.md` — record Q-S04-a/b/c/d/e decisions
  - [ ] `docs/ui-texts.md` — new strings
- [ ] Ripple check — `KanbanBoard` callers updated to use `pipeline_stages` not `application_statuses`
- [ ] Ripple check — public scorecard `/scorecard/[token]` rendering updated for new schema

---

## 10. What to do after reading

1. **Confirm the new Q-S04-a/b/c/d/e** answers (or override).
2. **Decide on Wave 2.4 / 2.5 / 2.6 sequencing** — three waves that all touch this page. Suggested order: 2.4 scaffolding first → 2.6 pipeline_stages (unblocks Settings tab Pipeline stages section + Pipeline route per S01) → 2.5 scorecard (Scorecard tab + per-interview submissions).
3. **Next flow doc:** S4d Creation flows (vacancy creation + candidate creation wizards), or S2 Candidate profile. Either is unblocked.

---

## Appendix — file inventory for this flow

**New files:**

| File | Purpose |
|---|---|
| `app/(dashboard)/vacancies/[id]/page.tsx` | Rewrite for 5-tab structure |
| `components/vacancies/vacancy-overview-tab.tsx` | New |
| `components/vacancies/vacancy-jd-tab.tsx` | New (extracts JD card + AI button) |
| `components/vacancies/vacancy-scorecard-tab.tsx` | New |
| `components/vacancies/vacancy-apply-form-tab.tsx` | Rewrite of `application-form-tab.tsx` as field builder |
| `components/vacancies/vacancy-settings-tab.tsx` | New (extracts role details + status + stages + danger) |
| `components/vacancies/pipeline-stages-manager.tsx` | New (chips + add modal + reorder + delete) |
| `components/vacancies/add-stage-modal.tsx` | New (name + 4-type radio) |
| `components/vacancies/needs-attention-card.tsx` | New |
| `components/vacancies/candidates-peek.tsx` | New |
| `components/vacancies/vacancy-health-indicator.tsx` | New |
| `lib/actions/pipeline-stages.ts` | New |
| `scripts/044_pipeline_stages.sql` | New migration |
| `scripts/045_scorecard_v2_columns.sql` | New migration (must_have / recommendation / reason / submitted_at) |
| `scripts/046_drop_vacancies_interview_questions.sql` | New migration (retire JSONB column) |

**Modified files:**

| File | Change |
|---|---|
| `app/(dashboard)/vacancies/[id]/edit/page.tsx` | Replace with redirect to `?tab=settings` |
| `lib/actions/vacancies.ts` | Add `getVacancyOverviewSignals`, `getAdjacentVacancies`, `closeVacancy` |
| `lib/actions/applications.ts` | Update `updateApplicationStatus` to write `pipeline_stage_id` |
| `components/vacancies/vacancy-questions.tsx` | Add must-have flag UI, 1–5 scale |
| `lib/actions/candidate-evaluations.ts` | Add `recommendation` + `reason` fields, anti-anchoring filter |
| `components/pipeline/kanban-board.tsx` | Update to read per-vacancy stages instead of global statuses (S01 ripple) |

**Retired:**

| File | Reason |
|---|---|
| `components/vacancies/ai-interview-questions.tsx` | Orphaned by 5-tab structure; no home |
| `components/vacancies/vacancy-applications-list.tsx` (rendered here) | Moves to Pipeline route per S01 |
| `components/vacancies/vacancy-applications-toolbar.tsx` | Same |
| `app/(dashboard)/vacancies/[id]/edit/page.tsx` (as-is) | Becomes redirect |

**Docs touched:**
- `docs/3-architecture/frontend.md`
- `docs/3-architecture/backend.md`
- `docs/3-architecture/database.md`
- `docs/7-api/endpoints.md`
- `docs/8-decisions.md`
- `docs/ui-texts.md`

**Tests added:**
- `tests/components/vacancies/vacancy-detail-tabs.test.tsx`
- `tests/components/vacancies/pipeline-stages-manager.test.tsx`
- `tests/components/vacancies/needs-attention-card.test.tsx`
- `tests/lib/actions/pipeline-stages.test.ts`
- `tests/lib/actions/vacancies-overview-signals.test.ts`
- `tests/lib/actions/candidate-evaluations-anti-anchoring.test.ts`
