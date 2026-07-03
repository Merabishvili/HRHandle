# HRHandle Redesign — Revised Roadmap

> **Status:** Plan locked 2026-06-16. **Progress callout below refreshed 2026-06-20.** Original 14 audit open questions all answered. Authored 2026-06-15.
>
> **Source:** Takes [`redesign/ROADMAP.md`](../../redesign/ROADMAP.md) as input. Applies KEEP / REVISE / DROP / ADD verdicts informed by [`audit.md`](audit.md).
>
> **Scope:** Standalone. Does not interleave with [`docs/1-product/roadmap.md`](../1-product/roadmap.md) Phase 9 (tech debt) / Phase 10 (billing). Coordination notes flag overlaps; you decide later how to sequence the merged execution.
>
> **Reading order:** Progress callout below → rest of this file (the locked plan) → flow-by-flow docs in [`flows/`](flows/) → [`ai-fit-analysis.md`](ai-fit-analysis.md) for the S11 spec.

---

## Progress to date — 2026-06-20

The rest of this document is the **planned** sequence locked 2026-06-16. This callout summarises what's actually shipped on `staging` since then, so the locked plan can be read with current state in mind.

### ✅ Shipped (verified on `staging` branch)

| Wave | What | Commit | Notes |
|---|---|---|---|
| 2.1 + 2.2 | Cross-vacancy kanban + Review mode + Board/List/bulk-bar fidelity | `f230f4e`, `7ff2e1a` | Wave 2.2 (Review mode) folded into 2.1 Slice 1 |
| 2.3 Slice 1 | Candidate profile rebuild | `5c32cb8` | Active-app selector + stage-contextual block + repeat-applicant banner all shipped. Merge flow (A-3) still pending. |
| 2.4 Slice 1 | Vacancy detail rebuild — 5-tab restructure | `4a7a723` | "Candidates tab" decision resolved via Option (b): Overview surfaces the attention list; the full applicant list lives at `/vacancies/[id]/pipeline`. |
| 2.5 Slice 1 | Scorecard attribute `must_have` flag | `c7dc051` | Migration 047. Wizard Step 4 persists the star; vacancy detail Scorecard tab edits inline. |
| 2.5 Slice 2a | Screening questions schema + recruiter UI | `656e1f4` | Migration 048 (`vacancy_screening_questions` + `application_screening_answers`). Wizard persists `yes_no` rows; recruiter card on Scorecard tab. |
| 2.5 Slice 2b | Apply-form integration + knockout flag surface | `380ef48` | End-to-end. Questions render on `/apply/[token]`; answers persist with pre-computed `is_knockout_flag`; candidate profile's Screening gate shows a "Screening flags" callout. |
| 2.7 Slice 1 | Vacancy creation wizard | `3ed7849` | **Divergence from locked plan:** shipped as a 5-step wizard, not the "single-scroll with `Advanced` toggle" the roadmap §2.7 called for. The wizard chrome reads cleaner against the rebuilt detail page; explicit decision to reverse the 2026-06-16 lock. |
| 2.7 Slice 2 | Candidate creation wizard | `d0a5367` | Same wizard pattern. Adds NEW Starting-stage picker + duplicate-email merge banner; removes General Status dropdown from the create flow. |
| 3.2 (partial) | Public pages polish | `f94deb1`, `2a7e202`, `8080002`, plus 2.5 2b, `25f5873` | Brand-blue header, role count, "Track your application" link on confirmation, status-page pending-offer tile, screening questions on apply form, 8px brand bar on apply page surfaces. |
| 3.3 Slice 1 | Offer countdown + confirm-decline modal | `5811894` | The two real additions called out in roadmap §3.3. |
| 3.4 | Landing page refresh + guide Coming-soon de-emphasis | `0e43fc3` | Hero "Hire with structure, not spreadsheets", product peek, honest proof strip, 6 focused features + dark hero feature card, new CTA copy. |
| 1.1 | Derive status; retire General Status as user-editable | `f0c0af6` + Migration 052 (`4e1f883`) + this session's dead-read cleanup | Trigger now derives from `pipeline_stage_id`. Profile header shows "Active · N live applications" derived from `activeApplications`. |
| A-3 | Merge candidates (Slice 1) | `313f3ec` + Migration 053 | 3-step dialog; atomic SQL function; same-vacancy collision archives loser's duplicate; old-ID redirect. |
| A-3b | Merge split-back UI + offer-warning banners | Migration 056 + profile banner + dialog warning | `split_merge()` SQL function (30-day window check, marks audit row reverted, restores loser row in place); `RecentMergeBanner` on the candidate profile with confirm dialog explaining that merged-in child rows stay on the surviving record; merge dialog Step 3 surfaces dual-offer + active-offer risks pulled by `getMergeRisks`, with a required acknowledgement checkbox before the Merge button enables. |
| A-7 | Notifications event × channel matrix | `84c249c` | 5 events × In-app/Email/Slack; Slack column auto-disabled when org has no Slack webhook; Instant vs Daily-digest radio; @mention in-app locked on. |
| A-8a | Security page 2-column layout + MFA Enabled badge | `9a4c1c7` | A-8b (Recovery codes + Active sessions) carved as new follow-up. |
| Fidelity | Tier 1 / 2 / 3 brand-colour + sentence-case + sidebar fixes | `5bd8e00`, `5874c94`, `43a31d9` | Cross-cutting polish (cleared a large portion of audit items). |
| Phase 0.9 | Pipeline empty state spec | `redesign/Pipeline Empty State.dc.html` | Design saved. |

### 🟡 In progress / partial

| Wave | What | Status |
|---|---|---|
| 1.5 | Terminology pass | Sentence-case sweep + "incomplete" sweep + 9-fix terminology pass (Role/Position → Vacancy; Evaluation criteria → Scorecard; Manage applicants → Manage candidates; Repeat applicant → Repeat candidate; Get Started → Get started; "Continue to dashboard" → Open dashboard; "Continue to preview" → Preview import) all done; deeper voice review left ongoing. |
| A-4 | Scorecard `must_have` + `recommendation` columns | `must_have` shipped in Migration 047. `recommendation` (yes/no) + `recommendation_reason` shipped in Migration 054 — UI binding (the form on the candidate profile that reads/writes these columns) deferred to Wave 2.3 continuation. |

### ⏸ Blocked / pending

