# S8 · Reports + Interviews — flow analysis

> **Status:** Draft 1, authored 2026-06-17. Smallest functional rebuild — most of the redesign's "fixes" are stale.
>
> **Sources:** [`Reports and Interviews.dc.html`](../../../redesign/Reports%20and%20Interviews.dc.html), [`audit.md` §4.11](../audit.md#411-·-s8-·-reports--interviews-reports-and-interviewsdchtml). Per Q3 (per-vacancy `pipeline_stages`), the funnel must adapt to custom stages — that's the only meaningful change.
>
> **Why this is ninth.** Reports + Interviews list are organizational telemetry — already shipped (G-029 + the Interviews list). The redesign's complaints ("black funnel bars", "Hiring Rate: ---", "Later metric") are pre-G-029 grievances; the live code already addresses them. This doc is mostly a confirmation pass + one custom-stages adaptation.

---

## 1. Current implementation

### Routes (Reports — G-029)

| Route | File | Lines |
|---|---|---|
| `/reports` | [`page.tsx`](../../../app/(dashboard)/reports/page.tsx) | 5 — redirects to `/reports/pipeline` |
| `/reports` layout | [`layout.tsx`](../../../app/(dashboard)/reports/layout.tsx) | 26 — tab strip + period selector |
| `/reports/pipeline` | [`pipeline/page.tsx`](../../../app/(dashboard)/reports/pipeline/page.tsx) | 105 — funnel + conversion table |
| `/reports/time-to-hire` | [`time-to-hire/page.tsx`](../../../app/(dashboard)/reports/time-to-hire/page.tsx) | 67 — median/p25/p75/mean + per-vacancy table |
| `/reports/sources` | [`sources/page.tsx`](../../../app/(dashboard)/reports/sources/page.tsx) | 69 — source_type breakdown |

### Interviews list

| Route | File | Lines |
|---|---|---|
| `/interviews` | [`page.tsx`](../../../app/(dashboard)/interviews/page.tsx) | 298 — list with filters + stats strip |

### Reports helpers (pure functions, well-tested)

| File | Lines | Purpose |
|---|---|---|
| `lib/reports/period.ts` | 34 | Period selector logic (7/30/90/365/all-time) |
| `lib/reports/funnel.ts` | 114 | Funnel + stage-to-stage conversion calc |
| `lib/reports/time-to-hire.ts` | 84 | Median + p25/p75 + per-vacancy breakdown |
| `lib/reports/source-summary.ts` | 62 | Source effectiveness aggregation |
| `lib/reports/queries.ts` | 213 | Server-side data fetch |

Total: ~507 lines of well-tested pure logic. **Don't rewrite.**

### What's already shipped (G-029)

- ✅ Pipeline conversion funnel using stage palette (NOT solid black — that complaint is stale)
- ✅ Stage-to-stage conversion table with real rates (NOT "---" — also stale)
- ✅ Time-to-hire stats: median + p25 + p75 + mean
- ✅ Per-vacancy time-to-hire breakdown
- ✅ Sources by `source_type` (manual / public_form / etc.)
- ✅ Period selector with 4 presets + all-time
- ✅ Honest empty states ("No applications in this period yet")
- ✅ Recharts integration (~80KB)
- ⏭ Per-recruiter productivity breakdown — deliberately skipped (surveillance-y for small teams)

### Interviews list — what works (already complete)

Per [`audit.md` §4.11](../audit.md#411-·-s8-·-reports--interviews-reports-and-interviewsdchtml):

- ✅ Filter pills: All / Scheduled / Past / Cancelled / No Show
- ✅ Status counts in pill labels
- ✅ Per-row type icon (video/phone/onsite)
- ✅ Candidate name + vacancy + interviewer + time + status badge
- ✅ Join link (when `google_meet_link` or `meeting_link` set)
- ✅ `⋯` action menu for non-terminal statuses
- ✅ 4-card stats strip

---

## 2. Proposed redesign

### 2.1 Reports — Pipeline conversion (Tab 1)

**Spec changes vs current:** none that are real. The audit confirms the "fixes" are stale.

**Polish:**
- Page header + tab strip restyle to design system
- Funnel bar restyle to match stage colors from per-vacancy `pipeline_stages` (per Q3 — see §2.4 below)
- "Stages" view dropdown (NEW idea — see Q-S8-c): default = global aggregated stages; alternate = per-vacancy break-down

### 2.2 Reports — Time to hire (Tab 2)

**Spec changes vs current:** none.

**Polish only.** Restyle the median/p25/p75/mean stats strip to design system. Per-vacancy table unchanged.

### 2.3 Reports — Sources (Tab 3)

**Spec changes vs current:** none.

**Polish only.** Source-type breakdown with applied/hired/conversion% bars. Existing chart.

### 2.4 Custom-stages funnel adaptation (Q3 dependency)

Per Q3 (per-vacancy `pipeline_stages` per S04 Wave 2.6), the funnel can't assume the legacy 7-stage global model. Two options:

**Option A — Global aggregated funnel (recommended).** The funnel collapses per-vacancy stages into 5 canonical buckets by `pipeline_stages.type`:
- Applied (type = `standard`, first non-terminal)
- Screening (type = `review`)
- Interview (type = `interview` — sums across multi-round)
- Offer (type = `offer`)
- Hired (type = `standard`, terminal)

This means a vacancy with "HR Interview / Tech Interview / Final Interview" (3 interview-type stages) shows as one "Interview" segment in the funnel.

Server-side computation reads each vacancy's `pipeline_stages` to map application status → canonical bucket.

**Option B — Per-vacancy funnel.** Each vacancy gets its own funnel with its own stage names. Powerful but UI-heavy at 30+ vacancies.

**Recommendation:** Option A. Per-vacancy detail already exists on Vacancy detail Overview (per S04 §2.1's funnel strip).

### 2.5 Interviews list

**Spec changes:** none functional. Restyle to design system. Per the design HTML:
> "Kept the real model (stats strip, status filter tabs, rows with type icon · candidate · vacancy · interviewer · time · status · Join · ⋯) — restyled to the design system with the stage palette for status badges. Type icon distinguishes video / phone / onsite; cancelled rows dimmed."

Already true today; restyle to confirm consistency.

### 2.6 Reports + Interviews co-location

The redesign's `Reports and Interviews.dc.html` puts both on the same screen. The audit pushed back:
> "Reports + Interviews on one screen — they're related but not the same screen. Current architecture has Reports in `/reports/*`, Interviews in `/interviews/*`. Merging UX → URL change → break existing deep-links."

**Recommendation:** **keep separate routes.** Both stay top-level (per the redesign's nav line). The design's screen visually pairs them but the routes don't merge. Reports is still `/reports/*`; Interviews is still `/interviews`.

---

## 3. Gaps, missing screens, edge cases

### 3.1 Missing screens

| Surface | Why missing | Recommended action |
|---|---|---|
| Empty funnel (org has 0 apps in period) | Already shipped per G-029 | Same — "No applications in this period yet" |
| Empty time-to-hire (0 hires) | Already shipped | Same — "No hires in this period — try a wider range" |
| Empty sources (0 applications) | Already shipped | Same |
| Per-vacancy stages don't map to canonical buckets cleanly | Q3 introduces this | Server-side: stages with `type = 'standard'` are bucketed by `is_terminal` (start = Applied; terminal = Hired); else by `type` |
| Reports on mobile | Out of scope (desktop-by-nature) | Banner: "Reports best viewed on desktop" + show only the KPI numbers |

### 3.2 Edge cases

| Case | Today | New |
|---|---|---|
| Org with 0 vacancies | Reports redirect to pipeline tab with empty state | Same |
| Period with 0 data but other periods with data | Empty state shown | Same; suggest wider period |
| Vacancy with all stages of type `interview` (no offer / hired) | N/A | Funnel buckets it correctly per type → conversion still computes |
| Withdrawn vs rejected — distinction in funnel | Today: both "lost" — included in "started but didn't hire" denominator | Same; the funnel shows conversion to next stage, not loss reasons |
| Same candidate applies to N vacancies | Counted N times in applications-by-period; once per `candidate_id` if deduped | Current implementation counts applications, not candidates — confirm and preserve |
| Auto-expire offers (cron) shifting time-to-hire | Hires are by accepted offer; auto-expire doesn't affect | Same |

### 3.3 Performance

- 10K applications across all periods: server-side aggregation < 1s on warm cache (already verified per G-029)
- 100K applications: same query reads all rows — current `lib/reports/queries.ts` doesn't paginate. Hardcoded period limit prevents runaway. Acceptable for v1.
- Recharts at 10+ vacancies in per-vacancy mode: under 100KB; client render < 500ms.

---

## 4. Reuse opportunities

| Need | Reuse from | Notes |
|---|---|---|
| Period selector | `lib/reports/period.ts` | Direct |
| Funnel computation | `lib/reports/funnel.ts` | **Modify** to read per-vacancy `pipeline_stages` and bucket by type |
| Time-to-hire computation | `lib/reports/time-to-hire.ts` | Direct |
| Source summary | `lib/reports/source-summary.ts` | Direct |
| Server queries | `lib/reports/queries.ts` | Modify for stage-bucket mapping |
| Recharts FunnelChart | Existing | Restyle palette via prop |
| Empty states | Existing | Direct |
| Stats strip | Existing | Restyle |
| Interviews list filters | Existing | Direct |
| Type icon (video/phone/onsite) | Existing | Direct |
| Join link | Existing | Direct |

**Net new code:**
- Bucket-mapping logic in `funnel.ts` (stage → canonical bucket)
- "View per-vacancy" toggle (if Q-S8-c locked)
- Page header restyle
- Stage-palette token map

---

## 5. DB / API changes

### 5.1 Schema

**No new tables.** All required data exists.

`applications.pipeline_stage_id` (per S04 Wave 2.6) is the input to the bucket mapping.

### 5.2 Server actions / queries

**Modified:**

- `lib/reports/funnel.ts::computeFunnel(period)` — read per-vacancy `pipeline_stages` (joined to `applications`); bucket each application's current stage by `pipeline_stages.type` into canonical 5-segment funnel.

**Unchanged:**

- `lib/reports/time-to-hire.ts` — works on Hired-status applications; unaffected by stage refactor
- `lib/reports/source-summary.ts` — works on `source_type` column; unaffected

**New (if Q-S8-c locked):**

- `lib/reports/funnel.ts::computePerVacancyFunnel(vacancyId, period)` — returns one funnel per vacancy with that vacancy's named stages

### 5.3 Routes

No new routes. All existing.

---

## 6. Effort estimate

### 6.1 Wave 1.4 (revised) — Reports polish

| Task | Effort | Reuse |
|---|---|---|
| Page header + tab strip restyle | `S` | CSS |
| Funnel stage-bucket mapping for custom stages | `S` | Modify `funnel.ts` |
| Stat strip restyle | `S` | CSS |
| Empty state copy review (already shipped per G-029) | `S` | Confirm |
| Source bar restyle to design palette | `S` | Recharts theme |
| "View per-vacancy" toggle (Q-S8-c) | `S` | If locked |
| Mobile banner ("best viewed on desktop") | `S` | Single component |

**Wave 1.4 total: ~S** (1 week elapsed). One of the smallest in the redesign.

### 6.2 Interviews list polish

| Task | Effort | Reuse |
|---|---|---|
| Stats strip restyle to design system | `S` | CSS |
| Filter pill restyle | `S` | CSS |
| Row styling (type icon + status badge palette) | `S` | CSS + palette |
| Cancelled rows dimmed (already if shipped) | `S` | Confirm |

**Interviews list total: ~S** (3 days elapsed).

### 6.3 Coordination

- **Depends on Wave 2.6** (`pipeline_stages` table) for the funnel adaptation
- **No conflict** with other waves
- Recommendation: ship Reports polish alongside Wave 2.6 since both touch the same data layer

---

## 7. Open questions

### 7.1 RESOLVED via locked decisions

| Question | Status |
|---|---|
| Funnel "black bars" | ✅ Stale — G-029 already uses stage palette |
| "Hiring Rate: ---" placeholder | ✅ Stale — G-029 removed |
| Honest empty states | ✅ Already shipped |
| Per-recruiter productivity breakdown | ✅ Deliberately skipped (surveillance concern) |
| Reports + Interviews co-location | ✅ Audit recommends separate routes; locked |

### 7.2 NEW — surfaced by this analysis

- **Q-S8-a:** **Custom-stages funnel adaptation** — Option A (canonical 5-bucket aggregation) or Option B (per-vacancy funnels)? *Lean: A* — see §2.4.
- **Q-S8-b:** **Bucket mapping for ambiguous types** — a custom stage of type `standard` that's not first or last (e.g. "Background check") falls into… Applied bucket? New "Pre-interview" bucket? *Lean: collapse into "Screening" bucket* — anything between first-standard and first-interview-typed stage rolls up. Document this rule.
- **Q-S8-c:** **"View per-vacancy" toggle on funnel** — ship in v1 as a secondary mode, or keep Option A canonical-only? *Lean: omit v1* — adds UI complexity for a power feature; Vacancy detail Overview already has per-vacancy funnel strip.
- **Q-S8-d:** **Time-to-hire — include withdrawals?** Today they're excluded (only Hired applications count). Spec doesn't address. *Lean: keep excluded* — time-to-hire = days from apply to accepted offer; withdrawals aren't hires.
- **Q-S8-e:** **Hiring rate KPI on dashboard** — the audit notes the stale "Hiring Rate: ---" tile on Dashboard. Since Today dashboard is dropped (Q5), this resolves automatically. Just confirm the Dashboard removal closes the loop. *Lean: confirm dropped* per Q5.
- **Q-S8-f:** **Mobile Reports** — banner-only ("best viewed on desktop") or render KPI numbers (no charts)? *Lean: KPI numbers + chart placeholder + banner* — preserves the recruiter's "check on phone" use case for at-a-glance numbers.
- **Q-S8-g:** **Custom date range** — beyond the 4 presets + all-time, allow explicit "From — To" picker? *Lean: defer to v1.1* — current periods cover 95% of need; adding the picker adds query complexity (cache key etc.).

---

## 8. Test plan

### 8.1 Functional — Reports

- [ ] `/reports` redirects to `/reports/pipeline`
- [ ] Tab strip renders 3 tabs; active highlighted
- [ ] Period selector renders + persists in URL
- [ ] Funnel renders with stage palette (NOT black)
- [ ] Funnel bar widths scaled to counts
- [ ] Conversion % shown beside each bar
- [ ] Conversion table uses real rates
- [ ] Custom-stages funnel: stages bucket correctly per type (per Q-S8-a)
- [ ] Empty funnel renders "No applications in this period yet"
- [ ] Time-to-hire stats render
- [ ] Per-vacancy time-to-hire table renders
- [ ] Empty time-to-hire renders "No hires in this period — try a wider range"
- [ ] Sources by source_type renders with bars
- [ ] Empty sources renders honest copy
- [ ] All 3 tabs render under different period selections

### 8.2 Functional — Interviews list

- [ ] All filter pills render
- [ ] Pill counts correct
- [ ] Rows show type icon
- [ ] Status badge palette matches design system
- [ ] Join link visible when meeting_link set
- [ ] ⋯ menu for non-terminal statuses
- [ ] Cancelled rows visually dimmed
- [ ] Stats strip shows 4 cards correctly

### 8.3 Non-functional

- [ ] Reports page < 1s on warm cache
- [ ] Funnel query < 500ms at 10K applications
- [ ] Mobile renders KPI numbers (per Q-S8-f)

### 8.4 Regression

- [ ] G-029 funnel computation unchanged (just bucket mapping added)
- [ ] G-029 per-vacancy time-to-hire breakdown unchanged
- [ ] G-029 source-by-source_type unchanged
- [ ] Existing period URL params still work
- [ ] Interviews list filters unchanged

---

## 9. Verification

Aligned with [`docs/claude-code-workflow.md`](../../claude-code-workflow.md) Phase 5:

- [ ] All sub-tasks in §6 complete
- [ ] Tests in §8 pass
- [ ] Docs updated:
  - [ ] `docs/3-architecture/frontend.md` — reports tab restyle, custom-stage bucket mapping
  - [ ] `docs/3-architecture/backend.md` — funnel.ts bucket logic change
  - [ ] `docs/8-decisions.md` — Q-S8-a through Q-S8-g decisions
- [ ] Ripple check — Vacancy detail Overview funnel strip (per S04 §2.1) reads same canonical bucket logic

---

## 10. What to do after reading

1. **Confirm Q-S8-a through Q-S8-g** (or override).
2. **Decide Q-S8-a (funnel adaptation)** — affects effort estimate slightly.
3. **Decide Q-S8-c (per-vacancy toggle)** — affects scope.
4. **Next flow doc:** S10 AI/terminology — closes the corpus. Smallest remaining (~2500 words). Covers the AI calm-pattern refactor + terminology rules across all surfaces.

---

## Appendix — file inventory for this flow

**New files:**

| File | Purpose |
|---|---|
| `lib/reports/stage-buckets.ts` | New — bucket mapping logic for custom stages |
| `components/reports/per-vacancy-toggle.tsx` | New (if Q-S8-c) |
| `components/reports/mobile-banner.tsx` | New — "best viewed on desktop" banner |

**Modified files:**

| File | Change |
|---|---|
| `lib/reports/funnel.ts` | Add bucket-mapping call before per-stage aggregation |
| `lib/reports/queries.ts` | Join `pipeline_stages` for the funnel query |
| `app/(dashboard)/reports/pipeline/page.tsx` | Render new bucketed funnel |
| `app/(dashboard)/reports/layout.tsx` | Restyle tab strip + period selector |
| `app/(dashboard)/reports/sources/page.tsx` | Restyle bar palette |
| `app/(dashboard)/reports/time-to-hire/page.tsx` | Restyle stat strip |
| `app/(dashboard)/interviews/page.tsx` | Restyle filters + rows |

**Retained as-is:**

- `lib/reports/period.ts` — unchanged
- `lib/reports/time-to-hire.ts` — unchanged
- `lib/reports/source-summary.ts` — unchanged

**Docs touched:**
- `docs/3-architecture/frontend.md`
- `docs/3-architecture/backend.md`
- `docs/8-decisions.md`

**Tests added:**
- `tests/lib/reports/stage-buckets.test.ts` — Q-S8-a + Q-S8-b mapping rules
- `tests/lib/reports/funnel-with-custom-stages.test.ts` — end-to-end funnel with custom pipeline
- `tests/components/reports/mobile-banner.test.tsx` — mobile detection
