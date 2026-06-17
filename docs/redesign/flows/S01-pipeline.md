# S1 · Pipeline — flow analysis

> **Status:** Draft 1, authored 2026-06-16. Partially blocked by 4 of the audit's 14 open questions — recommendations given inline so this doc is still actionable.
>
> **Sources:** [`Pipeline Versions.dc.html`](../../../redesign/Pipeline%20Versions.dc.html), [`audit.md` §4.1](../audit.md#41-·-s1-·-pipeline-pipeline-versionsdchtml), [`roadmap.md` Wave 2.1 + 2.2](../roadmap.md#wave-2--core-workflow). Mobile design in [`mobile/today-interviews.md`](../mobile/today-interviews.md).
>
> **Why this is first.** Pipeline is the recruiter's daily-driver surface, the screen most often opened on the first login of the day. Wave 2.1 (Global Pipeline) and Wave 2.2 (Review mode) together are the highest-impact redesign work in clicks-saved-per-week terms.

---

## 1. Current implementation

### Routes today

- **Per-vacancy board:** [`app/(dashboard)/vacancies/[id]/pipeline/page.tsx`](../../../app/(dashboard)/vacancies/[id]/pipeline/page.tsx) (168 lines). Reached via the "Pipeline" button on vacancy detail header ([`vacancy detail page line 426`](../../../app/(dashboard)/vacancies/[id]/page.tsx#L426)).
- **List view of the same applications:** the `Candidates` tab on vacancy detail ([`vacancy detail page lines 482–550`](../../../app/(dashboard)/vacancies/[id]/page.tsx#L482-L550)) — table layout with multi-select, bulk-move, bulk-reject. The list view is **more capable** than the board today.
- **No global cross-vacancy pipeline exists.** The closest cross-vacancy surface is the all-candidates list at [`app/(dashboard)/candidates/page.tsx`](../../../app/(dashboard)/candidates/page.tsx).

### Components

| Component | Path | Lines | What it does |
|---|---|---|---|
| `KanbanBoard` | [`components/pipeline/kanban-board.tsx`](../../../components/pipeline/kanban-board.tsx) | 199 | DnD context + state. Optimistic move, revert on failure, terminal-stage intercept (rejection dialog). |
| `KanbanColumn` | [`components/pipeline/kanban-column.tsx`](../../../components/pipeline/kanban-column.tsx) | 82 | Single column, droppable, status badge with `APPLICATION_STATUS_COLORS`, "Drop here" empty state. |
| `CandidateCard` | [`components/pipeline/candidate-card.tsx`](../../../components/pipeline/candidate-card.tsx) | 102 | Draggable card with name, position, age-in-stage. |
| `RejectionDialog` | [`components/pipeline/rejection-dialog.tsx`](../../../components/pipeline/rejection-dialog.tsx) | — | Reason picker + optional templated email + confirm. Intercepts drops onto the `rejected` column. |
| `VacancyApplicationsList` | [`components/vacancies/vacancy-applications-list.tsx`](../../../components/vacancies/vacancy-applications-list.tsx) | 267 | List equivalent on vacancy → Candidates tab. **Has multi-select with `selected: Set<string>`, BulkMoveDialog, BatchRejectionDialog.** |
| `BulkMoveDialog` | [`components/vacancies/bulk-move-dialog.tsx`](../../../components/vacancies/bulk-move-dialog.tsx) | — | Confirm-then-move for batch stage change. |
| `BatchRejectionDialog` | [`components/vacancies/batch-rejection-dialog.tsx`](../../../components/vacancies/batch-rejection-dialog.tsx) | — | Reason picker + per-candidate email toggle + batch send. |

### Server actions

- [`updateApplicationStatus(id, statusId)`](../../../lib/actions/applications.ts) — single-row move. Audit-logs the transition. Used by drag-drop and inline status picker.
- [`rejectApplication({applicationId, statusId, rejectionReasonId, templateId, sendEmail})`](../../../lib/actions/applications.ts) — single-row reject with templated email.
- [`rejectApplicationsBatch({applicationIds, statusId, rejectionReasonId, templateId, sendEmail})`](../../../lib/actions/applications.ts#L735) — serial loop over `rejectApplication`, returns `{succeeded, failed, failures}`. Defensive cap suggested at 50 rows (comment at line 795).
- **No `bulkMoveApplications` action exists yet** — `BulkMoveDialog` likely loops `updateApplicationStatus` client-side. ✋ Confirm during build.

### Data model

| Table | Relevant columns | Notes |
|---|---|---|
| `application_statuses` | `id, name, code, is_active, sort_order` | 7 fixed codes globally (applied, screening, interview, offer, hired, rejected, withdrawn). **No `type` column.** Seed at [`scripts/001_create_schema.sql`](../../../scripts/001_create_schema.sql). |
| `applications` | `id, candidate_id, vacancy_id, status_id, applied_at, last_status_changed_at, organization_id, deleted_at` | One row per (candidate, vacancy) pair. |
| `candidates` | `id, first_name, last_name, current_position, current_company, general_status_id` | `general_status_id` is the derived/cache field — Wave 1.1 removes the editable UI but the column stays. |
| `candidate_statuses` | `id, name, code, sort_order` | Active / Hired / Archived (simplified by [Migration 009](../../../scripts/009_simplify_candidate_statuses.sql)). |
| Sync trigger | `sync_candidate_status_on_application_change` | [Migration 022](../../../scripts/022_candidate_status_sync_trigger.sql) — **silently broken** (looks for `'inactive'` code). Phase 0.1 must fix this. |

### Current behavior — what works today

- Drag-drop within and between columns works on desktop (PointerSensor, 5px activation distance).
- Optimistic UI; if `updateApplicationStatus` fails, the board reverts and a sonner error toast fires.
- Dropping onto `rejected` opens the rejection dialog instead of moving directly — the only column with the intercept pattern.
- Empty state on the board: per-column "Drop here" + page-level "No candidates yet" CTA when the vacancy has no applications.
- Stage colors driven by `APPLICATION_STATUS_COLORS` (same palette as everywhere else in the app).

### Current behavior — what doesn't exist

| Missing | Detail |
|---|---|
| Global / "All roles" view | Only per-vacancy. The board is locked to one vacancy at a time. |
| List view in the pipeline route | Per-vacancy pipeline route has board only; list lives on a different tab. |
| Role filter chips | No surface for "All roles / Engineering / Sales / …" filtering — the route IS the role. |
| Multi-select on the board | No checkbox state; you can only multi-select on the list-mode `VacancyApplicationsList`. |
| Sticky bulk-action bar | Exists on Candidates tab (`VacancyApplicationsList`) but not on the board. |
| Review mode | Doesn't exist. |
| Terminal-stage collapse | All 7 stages render as full columns; horizontal scroll on narrow viewports. |
| Stale-card aging signal | `last_status_changed_at` is stored but no UI surfaces aging. |
| Density toggle | One density. |
| Saved views | G-026's saved views are on lists, not on the board. |

---

## 2. Proposed redesign

### Per the redesign

`Pipeline Versions.dc.html` proposes three visual treatments (A Calm / B Color-coded / C Compact) of the **same workspace**. The shared mechanics are:
- Pipeline as a top-level nav destination (`/pipeline`).
- Board / List toggle in the workspace header.
- Role filter chips (`All roles` default + per-vacancy chip per active role).
- "Review new · N" entry chip that opens Review mode.
- Multi-select checkboxes on cards → sticky bulk action bar at the bottom of the viewport with Move stage / Schedule / Email / Reject.
- Terminal stages (Rejected / Withdrawn) collapse to a side rail so the 5–7 visible stages don't force horizontal scroll.
- Stale-card amber left-spine when no movement > N days.

The redesign explicitly **recommends Version B** (color-coded) as the default and **density as a toggle** rather than three competing designs — Comfortable maps to B cards, Compact maps to C cards (which add a fit-score pill).

### Review mode (from the spec)

A full-screen, keyboard-driven triage UI:
- One new applicant at a time.
- CV + summary + key facts visible.
- Keyboard bindings: `R` reject / `K` skip / `S` schedule interview / `↵` advance to next stage.
- Entered via "Review new" chip on the Pipeline header.
- Highest clicks-saved feature in the audit.

### What's left undefined in the spec

| Issue | Recommendation (this doc) |
|---|---|
| "Role chips" overflow at 50+ vacancies | Render top-12 by active app count; "More…" pill opens a popover picker. Document this; don't leave for implementer. |
| "Stale > N days" — N value | Hardcode `5` days at v1; promote to per-org setting only if customers ask. |
| `K skip` meaning | Skipped applicants stay in their current stage; Review mode keeps a session-scoped "already seen" set so you don't see the same person twice in one session. **Not a queue / snooze.** |
| Bulk reject in the bar | Opens existing `BatchRejectionDialog` — same component as Candidates tab. No new design needed. |
| Drag-drop on touchscreens | Disable DnD below 768px viewport. Use the move-stage menu (in card `⋯`) instead. See [`mobile/today-interviews.md`](../mobile/today-interviews.md). |
| Real-time multi-user drag | Out of scope for v1. Last-write-wins; rely on optimistic-revert if a stale write conflicts. Document the limitation. |
| Vacancy-scoped board placement | **See open question Q2 below — my recommendation is to keep `/vacancies/[id]/pipeline` as a deep-link route.** |

---

## 3. Gaps, missing screens, edge cases

### 3.1 Missing screens

| Surface | Why missing | Recommended action |
|---|---|---|
| Review mode | Not in any `.dc.html` file | Draw before build; one screen file with: idle / loading-next / CV-visible / scorecard-quick-add / confirm-reject / end-of-queue states |
| Pipeline empty state (org has no vacancies) | Not covered | "Create your first vacancy" CTA, same copy as current dashboard fallback |
| Pipeline empty state (org has vacancies but no applications) | Not covered | "No candidates yet — share your apply link" CTA + copy-link button per vacancy |
| Bulk action bar in Compact density | Compact cards are smaller; bar UI not redrawn | Same bar; size unchanged. |
| Side rail for terminal stages | Mentioned but not pixel-clear | Sketch: vertical strip right of the last visible column; collapsed cards show only count + initials; click-to-expand |
| "Schedule" action from bulk bar | Listed but interaction not designed | Single candidate → existing scheduling form. Multi-candidate → either pick interviewer + same time slot for all (panel interview) OR show "Schedule N interviews individually" link that opens each in sequence |

### 3.2 Edge cases

| Case | Current behavior | Redesign behavior |
|---|---|---|
| Candidate has applications to 2 vacancies — appears once or twice on All-roles board? | N/A (no global board) | **Twice** — once per application, since the board is application-keyed, not candidate-keyed. UI should show role context on each card. |
| 1000+ active applications across all roles | N/A | Virtualization required (see [`audit.md` §2.10](../audit.md#210-🟡-all-roles-global-pipeline-at-scale-is-a-performance-trap)). Recommend `@tanstack/react-virtual` per column. |
| Vacancy archived / on-hold mid-session | Per-vacancy: route 404s | Global: hide applications for archived vacancies, show on-hold with amber chip |
| Stage moved to terminal while user has it open | Drag-drop revert | Bulk bar selection includes a candidate that's been bulk-acted by another user — server returns "already in target state", client treats as success |
| Org with > 30 stages (after Wave 2.6 custom-stages lands) | N/A | Horizontal scroll + sticky "Hired" column on the right (anchor at the value-end) |
| Single-vacancy org | Same as today | "All roles" chip should hide; just show the board directly |

### 3.3 Race conditions

Two recruiters drag the same card:
- Both see optimistic move locally.
- Second `updateApplicationStatus` call hits with the source `status_id` no longer matching DB → server should accept (last-write-wins) or reject (no-op if already in target state). Currently the server doesn't compare; it just writes. **Acceptable** for v1 — record as known limitation.

---

## 4. Reuse opportunities (don't rebuild)

The redesign Wave 2.1 effort estimate (`L`) assumes a meaningful rebuild. Most of it is **lift + recompose**:

| Need | Reuse from |
|---|---|
| Drag-drop infrastructure | [`KanbanBoard`](../../../components/pipeline/kanban-board.tsx) — `DndContext`, `PointerSensor`, optimistic state, terminal-stage intercept |
| Column rendering, status badge, droppable target | [`KanbanColumn`](../../../components/pipeline/kanban-column.tsx) — `useDroppable`, `APPLICATION_STATUS_COLORS`, "Drop here" empty state |
| Card structure | [`CandidateCard`](../../../components/pipeline/candidate-card.tsx) — already shows name + position + age. Add: avatar initials, role context (for All-roles view), aging color (amber spine), checkbox (for multi-select), fit-score pill (Compact mode) |
| Multi-select state | [`VacancyApplicationsList`](../../../components/vacancies/vacancy-applications-list.tsx#L67) — `selected: Set<string>`, `toggleAll`, `isSelectableRow` (exclude already-rejected + hired). **Direct lift.** |
| Bulk move dialog | [`BulkMoveDialog`](../../../components/vacancies/bulk-move-dialog.tsx) — lift unchanged |
| Bulk reject dialog | [`BatchRejectionDialog`](../../../components/vacancies/batch-rejection-dialog.tsx) — lift unchanged |
| Bulk reject server action | [`rejectApplicationsBatch`](../../../lib/actions/applications.ts#L735) — 50-row cap, serial loop, no changes needed |
| Single move server action | [`updateApplicationStatus`](../../../lib/actions/applications.ts) — no changes needed |
| Status colors | [`APPLICATION_STATUS_COLORS`](../../../lib/types/application.ts) — the redesign's "Version B colour-coded" is already what this palette does |
| Saved-view persistence (if kept; see Q6) | [`saved_views`](../../../scripts/038_saved_views.sql) table (G-026) + `lib/actions/saved-views.ts` — works for any list-keyed scope; add `'pipeline'` as a list kind |
| List view (Board/List toggle) | `VacancyApplicationsList` becomes the List mode when the toggle is set; promote it from per-vacancy to per-pipeline-context |
| Rejection reason / template data fetching | Already done by parent of `RejectionDialog` and `BatchRejectionDialog` |

**Net new code (no reuse available):**
- Role filter chip strip
- Top-level `/pipeline` route + layout
- "All roles" application query (org-wide, not vacancy-scoped)
- Virtualization wiring per column
- Terminal-stage collapsed rail UI
- Stale-aging spine + computation (`last_status_changed_at` diff)
- Review mode full-screen surface
- Review mode keyboard event handler
- Density toggle (Comfortable / Compact)

---

## 5. DB / API changes needed

### 5.1 Schema

**No schema changes for the Pipeline screen itself in v1**, assuming we ship under the audit's recommended:
- **Q3 → Option B** (per-org pipeline templates instead of per-vacancy free-form custom stages). Defers the `type` column work entirely. ([`roadmap.md` 2.6](../roadmap.md#26-⏸-blocked-✏️-revise-·-custom-typed-stages).)
- **Q6 → keep saved views**; reuse `saved_views` for pipeline scope. Add a `pipeline` list_kind enum value if the table constrains it — confirm during build.

**Schema work that touches Pipeline indirectly:**
- Phase 0.1 — fix Migration 022 trigger (`'inactive'` → correct code). Independent of Pipeline UI but the candidate-status display on cards depends on it being right.
- Wave 2.5 scorecard rebuild — adds `must_have` to `vacancy_questions` + `recommendation` to `candidate_evaluations`. Pipeline cards in **Compact mode** display a fit-score pill which derives from `candidate_evaluations.score`. So Wave 2.5 ships before Compact pill works correctly.

### 5.2 API / server actions

| Action | New / changed |
|---|---|
| `updateApplicationStatus` | **Unchanged.** |
| `rejectApplicationsBatch` | **Unchanged.** |
| `bulkMoveApplications` (does not exist) | **NEW** — server action that takes `applicationIds: string[]` + `targetStatusId: string`, returns `{succeeded, failed, failures}`. Mirrors `rejectApplicationsBatch` shape. Currently `BulkMoveDialog` loops client-side; this is fine at small batches but the batch endpoint is cleaner. ✋ Confirm during build. Effort: `S`. |
| Fetch query for All-roles pipeline | **NEW** — `applications` rows for the org with non-terminal status, joined to `candidates` (light projection) + `vacancies (id, title)` for the role context. Currently `KanbanBoard` is fed per-vacancy from the page; the global page fetches org-wide. |
| Fetch query for saved-view filtering on pipeline | **NEW** if Q6 = keep — applies a saved filter expression (role IDs, source, applied-date range) on top of the global fetch. |

### 5.3 Caching

- All-roles fetch is **per-recruiter-per-org**. Hit count is hot. Use `unstable_cache` (already a pattern in `lib/cache/lookups.ts`) keyed by `[orgId, savedViewId?]`, invalidated on every `updateApplicationStatus` revalidatePath.
- Realistic cache size — at 1000 active apps, the projection is ~80KB JSON. Fine.

### 5.4 Routes

| Route | Status | Action |
|---|---|---|
| `/pipeline` | **NEW** | Top-level destination. Default: All-roles. URL params: `?role=<vacancyId>&view=<savedViewId>&density=<compact\|comfortable>&mode=<board\|list>` |
| `/vacancies/[id]/pipeline` | **DECISION REQUIRED — Q2** | Recommendation: **keep as deep-link**. Same component, scoped to one vacancy via prop. Notifications already link here ([G-016 status page hits this route via referrer; verify](../../../app/(dashboard)/vacancies/%5Bid%5D/pipeline/page.tsx)). |
| `/pipeline/review` | **NEW** | Review mode. Full-screen. URL params: `?queue=new` (default) `?queue=stale` (alternate). |

---

## 6. Effort estimate

Broken down by sub-task. `S` ≤ 1 week, `M` 1–2 weeks, `L` 3–4 weeks.

### 6.1 Phase 0 prerequisites (must land first)

| Task | Effort | Notes |
|---|---|---|
| 0.1 Fix Migration 022 trigger | `S` | Standalone; independent of Pipeline |
| 0.4 Mark `Pipeline Directions.dc.html` as draft | `S` | Already in audit; just rename/move |
| 0.5 Resolve Q3 (stages Option A vs B) | `S` | Decision; this doc recommends Option B → no schema work |

### 6.2 Wave 2.1 — Global Pipeline

| Task | Effort | Reuse |
|---|---|---|
| Top-level `/pipeline` route + layout | `S` | None |
| Org-wide applications fetch + projection | `S` | None |
| Role filter chip strip (top-12 + overflow popover) | `S` | None |
| Multi-select state on `KanbanColumn` cards | `S` | `VacancyApplicationsList` Set<string> state |
| Sticky bulk action bar | `S` | Same UI as `VacancyApplicationsList` toolbar |
| Wire `BulkMoveDialog` and `BatchRejectionDialog` from board | `S` | Direct lift |
| `bulkMoveApplications` server action (if not lifting client-loop) | `S` | Mirror `rejectApplicationsBatch` |
| Terminal-stage collapsed side rail | `S` | None |
| Stale-card amber left-spine | `S` | `last_status_changed_at` already exists |
| Board / List view toggle | `S` | Promote `VacancyApplicationsList` to global scope |
| Virtualization per column | `M` | `@tanstack/react-virtual`; new dep |
| Empty states (no vacancies / no apps) | `S` | New copy |
| Density toggle (Comfortable / Compact) | `S` | CSS variant + fit-score pill in compact card |
| Mobile fallback (DnD off, move-stage menu, single-column) | `S` | See [`mobile/today-interviews.md`](../mobile/today-interviews.md) |
| Keep `/vacancies/[id]/pipeline` as deep-link with same component | `S` | Pass `scopedVacancyId` prop |

**Wave 2.1 total: ~L** (4 weeks elapsed, mostly because virtualization + mobile + bulk integration each need their own PR).

### 6.3 Wave 2.2 — Review mode

| Task | Effort | Reuse |
|---|---|---|
| `/pipeline/review` route + full-screen layout | `S` | None |
| "New applicants" queue query + session-scoped "seen" set | `S` | None |
| Keyboard event handler (`R` `K` `S` `↵` `Esc`) | `S` | None |
| CV / summary / key-facts panel | `S` | `AiSummaryPanel`, key-facts from `candidates` + first `applications` row |
| Reject flow (uses existing `RejectionDialog`) | `S` | Direct |
| Schedule flow (open scheduling sheet, prefill candidate) | `S` | Existing `/interviews/new` form |
| Advance flow (move to next stage by sort_order) | `S` | `updateApplicationStatus` |
| End-of-queue state | `S` | New copy / illustration |
| Entry chip on Pipeline header ("Review new · N") | `S` | Already drawn |

**Wave 2.2 total: ~M** (2 weeks elapsed).

### 6.4 Polish & cleanup

| Task | Effort | Notes |
|---|---|---|
| Move-stage from card `⋯` menu (mobile + a11y) | `S` | Needed for touch + keyboard |
| Save the redesign's exploratory Pipeline Directions file to `redesign/_drafts/` | `S` | Audit clean-up |
| Coordinated update to nav (`Pipeline` becomes top-level) | `S` | Affects sidebar component |

---

## 7. Open questions — RESOLVED 2026-06-16

All four blocking questions + five S1 sub-questions are answered. Implementation-ready.

### 7.1 Q2 ✅ — Vacancy-scoped board location

**Locked: keep both URLs.** `/pipeline` is the global top-level destination; `/vacancies/[id]/pipeline` is a deep-link route that renders the same component pre-filtered to one vacancy. Notification deep-links keep working. The route stays.

### 7.2 Q3 ✅ — Custom stages

**Locked: per-vacancy custom stages.** Constraints:
- **Cap-10** — max 10 stages per vacancy (UI enforces, schema enforces via a check trigger or app-level check).
- **Type enum** — `standard | interview | offer | review`. No free-text types. Behavior keys off `type`.
- **Greenfield** — no migration of existing application `status_id` references. Schema spec is in [`roadmap.md` 2.6](../roadmap.md#26-✏️-revise-·-custom-stages-per-vacancy).

**Default for new vacancies:** the legacy 7-stage seed (Applied / Screening / Interview / Offer / Hired / Rejected / Withdrawn) becomes the default template — 7 of the 10 slots used.

### 7.3 Q6 ✅ — Saved views: keep

**Locked: keep.** Extend `saved_views` table with `'pipeline'` list_kind. No migration since data is being cleaned anyway. Existing G-026 surfaces (candidates list, vacancies list) unchanged.

### 7.4 Q14 ✅ — Mobile pipeline

**Locked: combine both.** On phone, the global board renders as a single-column stage-switcher (swipe between stages, one stage at a time). AND Review mode is the canonical mobile pipeline pattern — surfaced prominently when phone viewport is detected. See [`mobile/today-interviews.md`](../mobile/today-interviews.md).

### 7.5 Sub-questions — RESOLVED

- **Q-S01-a** — Confirm at build time. `BulkMoveDialog` currently loops `updateApplicationStatus` client-side per [`components/vacancies/bulk-move-dialog.tsx`](../../../components/vacancies/bulk-move-dialog.tsx). Ship `bulkMoveApplications` server action as part of 2.1; not strictly blocking but cleaner.
- **Q-S01-b ✅** — Review mode appears at **both** `/pipeline/review` (global) AND `/vacancies/[id]/pipeline/review` (scoped). Same component, scoped via prop.
- **Q-S01-c ✅** — Stale = **hardcoded 5 days**. Not a per-org setting.
- **Q-S01-d ✅** — Bulk Schedule button is **hidden** when N > 1 candidates selected. Bulk bar shows Move stage / Email / Reject only.
- **Q-S01-e ✅** — `/pipeline` with 0 vacancies shows a **welcome card** (not a redirect): "Welcome to HRHandle 🌟" + primary CTA "Create your first vacancy" + secondary "Import candidates" + 3-step orientation strip. Faint ghost board behind with white fade. Spec is in `redesign/Pipeline Empty State.dc.html` (saved 2026-06-16).

---

## 8. Test plan

For when implementation kicks off — verification checklist.

### 8.1 Functional

- [ ] `/pipeline` renders for org with vacancies + apps
- [ ] `/pipeline` empty state renders for org with 0 vacancies (CTA to `/vacancies/new`)
- [ ] `/pipeline` empty state renders for org with vacancies but 0 apps (CTA to copy apply link)
- [ ] Role filter chips show top-12; >12 opens "More…" popover
- [ ] All-roles default; clicking role chip filters
- [ ] Drag-drop between columns updates status, persists via `updateApplicationStatus`
- [ ] Drag-drop onto `rejected` opens `RejectionDialog` (no auto-move)
- [ ] Multi-select via card checkbox; "select all" in column header
- [ ] Bulk move via sticky bar opens `BulkMoveDialog`; success refreshes
- [ ] Bulk reject via sticky bar opens `BatchRejectionDialog`; success refreshes
- [ ] Already-rejected + already-hired cards are unselectable for bulk
- [ ] Stale-aging amber spine appears on cards with `last_status_changed_at` > N days
- [ ] Terminal stages (Rejected / Withdrawn) collapse to side rail
- [ ] Board / List toggle persists in URL (`?mode=`)
- [ ] List mode renders `VacancyApplicationsList` adapted to all-roles scope
- [ ] Density toggle persists in URL (`?density=`); Compact shows fit-score pill
- [ ] `/pipeline/review` opens; first applicant visible
- [ ] Keyboard: `R` opens reject, `K` skips, `S` opens schedule, `↵` advances
- [ ] Review session-scoped "seen" set prevents re-showing same applicant
- [ ] End-of-queue state renders when all new applicants processed
- [ ] `/vacancies/[id]/pipeline` deep-link still works (same component, scoped)

### 8.2 Non-functional

- [ ] At 1000 active applications, all-roles board renders < 1s and stays smooth on scroll (virtualization)
- [ ] Bulk move of 50 applications completes < 10s (within Vercel timeout)
- [ ] Mobile: DnD disabled, move-stage via card `⋯` menu works
- [ ] Mobile: `/pipeline/review` is the canonical mobile entry
- [ ] All-roles fetch is cached per-recruiter; invalidates on every status change
- [ ] No N+1 queries (verify via Supabase logs)

### 8.3 Regression

- [ ] G-024 bulk move on Vacancy → Candidates tab still works (component unchanged)
- [ ] G-026 saved views still work on Candidates list (orthogonal scope)
- [ ] Existing notification deep-links to `/vacancies/[id]/pipeline` still land correctly

---

## 9. Verification — "is this flow done?"

Aligned with [`docs/claude-code-workflow.md`](../../claude-code-workflow.md) Phase 5:

- [ ] All sub-tasks in §6 complete
- [ ] Tests in §8 pass
- [ ] Docs updated:
  - [ ] `docs/3-architecture/frontend.md` — new top-level route, new components
  - [ ] `docs/3-architecture/backend.md` — `bulkMoveApplications` action if new
  - [ ] `docs/7-api/endpoints.md` — same
  - [ ] `docs/8-decisions.md` — record the Q-S01-a-e decisions
  - [ ] `docs/ui-texts.md` — new strings (Review mode keyboard hints, empty states)
- [ ] Mobile verification per [`mobile/today-interviews.md`](../mobile/today-interviews.md)
- [ ] Ripple check — `KanbanBoard` callers (`/vacancies/[id]/pipeline/page.tsx`) still work after scope change

---

## 10. What to do after reading

1. **Answer Q2, Q3, Q6, Q14** in §7 — even one-line answers unblock the work.
2. **Confirm the recommendations** for Q-S01-a through Q-S01-e in §7.5.
3. **Decide:** ship 2.1 + 2.2 in sequence (longer, lower risk) or in parallel (faster, more PR churn)?
4. **Then I move to S4 Vacancy detail** — next-most-blocked flow per the dependency order in [`roadmap.md`](../roadmap.md).

---

## Appendix — file inventory for this flow

**Code touched (assuming recommended path):**

| File | Change type | Notes |
|---|---|---|
| `app/(dashboard)/pipeline/page.tsx` | NEW | Top-level route |
| `app/(dashboard)/pipeline/review/page.tsx` | NEW | Review mode |
| `app/(dashboard)/vacancies/[id]/pipeline/page.tsx` | MODIFY | Pass `scopedVacancyId` to shared component |
| `app/(dashboard)/layout.tsx` | MODIFY | Add Pipeline to nav |
| `components/pipeline/kanban-board.tsx` | MODIFY | Add multi-select, scoped vs global mode |
| `components/pipeline/kanban-column.tsx` | MODIFY | Virtualization wrapper, terminal-stage collapse |
| `components/pipeline/candidate-card.tsx` | MODIFY | Checkbox, role context (for All-roles), aging spine, fit-score pill (Compact) |
| `components/pipeline/role-filter-chips.tsx` | NEW | Top-12 + overflow popover |
| `components/pipeline/bulk-action-bar.tsx` | NEW | Sticky bar wrapping existing dialogs |
| `components/pipeline/density-toggle.tsx` | NEW | Comfortable / Compact |
| `components/pipeline/review-mode.tsx` | NEW | Full-screen single-applicant view |
| `components/pipeline/review-keyboard.tsx` | NEW | Keybinding handler |
| `lib/actions/applications.ts` | MODIFY | Add `bulkMoveApplications` (if not lifting client-loop) |
| `lib/cache/pipeline.ts` | NEW | `unstable_cache`-backed all-roles query |
| `lib/types/saved-view.ts` | MODIFY | Add `'pipeline'` to `list_kind` if constrained |

**Docs touched:**
- `docs/3-architecture/frontend.md`
- `docs/3-architecture/backend.md`
- `docs/7-api/endpoints.md`
- `docs/8-decisions.md`
- `docs/ui-texts.md`

**Tests added:**
- `tests/components/pipeline/kanban-board.test.tsx` — multi-select, bulk-bar, all-roles
- `tests/components/pipeline/review-mode.test.tsx` — keyboard, seen-set, end-of-queue
- `tests/lib/actions/applications.test.ts` — `bulkMoveApplications` happy + error paths
- `tests/lib/cache/pipeline.test.ts` — invalidation on status change