| Wave | What | Why |
|---|---|---|
| 3.1 | AI Fit Analysis | Phase 0.8 legal consult booking pending. See [`ai-fit-analysis.md`](ai-fit-analysis.md). |
| A-1 | Today/Inbox screen | **Resolved 2026-06-24 via Option D — drop the Dashboard entirely.** Pipeline (`/pipeline`) is now the home surface; the `/dashboard` route is a server redirect to `/pipeline` (kept as a redirect so external links + browser back-history work). Sidebar nav and the header label map lose their Dashboard entries; auth login / OAuth callback / email confirm / MFA challenge / join / onboarding all default to `/pipeline`. Middleware auth + MFA gates now check `/pipeline` directly so the new home is properly protected. The dashboard's "Needs your attention" tile content is dropped — fold-into-pipeline is a follow-up if it's wanted, but the Interviews list (A-11b day buckets), Vacancies list, and Pipeline itself cover the most-asked use cases. |
| A-1b | Pipeline page polish per Pipeline Versions.dc.html | **Shipped 2026-06-24** — Pipeline becomes the proper home surface, not just a redirect destination. Replaced the multi-select role-filter dropdown with horizontal pill tabs (`All roles · N` + one pill per vacancy with active counts) below the header. Header label "X active" → "X active candidate(s)". Added a brand-blue "+ Add candidate" CTA next to "Review new" so the first home-screen action is visible. Dropped the Comfortable / Compact density toggle — cards always use the comfortable design now. Card refactor: vacancy title is the subtitle (replacing the dim top badge + the current-position line); fresh applies (< 24h) get a small brand-blue "New" badge next to the candidate name; bottom metadata line is `Xd in stage · Source`. The `role-filter-dropdown` component is deleted. Carved to A-1c: stage-specific bottom metadata (Interview shows scheduled time; Offer shows accept/decline status); the "+ N more" overflow popover for orgs with >3 active vacancies. |
| A-1c (role filter) | Role-filter multi-select + overflow popover per Role Filter Multiselect.dc.html | **Shipped 2026-07-03** — Closes the "+ N more" item carved from A-1b. `RoleFilterPills` goes from single-select (radio) to **multi-select** (union): clicking a visible chip toggles it independently (selected chips get the light-blue fill + blue border + a ✕ to deselect); "All roles" clears every selection. Selected roles are promoted to the front of the visible chips (capped at `maxVisible`, default 3) so an active filter is never fully hidden. The "+ N more" chip is now a Radix `Popover` — a searchable checklist of **all** vacancies (checkbox + name + active count, scrollable) with a draft that commits on **Apply** (Clear empties the draft); when the overflow hides an active selection the button shows a dot + "(K selected)". No data-layer change: `cross-vacancy-board.tsx` already filtered `filteredApplications` to the union of `roleFilter` IDs, and both Board and List render from that same `cardData`, so filtering was already consistent across views. |
| A-2 (Review Mode) | Quick Review Mode full logic per Review Mode Fixed.dc.html | **Shipped 2026-07-03** — Replaced the near-empty triage card (role chip + name + apply date + Advance/Reject on a light page) with the full experience. Dark full-bleed backdrop with circular prev/next chevrons flanking a single rich card (max-w 860px, scrolls internally). Card: header (avatar + name + "Applied to {vacancy} · {date} · via {source}" + a location / {years}y / languages tag row), an on-demand **CV summary** (Generate → `/api/ai/candidate-summary`, not persisted), a CV preview (icon + filename, opens the signed URL) + a salary/notice/source fact column, and "Open full profile". Four keyboard actions — **Reject (R)** (board's existing rejection dialog), **Skip (K)**, **Schedule (S)**, **Advance to {next stage} (A)** with a dynamic label from `activeStatuses`. Advance/Reject shrink the "new" queue; Skip just moves on; Schedule opens the real `InterviewForm` in a lazily-loaded Dialog overlay (new `getInterviewFormData` action + `onScheduled`/`onCancel` callbacks on the form) and returns here without auto-advancing, flagging an "Interview scheduled" badge. Empty queue → a checkmark completion panel ("You've reviewed all new applicants" → Back to Pipeline). Per-candidate detail (location/languages/experience/salary/notice/CV) fetched lazily via new `getReviewCandidateDetail`. The **Fit-analysis line** is intentionally omitted until AI Fit Analysis (S11) ships, per the spec's "hide it when there's no scorecard breakdown". |
| A-2 (Schedule form) | Schedule Interview layout per Schedule Interview Fixed.dc.html | **Shipped 2026-07-03** — `interview-form.tsx` restructured: capped at 920px & centered (was full-bleed), two separate bordered cards in a `1.6fr / 1fr` grid with the summary card **content-sized** (top-aligned, not stretched full-height) and Cancel/Schedule directly beneath it. Interview-type tiles now share the exact 3-col grid as Date/Time/Duration so the rhythm lines up. Mobile: single column, Date+Time pair up, and the six-row summary is replaced by a **sticky footer** one-line recap (`{when} · {duration} · {type}`) + Cancel/Schedule so the primary action is always in thumb-reach. Calendar callout + meeting-option chips moved into the form column (meeting-related) to keep the summary clean. |
| A-2 (bug fixes) | Back-button + add-scorecard deep-link fixes | **Shipped 2026-07-03** — (1) Replaced fragile `router.back()` (lands on whatever preceded in history, e.g. Settings) with explicit navigation on the Cancel actions of `interview-form` (→ /interviews), `candidate-form` (→ candidate detail on edit, /candidates on create), and `vacancy-form` (→ vacancy detail on edit, /vacancies on create). (2) Fixed the candidate profile's "Add full scorecard" button — it had a broken placeholder href (`/vacancies/${… ? '' : ''}#evaluation-…`) that always resolved to the vacancies list; it now deep-links to `/vacancies/{vacancyId}?tab=scorecard` (`vacancyId` threaded through `StageContextualBlock` → `InterviewState`). |
| A-2 (profile regressions) | Restore no-gate Screening + real Offer form + 5-stage tracker | **Shipped 2026-07-03** — Three regressions vs the confirmed `Candidate Profile A Refined.dc.html` (S02 spec). (1) **Screening**: replaced the reintroduced manual Yes/No decision gate + required-reason textarea with the spec's passive **"Screening checks · auto-flagged from the apply form"** panel — read-only info chips (Salary/Notice/Location) + an "All clear" / "N flags" status badge + the knockout-flag callout + a note pointing at the rail's Advance/Reject. The decision **is** the stage move (Q12). This also retires the A-12d mobile bottom-sheet wrapper (`ScreeningGateResponsive`) — the panel is now lightweight, so it renders inline everywhere; `Sheet`/`updateApplicationStatus` drop from the file. (2) **Offer**: replaced the "Build offer →" + "…on the roadmap…" dev-annotation stub with the real **inline Create-offer form** (Compensation + Currency, Start + Respond-by dates, Offer details, Save draft / Save & send) reusing `createOffer` + `sendOffer`; created offers surface in the `OfferPanel` below. (3) **Tracker**: `StageTracker` now always appends the terminal **Hired** node, so every tracker shows the full Applied→Screening→Interview→Offer→Hired path (callers pass only active stages, which omitted it). |
| A-2 (score in-place) | "Add full scorecard" scores in-place instead of redirecting | **Shipped 2026-07-03** — Per `Score Candidate Modal.dc.html`. The Interview-stage "Add full scorecard" button was navigating to the vacancy's Scorecard & interview tab (the SETUP page where attributes are defined), so there was no way to actually score a candidate. It now opens an in-place **Score candidate** modal (`score-candidate-modal.tsx`) that lazily loads the vacancy's *real* configured attributes + interview-guide questions via new `getScorecardData(applicationId)`: the Interview guide renders as a read-only collapsible reference; each scorecard attribute (with must-have/nice-to-have tag) gets a 1–5 picker; an Overall recommendation (Strong yes / Yes / Lean no / No) + required reason; Save draft / Submit. Submitting persists via the existing `saveEvaluation` (extended to store `recommendation` + `recommendation_reason`), and the average of the 1–5 ratings becomes the fit score on the pipeline — no navigation away. The vacancy setup tab is untouched. **Deferred (needs schema):** the multi-reviewer model from the prompt (per-reviewer cards, "others' cards hidden until you submit", a dedicated always-visible Scorecards list, and a 4-way recommendation stored natively) — the current `candidate_evaluations` row is one-per-application and `recommendation` is binary (`yes`/`no`), so the 4-way UI maps down to it and re-opening the modal prefills the saved card. |
| A-2 (duplicate fix) | Vacancy Duplicate button silent no-op | **Shipped 2026-07-03** — `DuplicateVacancyButton` swallowed `duplicateVacancy` failures (`else { setIsPending(false) }` with no feedback), so on a plan/vacancy limit (common on trial) the button looked dead. It now surfaces the real error via toast. Also added `onSelect={(e) => e.preventDefault()}` to the Duplicate + Delete `DropdownMenuItem`s so the nested button's own click reliably fires instead of the menu closing first. |
| A-1b feedback | Header + bulk-bar + terminal-rail per design | **Shipped 2026-06-25** — Three fixes after the first A-1b pass missed parts of the design: (1) Header user affordance is now just the avatar circle (username text was clipping on the right edge of narrow viewports; full name + email stay in the dropdown). (2) BulkBar grows two new actions per Pipeline Versions.dc.html — `Schedule` routes to `/interviews/new` for the single-selected candidate (toast if multi-selected); `Email` opens a `mailto:?bcc=…` to every selected candidate's address (toast if none have email on file). `Move to…` placeholder copy → `Move to stage`. (3) Hired is promoted from the cramped TerminalRail to a regular column on the right of the board (with cards visible like other columns); Rejected + Withdrawn collapse to a small footer counter strip under the board (still droppable for DnD). The old `terminal-rail.tsx` component is deleted, replaced by `footer-counter-strip.tsx`. `email` is now joined into `CrossVacancyApplication` so the Email action has data to send to. |
| A-6 | Global pipeline virtualization | Perf engineering deferred — only matters at >50 vacancies; current cross-vacancy board is fine for typical org sizes. |
| A-9c | CV camera fallback on apply form | Needs `/api/parse-cv` to accept image input (OCR / vision call). Out of scope for UI work. |
| A-11d | Pull-to-refresh on `/interviews` | Needs gesture lib or PWA hook. |
| A-12d (Screening) | Screening gate as mobile bottom sheet | **Superseded 2026-07-03** (see A-2 profile regressions) — the manual Screening gate it wrapped was removed; the passive "Screening checks" panel is lightweight and renders inline on all sizes, so `ScreeningGateResponsive` + the bottom sheet are gone. Original entry: **Shipped 2026-06-24** — `ScreeningGateResponsive` wraps the Screening stage with a compact trigger card on mobile (StageTracker + heading + one-line flag callout if any + "Open screening gate" CTA) that opens the full gate in a slide-up Sheet (`side='bottom'`, `max-h-[90vh]`, `rounded-t-2xl`). Sheet defers content mounting so `ScreeningGate` lives in exactly one place at any time — no double state. Interview / Offer / Default stages remain inline (button-only, no heavy forms). Carved to A-12e: Interview stage in a bottom sheet (would need to address scorecard navigation since it currently links out to a separate page). |

### 🚦 Recommended next slice

The shipping plan from the original lock is essentially complete. Outstanding work breaks into three categories:

**Awaiting an outside decision:**
- **Wave 3.1 AI Fit Analysis** — blocked on Phase 0.8 legal consult (EU AI Act review, €1.5–3k specialist budget). Design + spec are ready; ship-blocker is the consult booking.
- **A-1 Today / Inbox screen** — needs a design call on the §2.1 "Today vs Reports vs Dashboard" IA contradiction. The dashboard "Needs your attention" tile addresses the smallest version of the use case.

**Carved follow-ups that need new infra:**
- **A-9c** CV camera fallback — needs `/api/parse-cv` image support (LLM vision call).
- **A-11d** Pull-to-refresh on `/interviews` — gesture lib or PWA hook.
- **A-12e** Interview stage as a mobile bottom sheet — carved from A-12d after Screening shipped.

**Bound tech-debt items that don't block the roadmap:**
- **A-6** Global pipeline virtualization — only matters at >50 vacancies.
- **A-4** UI binding for `recommendation` columns — feeds into Wave 2.3 continuation when the candidate profile gets its "Move to interview? Yes/No" card.
- **Wave 1.5** deeper voice review — fuzzy scope; can be done opportunistically during other touches.

If we wanted to ship something now without external dependencies, the realistic pick is **A-11d** (pull-to-refresh with a small custom hook).

---

## Major scope change vs the original draft — "no migration anywhere"

The biggest single decision locked on 2026-06-16: **the user is cleaning all existing customer data before launch (the site is not yet published).** This means:

- ❌ **Removed: Phase 0.6** (scorecard migration plan). Greenfield rebuild.
- ❌ **Removed: scorecard `must_have` migration + 1–10/1–5 mapping** in Wave 2.5 — just build the new scale.
- ❌ **Removed: saved-views migration** path — keep the feature, no data to move.
- ❌ **Removed: public `/scorecard/<token>` URL preservation** — greenfield URL contract.
- ❌ **Removed: custom-stages migration from existing 7 global statuses** — fresh schema, no remap of existing application `status_id` references.
- ❌ **Reduced: Wave 2.6 effort** — per-vacancy custom stages with cap-10 + enum-restricted types is `L`, not `XL`, because no data preservation.
- ❌ **Reduced: Wave 2.5 effort** — scorecard rebuild is `L` (clean) instead of `L+migration`.

**One change went the other way:** AI Fit Analysis (Wave 3.1) was previously marked ⏸ BLOCKED until your Phase 8 EU AI Act framework existed. **It's no longer blocked** — it ships with the [six guardrails](ai-fit-analysis.md#3-the-six-guardrails) + a legal consult (new Phase 0.8). Effort `L` instead of `M`.

---

## Verdict legend

- ✅ **KEEP** — agreed, sequence and effort unchanged.
- ✏️ **REVISE** — agreed in principle, but specifics need to change.
- ❌ **DROP** — should not ship as proposed. Reason given.
- ➕ **ADD** — missing from the redesign's roadmap; should be there.
- ⏸ **BLOCKED** — depends on out-of-scope work; can't start.

## Effort legend

- `S` — under a week, single PR
- `M` — 1–2 weeks, single PR
- `L` — 3–4 weeks, multi-PR
- `XL` — 5+ weeks, multi-PR with infra changes
- `?` — unknown until pre-work resolves

---

## Phase 0 — Pre-work (must happen before any Wave starts)

These items resolve audit blockers; without them the roadmap is unstable. Updated 2026-06-16 with locked-decision impact.

| # | Item | Why | Effort | Source |
|---|---|---|---|---|
| 0.1 | **Fix Migration 022 trigger bug** — looks for non-existent `'inactive'` code | Required before "derived status" item makes sense. Standalone P1. | S | [`audit.md` §2.4](audit.md#24-🟡-premise-of-kill-dual-status-is-half-wrong) |
| 0.2 | ✅ **Resolve 14 audit open questions** | Done 2026-06-16. See [audit §0](audit.md#0-status--decisions-locked). | — | — |
| 0.3 | **Reconcile post-design-package features (G-022 → G-032) with each screen's spec** | 11 shipped features have unknown homes in the new IA | M | [`audit.md` §2.5](audit.md#25-🔴-features-shipped-post-design-package-are-not-reconciled) |
| 0.4 | **Pick canonical screen files; move exploratory to `_drafts/`** | An implementer who opens Profile Detailed.dc.html builds wrong UI | S | [`audit.md` §2.2](audit.md#22-🔴-screen-file-count-mismatch-14-vs-11-vs-20) |
| 0.5 | **Schema design spike — custom stages** (cap-10, enum-restricted types per Q3) | Wave 2.6 schema needs to exist before custom stages can be built. **Smaller than originally scoped** thanks to the cap + enum + no migration. | S | [`audit.md` §2.6](audit.md#26-🔴-pipeline-stage-type-model-is-a-real-schema-migration-not-a-ui-tweak) |
| 0.6 | ~~Schema migration plan — scorecard model~~ | **REMOVED.** No migration needed (greenfield per Q14). Scorecard tables get built fresh in Wave 2.5. | — | — |
| 0.7 | **Notifications sub-page field-list spec** | Notifications page still has no contents. Security split is locked (Q8). | S | [audit §0 / §4.10](audit.md#410-·-s7-·-settings-settingsdchtml) |
| 0.8 | **NEW: Legal consult on AI Fit Analysis six guardrails** | Ship-blocker for AI Fit. Budget €1500–€3000 for 2-hour structured review with an EU AI Act specialist. See [`ai-fit-analysis.md` §7](ai-fit-analysis.md#7-open-questions). | S elapsed (waiting on counsel) | [`ai-fit-analysis.md`](ai-fit-analysis.md) |
| 0.9 | **NEW: Pipeline empty state design lock + save** | User uploaded `Pipeline Empty State.dc.html` for `/pipeline` with 0 vacancies. File saved to `redesign/`. | — (done) | [audit §0 Q-S01-e](audit.md#0-status--decisions-locked) |

**Phase 0 total effort:** `S–M` aggregate (was `M`), sequenced before Wave 1. Roughly 2–3 weeks elapsed if done in parallel, plus legal consult lead time for 0.8.

---

## Wave 1 — Quick structural wins

Original framing: "low effort, high clarity." Three items genuinely fit that. Several do not.

### 1.1 ✏️ REVISE · Derive status; remove General Status field

**Original effort:** `M`. **Revised:** `S` — DB part (Phase 0.1) + UI removal of `CandidateStatusSelect`.

**What stays.** Remove the editable dropdown in candidate profile header. Repurpose the existing trigger (post Phase 0.1) to set the field correctly.

**What changes vs original.** The DB field `candidates.general_status_id` **stays** — it's the cache that the trigger writes to. The redesign's framing as a "data-model rebuild" overscopes the work. See [`audit.md` §2.4](audit.md#24-🟡-premise-of-kill-dual-status-is-half-wrong).

**Coordination.** Phase 0.1 must land first. No Phase 9/10 conflicts.

---

### 1.2 ✅ KEEP · Settings → 4 groups; fold Subscription into Billing

**Effort:** `S` (layout shell rewrite + delete `/subscription` redirect).

Sound IA. Phase 0.7 fills in Notifications + Security sub-page contents before this ships, or this ships with empty placeholders for those.

**Coordination.** No conflicts.

---

### 1.3 ✅ KEEP · Trial banner → header pill; fix "Trial · Trial"

**Effort:** `S`. Pure cosmetic.

---

### 1.4 ❌ DROP · "Reports: fix funnel rendering + remove placeholders"

**Reason:** Audited and confirmed stale. G-029 shipped the funnel using stage palette with width-scaled bars + conversion percentages; the "Hiring Rate: ---" placeholder lives on the **Dashboard** (which is also slated for change), not on Reports.

**Replacement:** ➕ ADD 1.4' — drop the Dashboard "Hiring Rate: --- / Later metric" tile (one-line change in [`dashboard/page.tsx:284`](../../app/(dashboard)/dashboard/page.tsx#L284)).

---

### 1.5 ✏️ REVISE · Terminology pass

**Original effort:** `S`. **Revised:** `M`.

**What changes vs original.** The redesign's S10 lists "RETIRE 'Incomplete'" — but `incomplete` isn't in current taxonomy (see [`audit.md` §2.11](audit.md#211-🟡-terminology-contradictions-in-s10-vs-current-code)). The full sweep is a multi-page UI string review, not a one-PR change. Bigger effort but still Wave 1.

**Coordination.** No conflicts.

---

### 1.6 ✏️ REVISE · AI reframing (calm tag, drop "NOT REVIEWED")

**Original effort:** `S`. **Revised:** `S` — but spec the pattern as a reusable component, not per-feature inline changes.

**What changes vs original.** Build `<AiDraftTag />` + `<AiDraftPanel />` once; replace orange tags across 5–6 features. Otherwise 5 parallel implementations drift.

**Coordination.** No conflicts.

---

### 1.7 ❌ DROP from Wave 1 · "Interview scheduling → candidate-first"

**Reason:** Audited and confirmed the current form already supports both pre-fill paths via URL params. "Candidate-first" is a UX default, not a refactor — see [`audit.md` §4.12](audit.md#412-·-s9-·-interview-scheduling-interview-schedulingdchtml).

**Replacement:** ✏️ Move to Wave 2 as part of S9 polish (set default UX nudge, address conflict detection gap). Effort `S`.

---

### ➕ 1.8 ADD · Rename/restructure exploratory design files

**Effort:** `S`. From Phase 0.4 follow-through. Make canonical vs draft files unambiguous.

---

### Wave 1 summary

| # | Verdict | Effort | Status |
|---|---|---|---|
| 1.1 | REVISE → smaller | S | Phase 0.1 dep |
| 1.2 | KEEP | S | Phase 0.7 dep (or ship without contents) |
| 1.3 | KEEP | S | — |
| 1.4 | DROP (stale) | — | Replaced with 1.4' |
| 1.4' | ADD | S (1-line) | — |
| 1.5 | REVISE → larger | M | — |
| 1.6 | REVISE | S | — |
| 1.7 | MOVE to Wave 2 | S | — |
| 1.8 | ADD | S | Cleanup, organizational |

Total Wave 1: ~3–4 weeks of work, half cosmetic.

---

## Wave 2 — Core workflow

The heart of the redesign. Effort estimates need a real revisit.

### 2.1 ✏️ REVISE · Global Pipeline

**Original effort:** `L`. **Revised:** `L` + perf engineering.

**What changes vs original.** Mandate virtualization (`@tanstack/react-virtual` or column-level "show 50, load more") **before** building, or "All roles" at scale is unusable. See [`audit.md` §2.10](audit.md#210-🟡-all-roles-global-pipeline-at-scale-is-a-performance-trap).

**Also needed in spec:**
- Empty state for "no roles yet" — currently absent.
- Role-chip overflow behavior at 50+ vacancies — currently absent.
- "Stale > N days" — pick N (5? per-org setting?). Currently vague.

**Coordination.** Conflicts with Wave 2.4 (vacancy-detail rebuild touches the same `KanbanBoard`). Sequence: 2.1 first.

---

### 2.2 ✅ KEEP · Review mode

**Effort:** `M`.

**Notes.** Highest clicks-saved feature in the audit. Lock keyboard binding semantics first (especially "K skip" meaning — leave-in-stage vs snooze-queue). See [`audit.md` §4.1](audit.md#41-·-s1-·-pipeline-pipeline-versionsdchtml).

---

### 2.3 ✏️ REVISE · Candidate profile rebuild

**Original effort:** `L`. **Revised:** `M` — closer to a refactor than a rebuild.

**What changes vs original.** Current profile already implements ~70% of the proposed structure (two-column, sticky rail, on-demand AI, applications list, custom fields, activity). Real additions:
- Active-application selector (single source of truth).
- Stage-contextual block (Screening / Interview / Offer / Standard).
- Repeat-applicant banner.
- Header `⋯` menu with Merge (which needs its own spec — see audit §4.2).

Effort drops a tier because most plumbing exists.

**Coordination.** Conflicts with `A-005` RHF migration on candidate-form (not the profile, but adjacent). Track.

---

### 2.4 ✏️ REVISE · Vacancy detail rebuild

**Original effort:** `L`. **Revised:** `L`.

**What changes vs original.** The proposed 5-tab structure (Overview / JD / Scorecard&questions / Apply form / Settings) is **missing the Candidates tab**, which is the daily-use surface today. Two options:
- (a) Add Candidates as the 6th tab.
- (b) Promote Overview to "what currently is in Candidates" + add an "At-a-glance" rail above it.

I lean (b). The audit identifies this as 🔴 risk; pick before implementation.

**Also:** Pipeline tab is unclear. See CS-01.

**Coordination.** **Direct conflict** with `A-005` Phase 9 RHF migration on `vacancy-form.tsx` (656 LOC). Either sequence Phase 9 first, or coordinate the rebuilds.

---

### 2.5 ✏️ REVISE · Scorecard system

**Original effort:** `L`. **Revised:** `L` (was `L+migration`; migration removed).

**What changes vs original (locked 2026-06-16).** Greenfield rebuild — no migration of existing `vacancy_questions` / `candidate_evaluations` / `candidate_evaluation_answers`. Build:
- `vacancy_questions` with `must_have BOOLEAN NOT NULL DEFAULT FALSE` + `kind TEXT` (replacing old `type` if needed for clarity).
- `candidate_evaluations` with `recommendation TEXT CHECK IN ('strong_yes','yes','lean_no','no') NOT NULL` + `reason TEXT NOT NULL` + score scale 1–5.
- Anti-anchoring: server filters answers of other reviewers until current user has submitted theirs.
- Public `/scorecard/<token>` URL contract is also greenfield — no preservation of existing tokens.

**Coordination.** None. No Phase 0 dependency. Ships any time after Phase 0.

---

### 2.6 ✏️ REVISE · Custom stages per vacancy

**Original effort:** `M`. **Revised:** `L` (was `XL` for per-vacancy free-form; locked-down scope reduces it).

**Locked decision (Q3, 2026-06-16):**
- Stages are **per-vacancy**, customizable.
- **Hard cap: 10 stages per vacancy.**
- Stage **type is enum-restricted**: `standard | interview | offer | review`. No free-text types.
- Greenfield — no migration of existing application `status_id` references.

**Why the effort dropped from XL to L:**
- Cap-10 removes overflow / virtualization / horizontal-scroll worries in the stage builder UI.
- Enum-restricted types mean behavior keys cleanly off `type` — no free-text-to-behavior mapping bugs.
- No migration of existing applications — the 20+ file callers of `applications.status_id` don't need a remap path.

**What's new in the schema:**
```sql
CREATE TABLE public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  vacancy_id UUID NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,             -- free text, any language
  type TEXT NOT NULL CHECK (type IN ('standard','interview','offer','review')),
  sort_order INTEGER NOT NULL,
  is_terminal BOOLEAN NOT NULL DEFAULT FALSE,  -- e.g. Hired/Rejected
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_pipeline_stages_vacancy_sort ON public.pipeline_stages (vacancy_id, sort_order);
```

`applications.status_id` migrates to point at `pipeline_stages.id` instead of the global `application_statuses.id`. The seven legacy `application_statuses` rows can be kept as fallback for migration code paths but new vacancies use per-vacancy `pipeline_stages` from day one.

**Default template for new vacancies:** Applied (standard) → Screening (review) → Interview (interview) → Offer (offer) → Hired (standard, terminal) + Rejected (standard, terminal) + Withdrawn (standard, terminal). 7 default stages, 3 free slots up to the cap.

**Coordination.** None — greenfield. Existing data is being cleaned anyway.

---

### 2.7 ✏️ REVISE · Stepped creation flows

**Original effort:** `M`. **Revised:** `M` (if RHF migration already done) or `L` (if not).

**What changes vs original.** The "wizard vs single-scroll" decision is unresolved across redesign docs (see audit §2.3). Pick **single-scroll with `Advanced` toggle** — preserves quick path without wizard chrome, matches current code, lower implementation cost.

**Coordination.** **Direct conflict** with `A-005` RHF migration on `vacancy-form.tsx`. Sequence: do RHF migration first, then 2.7.

---

### Wave 2 summary

| # | Verdict | Effort | Coordination notes |
|---|---|---|---|
| 2.1 | REVISE + perf eng | L+ | Conflicts with 2.4 |
| 2.2 | KEEP | M | — |
| 2.3 | REVISE (smaller) | M | A-005 adjacent |
| 2.4 | REVISE | L | **Conflicts with A-005** — sequence |
| 2.5 | REVISE | L | Phase 0.6 dep |
| 2.6 | REVISE → Option B | M (was XL) | **Touches 20+ files** — Option B reduces risk |
| 2.7 | REVISE → single-scroll | M | **Conflicts with A-005** — sequence after |

Total Wave 2: ~12–16 weeks of work depending on Option A vs B for 2.6.

---

## Wave 3 — Differentiators & polish

### 3.1 ✏️ REVISE · AI Fit Analysis

**Status (locked 2026-06-16):** Not blocked. Ships with the six guardrails + Phase 0.8 legal consult.

**Effort:** `L` (was `M`). Guardrails are real engineering — six of them, each with code-level enforcement.

**Spec:** See dedicated document [`ai-fit-analysis.md`](ai-fit-analysis.md). Covers:
- The six guardrails as design constraints
- Competitive market analysis (10 ATSes — Greenhouse, Lever, Ashby, Workable, etc.)
- DB schema (`ai_fit_analyses` table + new `organizations` columns)
- AI provider + cost (~$0.005/call on Haiku, ~$0.024/call on Sonnet)
- Anti-circumvention measures

**Coordination.** Depends on Phase 0.8 legal consult landing first. Otherwise independent of all other waves.

---

### 3.2 ✅ KEEP · Public pages polish

**Effort:** `M`.

**Notes.** Light branding (logo + thin brand bar) + screening questions on apply form. The status page is already shipped (G-022 includes withdraw). Spec should explicitly preserve the withdraw button.

---

### 3.3 ✅ KEEP · Public offer flow

**Effort:** `S`.

**Notes.** All five states already implemented (Migration 035). Two real additions: countdown UI + confirm-decline modal. Wire `offers.decline_reason` (column exists, unused).

---

### 3.4 ✏️ REVISE · Landing + guide refresh

**Effort:** `S`. **Open:** headline direction, 9→6 features collapse. Pick before build.

**Status: shipped 2026-06-22.** Landing page rewritten per `redesign/Landing and Guide.dc.html` — hero "Hire with structure, not spreadsheets" with eyebrow "The ATS built for small teams that hire carefully", 4-column kanban product peek, honest proof strip (3 points: One pipeline / Score don't guess / $20/mo) replacing the 4 vanity stats, dark "Structured evaluation, built in" hero feature with mini scorecard preview, 9 cards → 6 focused (One pipeline / Rich profiles / Interview scheduling / AI assists / Share & collect / Reports), CTA band copy to "Ready to hire with structure?". Guide index at `/guide` already category-grouped + FAQ per design ("Unchanged in structure"); only tweak — `components/guide/guide-card.tsx` Coming-soon cards now render with dashed border + muted bg so they read as deferred, not broken. Nav + footer pick up a Guides link.

---

### 3.5 ❌ DROP from this redesign · Swimlanes "Overview"

**Reason:** Marked deferred in original roadmap. Audit confirms not relevant under 15+ vacancies. Keep deferred.

---

## ➕ New items added by audit

These aren't in the original roadmap but should be.

| # | Title | Why | Effort |
|---|---|---|---|
| A-1 | Today/Inbox screen design (or formal "Dashboard dropped" decision) | Resolves §2.1 contradiction | M (design) + L (build) |
| A-2 | Mobile design specs for 4 must-work-on-phone flows | See [`mobile/`](mobile/) — produced as part of this audit | Specs done; build effort folds into each flow |
| A-3 | Merge candidates flow (spec + build) | Listed in header `⋯` but undefined | M · **shipped 2026-06-23** — 3-step dialog (Pick → Resolve → Confirm) wired to header `⋯`. Migration 053 adds `candidates.merged_into_id` + `merged_at`, a `candidate_merges` audit table, and a SECURITY-INVOKER `merge_candidates(winner_id, loser_id, field_choices)` SQL function that atomically re-points applications (with same-vacancy collision → loser's app archived), candidate_documents, candidate_notes, candidate_experience/education, candidate_evaluations + answers, interviews, custom_field_values (UNIQUE collision → winner wins), activity_log. Old IDs 302 to the winner via the candidate detail page. **Run script 053 manually.** Carved as A-3b: 30-day split-back UI; hired/dual-offer warning banners. |
| A-4 | Scorecard `must_have` + `recommendation` columns migration | Phase 0.6 follow-through | S |
| A-5 | Custom stages — Option B "per-org templates" implementation | Replaces 2.6 Option A | M · **shipped 2026-06-24** — Migration 055 adds `org_pipeline_stage_templates` (cap-10 trigger, RLS owner/admin manage), rewrites `seed_default_pipeline_stages` to copy the org's template when present, and exposes `seed_org_pipeline_stage_template_defaults` for the empty-state "Use defaults" CTA. New `/settings/pipeline-stages` page (admin-only) lets owners + admins add stages with name + type (Standard / Review / Interview / Offer) + terminal flag, see them as colored pills with type label, and remove them. Wired into the Hiring workflow nav group. |
| A-5b | Drag-reorder + safe apply-to-empty-vacancies | Carve-out from A-5 | S · **shipped 2026-06-24** — Migration 057 adds `reorder_org_pipeline_stage_templates(template_ids)` (two-pass write to dodge the UNIQUE(org, sort_order) index) + `apply_template_to_empty_vacancies(org_id)` (replaces pipeline_stages only on vacancies with zero applications — vacancies with any application history are skipped because re-pointing application.pipeline_stage_id across stage swaps is risky and out of scope). Settings page now uses @dnd-kit Sortable for drag-reorder with optimistic state + revert on failure. The bulk action surfaces "Apply to N empty vacancies" only when N > 0, with a confirm dialog spelling out the skip rule. |
| A-6 | Global pipeline virtualization mechanism | Perf requirement for 2.1 | S |
| A-7 | Settings → Notifications sub-page (full spec + build) | Listed as NEW with no contents | S spec + S build · **shipped 2026-06-23** — event × channel matrix per `Merge Notifications Security.dc.html` (5 rows × In-app/Email/Slack), Slack column auto-disabled when org has no Slack webhook, Instant vs Daily-digest email-delivery radio, @mention in-app locked on. Schema extended additively (`in_app_events`, `slack_events`, `email_delivery`, plus `email.stage_change`); legacy rows upgrade via `normalizeNotificationPreferences`. Dispatcher wiring remains the existing follow-up. |
| A-8a | Settings → Security 2-column layout | Compose existing password + MFA per design | S · **shipped 2026-06-23** — Password (left) + Two-factor (right) in md:grid-cols-2; added "✓ Enabled" badge to the MFA card title when a verified factor exists. |
| A-8b | Recovery codes + Active sessions | New infra | M · **shipped 2026-06-24** — Migration 058 adds `mfa_recovery_codes` (RLS owner-read only; writes via SECURITY DEFINER) + `replace_mfa_recovery_codes(hashes)` + `count_mfa_recovery_codes()` + `list_my_sessions()` / `delete_my_session(id)` / `delete_my_other_sessions(current_id)` wrappers around `auth.sessions`. Codes are generated server-side (32-char ambiguity-free alphabet, XXXXX-XXXXX shape, sha256-hashed), returned ONCE for a reveal-once modal with Copy / Download / "I've saved these codes" gate. Sessions card lists every session with parsed device/browser labels (smart UA parser supports iPhone / iPad / Android mobile/tablet / macOS / Windows / Linux / ChromeOS), "This device" badge (decoded from JWT `session_id` claim), per-session Sign out, and "Sign out everywhere" that keeps the current session. |
| A-9 | Apply form on mobile (CV upload UX) | See [`mobile/apply-form.md`](mobile/apply-form.md) | S · **Slice 1 shipped 2026-06-24** — 4 mobile-focused improvements to `components/apply/apply-form.tsx`: sticky Apply CTA on mobile with `env(safe-area-inset-bottom)` padding so the button sits clear of the iOS home indicator and stays in thumb-reach (renders inline on sm+); button disables when first/last/email basics are missing with the design's "Add your name and email to apply" hint underneath; GDPR Article 13 notice collapses into a `<details>` "Your data privacy" pill on mobile so the wall-of-text doesn't bury the submit button; iOS Safari file-picker hang quirk fix (blur the active text input before opening the file picker). · **Slice 2 (A-9b) shipped 2026-06-24** — About-the-job / Responsibilities / Requirements blocks on `/apply/[token]` clamp to 4 lines on mobile with a "Show more" toggle via the new `JobDescriptionBlock` client component (always full on sm+); screening questions cap at 3 visible on mobile with a "Show N more" toggle that auto-expands once the user has answered the first three. Carved to A-9c: CV camera fallback (needs `/api/parse-cv` image support). |
| A-10 | Offer page mobile design | See [`mobile/offer-approval.md`](mobile/offer-approval.md) | S · **Slice 1 shipped 2026-06-24** — Accept / Decline action bar sticks to the bottom of the viewport on mobile (renders inline on sm+), with `env(safe-area-inset-bottom)` padding for the iOS home indicator + a white/blur backdrop + top border so it reads distinct from the offer body behind. Buttons re-ordered to design's Decline-then-Accept reading pattern. Offer body collapses to 6 lines on mobile with a "Show full offer" toggle (only surfaces when the body is genuinely long — >320 chars or >4 newlines); always full on sm+. · **Slice 2 (A-10b) shipped 2026-06-24** — Subtle opacity-only pulse on the countdown label whenever `urgency === 'urgent'` (≤1 day left), per the design's "Pulse only on the final tier; constant flashing is hostile" note. Reduced-motion users opt out via `prefers-reduced-motion: reduce`. Our countdown is YMD-stable so we apply this at the day-granular `urgent` tier rather than the design's literal "final 2 hours" — hour-granularity would mean abandoning the timezone-stable YMD comparison. · **Slice 3 (A-10c) shipped 2026-06-24** — "Ask {recruiter name} a question" tertiary link rendered as muted center-aligned text above the action bar on the `sent` state. Opens the device's preferred mail client with a pre-filled subject line: `Question about your offer for {role_title} at {organization_name}`. `getOfferByToken` was extended to join through `profiles!offers_created_by_fkey` so recruiter name + email are available to the public page. Link hides when the recruiter row was deleted (FK is `ON DELETE SET NULL`) or the profile has no email. |
| A-11 | Today's-interviews mobile surface | See [`mobile/today-interviews.md`](mobile/today-interviews.md) | M · **Slice 1 shipped 2026-06-24** — `/interviews` list page restructured for narrow viewports. Stats strip switches from a 4-column row (crushed at 375px) to a 2×2 grid on mobile, 4-col on sm+. Interview cards now stack vertically on mobile: identity block (icon + candidate + vacancy + interviewer) on top, then a meta row (time / status badge + Join link / actions ⋯) below a thin separator. Time block left-aligns on mobile, right-aligns on sm+. Truncation guards on the candidate vacancy + interviewer fields stop long titles from blowing out the layout. · **Slice 2 (A-11b) shipped 2026-06-24** — Interviews now group into relative-day buckets (Today / Tomorrow / This week / Later / Past) with a sticky section header per bucket on mobile so "what's next" stays in view as the user scrolls. Within each bucket, today/upcoming sort chronologically ASC so the next interview is at the top; past sorts DESC so the most-recent is first. · **Slice 3 (A-11c) shipped 2026-06-24** — Cards whose status is still `scheduled` but whose `scheduled_at` is >1 hour past now show a thin yellow "Past due — mark complete or no-show" hint inside the identity block; "Mark complete" added to the InterviewActions dropdown alongside the existing Cancel / No-show entries (server action already supported `'completed'`). Carved to A-11d: pull-to-refresh (needs gesture lib or native PWA hook). |
| A-12 | Candidate profile mobile collapse | See [`mobile/candidate-profile.md`](mobile/candidate-profile.md) | S · **Slice 1 shipped 2026-06-24** — RailActions promoted inline above ExperienceSection on `lg-` viewports so the primary "Advance to [next stage]" brand-blue button + Schedule / Email / Reject trio sit in the thumb-reach zone instead of buried at the bottom (the right rail stacks below the left column when the grid collapses to single-col). The rail's copy is `hidden lg:block` so desktop still gets one RailActions in the right rail. Mobile thumb-zone primary action is the highest-leverage win per `docs/redesign/mobile/candidate-profile.md` §"Action priority for thumb reach". · **Slice 2 (A-12b) shipped 2026-06-24** — `CandidateDocuments` and `ContactCard` are promoted inline between `EducationSection` and `CustomFieldsDisplay` on `lg-` so the user sees Documents/Contact (high-value scannable info) without scrolling past the Activity feed; the rail copies are wrapped in `hidden lg:block` so desktop still gets one of each. · **Slice 3 (A-12c) shipped 2026-06-24** — Experience + Education sections collapse on mobile by default with a chevron-toggle on the section header (`sm:hidden`); always expanded on `sm+`. Clicking the section title toggles; clicking the `Add` button auto-expands so the form is visible. The chevron rotates 180° when open. Carved to A-12d: StageContextualBlock as a bottom sheet for action-heavy stages (scorecards, offer creation). |
| A-13 | "AI Draft" reusable component for Wave 1.6 | Avoids per-feature drift | S |

---

## Sequence diff vs original

**Original sequence:**
- Wave 1 first → Wave 2 in order (2.1 → 2.3 → 2.4/2.5 → 2.2 → 2.6 → 2.7) → Wave 3 last.

**Revised sequence:**

1. **Phase 0** (foundation): 0.1 trigger bug fix → 0.2/0.4 docs cleanup → 0.5 stages schema design → 0.6 scorecard migration plan → 0.7 settings sub-page spec.
2. **Wave 1** (cosmetic / IA): 1.3 trial pill → 1.6 AI reframe (A-13 reusable component) → 1.4' drop hiring-rate tile → 1.1 derived status → 1.2 settings regroup → 1.5 terminology pass → 1.8 file cleanup.
3. **Wave 2 (core)** — sequence depends on coordination with Phase 9 of product roadmap:
   - **If Phase 9 RHF migration ships first:** 2.4 → 2.7 → 2.5 (depends on 2.4) → 2.3 → 2.1 (perf eng) → 2.2 → 2.6 Option B.
   - **If Phase 9 doesn't ship first:** 2.1 (perf eng) → 2.3 → 2.6 Option B → 2.5 → 2.4 + 2.7 simultaneously with RHF migration (coordinated).
4. **Wave 3** (differentiators): 3.2 public pages → 3.3 public offer → 3.4 landing → 3.1 AI Fit (BLOCKED).
5. **New items:** A-1 Today screen → A-7/A-8 settings sub-pages → mobile builds woven into each flow's wave.

---

## Coordination notes (with product roadmap)

These are places the redesign work crosses your existing Phase 9 / Phase 10 plans. The redesign roadmap is standalone, but you should know:

| Redesign item | Product roadmap conflict | Recommended order |
|---|---|---|
| Wave 1.1 derived status | Independent | redesign first |
| Wave 2.3 profile rebuild | A-002 candidates/page.tsx split (Phase 9.3) | A-002 first, then 2.3 — or coordinate |
| Wave 2.4 vacancy detail rebuild | A-005 vacancy-form RHF migration (Phase 9.3) | **A-005 first** (vacancy-form is touched heavily) |
| Wave 2.7 stepped creation | A-005 again | A-005 first |
| Wave 3.1 AI Fit Analysis | Phase 8 EU AI Act framework | **Phase 8 first** (hard block) |
| Wave 3.2/3.3 public pages | None | redesign first |

Phase 10 (billing) does not conflict with any redesign item directly. The Settings → Billing fold (Wave 1.2) is independent of the billing-provider wiring.

---

## Effort summary

| Wave | Original total | Revised total | Delta |
|---|---|---|---|
| Phase 0 | (not in original) | M aggregate | +M |
| Wave 1 | ~7×S = 1 month | 3–4 weeks (one item moved to W2) | ~same |
| Wave 2 | ~6×L + M = 5 months | 12–16 weeks (Option B for 2.6) | shorter if Option B chosen |
| Wave 3 | ~4×(S/M) | 3 weeks (3.1 blocked) | shorter |
| New items (A-1 → A-13) | — | ~5 weeks aggregate | +1.25mo |

**Total revised:** ~6–8 months of focused work, assuming Phase 9 of product roadmap is sequenced first or coordinated.

---

## Open questions — RESOLVED 2026-06-16

All 14 audit open questions + 5 S1 sub-questions answered. See [`audit.md` §0](audit.md#0-status--decisions-locked) for the full locked-decision table.

---

## What to do after reading this

1. ✅ **Verdicts signed off** (2026-06-16).
2. ✅ **14 open questions resolved** (2026-06-16). See locked-decision table.
3. **Decide Phase 9/Phase 10 interleave** (per your standalone-scope decision, that's your call, not mine).
4. **Book Phase 0.8 legal consult** — required for AI Fit Analysis Wave 3.1.
5. **Flow-by-flow docs** — in progress. Order: ✅ S1 Pipeline → 🔄 S4 Vacancy detail → S4d Creation flows → S2 Candidate profile → S9 Interview scheduling → S5 Public pages → S5c Public offer → S7 Settings → S8 Reports → S10 AI/terminology → S11 AI Fit (see [`ai-fit-analysis.md`](ai-fit-analysis.md) instead).
