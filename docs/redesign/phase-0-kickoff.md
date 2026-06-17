# Phase 0 — Implementation kickoff playbook

> **Authored:** 2026-06-17. **Purpose:** bridge the design corpus to implementation. Collapses every sub-question surfaced across the 10 flow docs into one batch-sign-off table; turns each [`roadmap.md` Phase 0](roadmap.md#phase-0--pre-work-must-happen-before-any-wave-starts) item into an implementation-ready spec.
>
> **Read this if you're starting to build.** Everything before this (audit, roadmap, AI Fit, mobile docs, 10 flow docs) is design. This is the first implementation-direction document.
>
> **Companion:** [`roadmap.md`](roadmap.md) is the wave sequence; this is the sprint-zero unlock for it.

---

## Part 1 — Batch sub-question sign-off

Each flow doc surfaced sub-questions with a recommended lean. **Below is every one in one table** so you can sign off in a single session. Default acceptance = "go with the lean unless overridden in the Override column."

### S01 Pipeline (5 sub-questions)

| ID | Question | Lean | Override |
|---|---|---|---|
| Q-S01-a | `BulkMoveDialog` loops client-side or server action? | Confirm at build; ship `bulkMoveApplications` server action | |
| Q-S01-b | Review mode global-only or also per-vacancy? | **Both** (global + per-vacancy) | |
| Q-S01-c | Stale-aging threshold N days | **Hardcode 5** | |
| Q-S01-d | Bulk Schedule with N>1 selected | **Hide button** | |
| Q-S01-e | `/pipeline` with 0 vacancies | **Welcome card** (not redirect) | |

### S02 Candidate profile (8 sub-questions)

| ID | Question | Lean | Override |
|---|---|---|---|
| Q-S2-a | Active-app selector when only 1 live app | **Hide selector**, label only | |
| Q-S2-b | Multi-round interview history pattern | **Collapsed accordion** in Interview block | |
| Q-S2-c | AI summary regeneration policy | **Stale-with-banner**, explicit user re-gen | |
| Q-S2-d | Merge dialog Step 1 search | **Hybrid** — manual search + auto-suggest pinned | |
| Q-S2-e | Hired-state candidate editability | **Stay editable** with banner | |
| Q-S2-f | Application history view from table | **Modal overlay** (preserves scroll) | |
| Q-S2-g | Withdraw-on-behalf-of-candidate | **Add it** — recruiter can record candidate withdrawal | |
| Q-S2-h | Right rail order — DETAILS first | **Follow design** (DETAILS / CONTACT / CUSTOM) | |

### S04 Vacancy detail (5 sub-questions)

| ID | Question | Lean | Override |
|---|---|---|---|
| Q-S04-a | Stage type change with apps in stage | **Warning modal**, allow with explicit confirm | |
| Q-S04-b | Header copy-apply-link feedback | **Toast confirmation** | |
| Q-S04-c | Hiring team scoping | **Defer per-vacancy hiring team** to v2; show all org members | |
| Q-S04-d | Time-to-fill benchmark source | **Org-internal** same-department; hide if <3 hires | |
| Q-S04-e | Health indicator thresholds | **Hardcode** (Green: <5d / Amber: 5-10d / Red: >10d) | |

### S04d Creation flows (8 sub-questions)

| ID | Question | Lean | Override |
|---|---|---|---|
| Q-S4d-a | Step 5 publish-vs-draft default | **Publish now** highlighted | |
| Q-S4d-b | Custom fields in vacancy wizard | **Include** as Step 4 sub-section | |
| Q-S4d-c | Plan limit reached timing | **At submit** (not at field level) | |
| Q-S4d-d | Hiring manager → profile-link picker | **Keep free text v1** | |
| Q-S4d-e | Default scorecard on Step 4 skip | **Empty** (forces explicit setup later) | |
| Q-S4d-f | CV re-parse mid-wizard | **Silent re-parse** with banner | |
| Q-S4d-g | `work_mode = remote` + location field | **Keep both visible** | |
| Q-S4d-h | Draft persistence model | **v1: create draft row on cancel-with-content**; v1.1: mid-wizard recovery table | |

### S05 Public pages (8 sub-questions)

| ID | Question | Lean | Override |
|---|---|---|---|
| Q-S5-a | Screening Q rendering order | **Recruiter-configured order** | |
| Q-S5-b | Camera-as-CV-source on mobile | **v1.1** (defer) | |
| Q-S5-c | Confirmation "Track your application" link | **Always show** | |
| Q-S5-d | Listing role count granularity | **Simple count** | |
| Q-S5-e | Status page offer-pending link | **Deep-link** to `/offer/<token>` | |
| Q-S5-f | Screening Q max per vacancy | **Cap at 10** | |
| Q-S5-g | Re-apply after withdrawal | **Allow** — duplicate-detection merges | |
| Q-S5-h | GDPR notice collapse on desktop too | **Yes, collapse everywhere** | |

### S05c Public offer (6 sub-questions)

| ID | Question | Lean | Override |
|---|---|---|---|
| Q-S5c-a | "Ask a question" 3rd option | **Defer to v1.1** | |
| Q-S5c-b | Countdown precision at ≤1 hour | **Precise minutes** ("45 minutes left") | |
| Q-S5c-c | Accepted state — keep summary visible | **Keep visible** | |
| Q-S5c-d | Decline message in webhook | **Include in payload** | |
| Q-S5c-e | Markdown body rendering | **v1.1** (plain text v1) | |
| Q-S5c-f | 🎉 emoji on accepted state | **Keep** (sanctioned emoji moment) | |

### S07 Settings (8 sub-questions)

| ID | Question | Lean | Override |
|---|---|---|---|
| Q-S7-a | Member visibility on Hiring workflow group | **Hidden** (matches today) | |
| Q-S7-b | Notification preferences default | **All email events on** | |
| Q-S7-c | MFA policy on own sub-page | **Stay on Organization page** (one card) | |
| Q-S7-d | `language` field in Profile | **Omit v1** (i18n is Phase 7) | |
| Q-S7-e | Quiet hours | **v1.1** (defer) | |
| Q-S7-f | Active sessions + login history | **v1.1** (defer) | |
| Q-S7-g | `/subscription` redirect duration | **6 months** | |
| Q-S7-h | Notification visibility by member role | **Hide irrelevant rows** | |

### S08 Reports (7 sub-questions)

| ID | Question | Lean | Override |
|---|---|---|---|
| Q-S8-a | Custom-stages funnel adaptation | **Option A** — canonical 5-bucket | |
| Q-S8-b | Ambiguous `standard`-type stage bucket | **Collapse into Screening** | |
| Q-S8-c | Per-vacancy funnel toggle | **Omit v1** (use Vacancy detail Overview funnel) | |
| Q-S8-d | Time-to-hire withdrawal handling | **Exclude withdrawals** | |
| Q-S8-e | Hiring rate KPI removal | **Confirm dropped** via Q5 dashboard drop | |
| Q-S8-f | Mobile Reports treatment | **KPI numbers + chart placeholder + banner** | |
| Q-S8-g | Custom date range picker | **v1.1** (defer) | |

### S09 Interview scheduling (6 sub-questions)

| ID | Question | Lean | Override |
|---|---|---|---|
| Q-S9-a | No-calendar + video interview type | **Allow** + manual link field | |
| Q-S9-b | Multi-provider default | **First-connected** | |
| Q-S9-c | Edit-interview surface | **Modal on candidate profile only** | |
| Q-S9-d | Past-time scheduling | **Allow with confirm** | |
| Q-S9-e | Interviewer left org mid-flight | **Show "Interviewer left" prompt** + reschedule | |
| Q-S9-f | Multi-app candidate scheduling auto-select | **Auto-select if `?app=` set**, else picker | |

### S10 AI + Terminology (7 sub-questions)

| ID | Question | Lean | Override |
|---|---|---|---|
| Q-S10-a | "AI-assisted" tag persistence | **Forever** | |
| Q-S10-b | Org-level AI off toggle | **v1.1** (defer) | |
| Q-S10-c | Token cost surfacing | **Hide v1** | |
| Q-S10-d | Streaming AI responses | **v1.1** (defer) | |
| Q-S10-e | Regenerate rate limit | **5/min/session global** | |
| Q-S10-f | Sanctioned emoji list | **🎉 + 🌟 only** | |
| Q-S10-g | Sparkle icon choice | **`Sparkles`** (not Wand2) | |

### AI Fit Analysis (7 sub-questions from `ai-fit-analysis.md` §7)

| ID | Question | Lean | Override |
|---|---|---|---|
| Q-AIF-a | Legal consult timing | **Book now**, design after consult, code after that | |
| Q-AIF-b | Pricing model | **Included in Pro** | |
| Q-AIF-c | Model choice | **Haiku default + Sonnet upgrade for Pro+** | |
| Q-AIF-d | EU geofence country list | **27 EU + Iceland + Norway + Liechtenstein** | |
| Q-AIF-e | Customer-acknowledgement doc | **Legal drafting required** before EU launch | |
| Q-AIF-f | Bias audit infrastructure | **Build before any NYC customer onboards** | |
| Q-AIF-g | "Run analysis" per-user rate limit | **50/day/recruiter** | |

**Total: 75 sub-questions across 11 docs.**

**Default action:** sign off all leans as-is. Use the Override column only for the ones you want to change.

---

## Part 2 — Phase 0 task-by-task spec

Per [`roadmap.md` Phase 0](roadmap.md#phase-0--pre-work-must-happen-before-any-wave-starts), eight items (0.1–0.9, with 0.6 removed and 0.2 / 0.9 already done). Implementation-ready specs for each below.

### 0.1 · Fix Migration 022 trigger bug

**Status:** P1 standalone — fixable today, independent of redesign.

**Problem:** [`scripts/022_candidate_status_sync_trigger.sql`](../../scripts/022_candidate_status_sync_trigger.sql) syncs `candidates.general_status_id` when all applications close. It looks for `candidate_statuses.code = 'inactive'`, but [Migration 009](../../scripts/009_simplify_candidate_statuses.sql) simplified to `'active' | 'hired' | 'archived'`. The trigger is silently a no-op.

**Fix:** New migration that replaces `'inactive'` with `'archived'`. The trigger correctly sets candidates to `archived` when all applications are closed (rejected/withdrawn — `hired` is handled separately by the trigger).

```sql
-- scripts/056_fix_candidate_status_sync_trigger.sql
-- Fix Migration 022 — looked for non-existent 'inactive' code that Migration 009 removed.
-- Replace with 'archived'.

CREATE OR REPLACE FUNCTION sync_candidate_status_on_application_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_org_id        UUID;
  v_candidate_id  UUID;
  v_open_count    INT;
  v_archived_status_id UUID;
BEGIN
  v_org_id       := COALESCE(NEW.organization_id, OLD.organization_id);
  v_candidate_id := COALESCE(NEW.candidate_id, OLD.candidate_id);

  -- Count applications still in an "active pipeline" state
  SELECT COUNT(*) INTO v_open_count
  FROM applications a
  JOIN application_statuses s ON a.status_id = s.id
  WHERE a.candidate_id    = v_candidate_id
    AND a.organization_id = v_org_id
    AND a.deleted_at IS NULL
    AND s.code NOT IN ('rejected', 'withdrawn', 'hired');

  -- If no active applications remain, mark candidate as archived
  IF v_open_count = 0 THEN
    SELECT id INTO v_archived_status_id
    FROM candidate_statuses
    WHERE code = 'archived'
    LIMIT 1;

    IF v_archived_status_id IS NOT NULL THEN
      UPDATE candidates
      SET general_status_id = v_archived_status_id
      WHERE id            = v_candidate_id
        AND organization_id = v_org_id
        AND deleted_at IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END $$;
```

**Apply to:** staging + production Supabase projects (same as past migrations).

**Test:** Insert candidate + application; close all candidate's applications via rejection/withdrawal; verify `candidates.general_status_id` becomes `archived`.

**Effort:** S. Single migration + 1 unit test.

### 0.3 · Reconcile G-022 → G-032 features with redesign

**Status:** Substantial sweep. 11 shipped features need their home identified in the new IA.

**Output:** A small reconciliation table (could live in audit appendix). For each shipped feature, identify the new redesign surface it lives on.

| Feature | Today | New IA home |
|---|---|---|
| G-021 @-mentions in notes | candidate profile notes composer | S02 Activity feed (unchanged) |
| G-022 self-withdraw on status page | `/status/[token]` button | S05 §2.3 status page (preserved) |
| G-023 cmd-K global search | topbar | S01 topbar (preserved) — note global Pipeline header gets the same |
| G-024 bulk move-to-stage | vacancy → Candidates tab | **Moves to S01 Pipeline** (Candidates tab is removed per Q9) |
| G-025 scorecard share `/scorecard/[token]` | recruiter generates from candidate profile | S02 §2.5 Interview-stage block "Share scorecard" action (preserved; greenfield per Q14) |
| G-026 saved filter views | candidates + vacancies list | **Preserved + extended** with `'pipeline'` list_kind per S01 §5.1 |
| G-028 CSV import `/candidates/import` | admin-only wizard | **Preserved** — top-level admin route. Add link in S01 Pipeline empty state? (no — empty state is "create vacancy first") |
| G-029 Reports | `/reports/*` | S08 — preserved + custom-stages funnel adaptation |
| G-030 Slack/Teams webhooks | `/settings/integrations/webhooks` | S07 §2.9 — preserved under Hiring workflow → Integrations |
| G-031 Calendly | `/settings/integrations/calendly` | Same |
| G-032 2FA | per-user (Profile) + org policy (Organization) | S07 — Per-user moves to **Security**; org policy **stays at Organization** per Q8 |

**Effort:** S. One table; commit as an appendix to `audit.md`.

### 0.4 · Pick canonical screen files; archive drafts

**Status:** Filesystem hygiene. The audit identified exploratory drafts that should be moved to a `_drafts/` subdirectory so implementers don't open them by mistake.

**Files to move to `redesign/_drafts/`:**
- `Pipeline Directions.dc.html` (superseded by `Pipeline Versions.dc.html`)
- `Candidate Profile Directions.dc.html`
- `Candidate Profile Versions.dc.html`
- `Candidate Profile Detailed.dc.html`
- `Create Flows.dc.html` (superseded by S4d's two files)

**Files staying in `redesign/`** (canonical):
- All 11 specs S1–S11 per [`audit.md` Appendix A](audit.md#appendix-a--files-extracted-to-redesign)
- Plus `Pipeline Empty State.dc.html` (added by founder 2026-06-16)

**Effort:** S. Single `mv` operation + README update inside `redesign/`.

### 0.5 · Custom-stages schema design spike

**Status:** Schema work for Wave 2.6, deepened beyond the [`roadmap.md` 2.6](roadmap.md#26-✏️-revise-·-custom-stages-per-vacancy) sketch.

**Final schema:**

```sql
-- scripts/057_pipeline_stages.sql
-- Wave 2.6 — per-vacancy custom stages. Greenfield (no migration per Q14).

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vacancy_id UUID NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('standard', 'interview', 'offer', 'review')),
  sort_order INTEGER NOT NULL,
  is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cap at 10 stages per vacancy (Q3 lock) enforced via check trigger
CREATE OR REPLACE FUNCTION enforce_pipeline_stages_cap()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.pipeline_stages
      WHERE vacancy_id = NEW.vacancy_id) >= 10 THEN
    RAISE EXCEPTION 'Pipeline stages capped at 10 per vacancy';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER pipeline_stages_cap_trigger
BEFORE INSERT ON public.pipeline_stages
FOR EACH ROW EXECUTE FUNCTION enforce_pipeline_stages_cap();

CREATE UNIQUE INDEX uq_pipeline_stages_vacancy_sort
  ON public.pipeline_stages (vacancy_id, sort_order);

CREATE INDEX idx_pipeline_stages_vacancy
  ON public.pipeline_stages (vacancy_id);

CREATE INDEX idx_pipeline_stages_org
  ON public.pipeline_stages (organization_id);

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pipeline_stages in their org"
  ON public.pipeline_stages FOR SELECT
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage pipeline_stages"
  ON public.pipeline_stages FOR ALL
  USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('owner', 'admin')
  );
```

**Then add per-application FK:**

```sql
-- Replace applications.status_id (FK to global application_statuses)
-- with pipeline_stage_id (FK to per-vacancy pipeline_stages).
-- Greenfield: no data migration needed.

ALTER TABLE public.applications
  DROP COLUMN status_id,
  ADD COLUMN pipeline_stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id);

CREATE INDEX idx_applications_pipeline_stage
  ON public.applications (pipeline_stage_id);
```

**Default template seeder:**

```sql
-- When a new vacancy is created, seed 7 default stages
-- (matches the legacy global stages so the default UX is unchanged).
-- Call from createVacancy() server action.

CREATE OR REPLACE FUNCTION seed_default_pipeline_stages(p_vacancy_id UUID, p_org_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.pipeline_stages (organization_id, vacancy_id, name, type, sort_order, is_terminal) VALUES
    (p_org_id, p_vacancy_id, 'Applied',    'standard', 1, FALSE),
    (p_org_id, p_vacancy_id, 'Screening',  'review',   2, FALSE),
    (p_org_id, p_vacancy_id, 'Interview',  'interview',3, FALSE),
    (p_org_id, p_vacancy_id, 'Offer',      'offer',    4, FALSE),
    (p_org_id, p_vacancy_id, 'Hired',      'standard', 5, TRUE),
    (p_org_id, p_vacancy_id, 'Rejected',   'standard', 6, TRUE),
    (p_org_id, p_vacancy_id, 'Withdrawn',  'standard', 7, TRUE);
END $$;
```

**Callsite map** (every place `applications.status_id` is read or written):

- `app/(dashboard)/vacancies/[id]/page.tsx` — filter applications by status_id; **change to filter by pipeline_stage_id**
- `app/(dashboard)/vacancies/[id]/pipeline/page.tsx` — group by status; **change to group by pipeline_stage_id**
- `components/pipeline/kanban-board.tsx` — drag-drop calls `updateApplicationStatus(id, statusId)`; **change to `updateApplicationStage(id, stageId)`**
- `lib/actions/applications.ts` — every function reading `status_id`
- `lib/cache/lookups.ts::getApplicationStatuses()` — **retire** (no global statuses); replace with `getPipelineStages(vacancyId)`
- `lib/reports/queries.ts` + `lib/reports/funnel.ts` — bucket-mapping per S08 §2.4
- `app/(dashboard)/dashboard/page.tsx` — drop per Q5
- `app/(dashboard)/candidates/page.tsx` — uses application status indirectly; verify
- `components/candidates/candidate-applications-list.tsx` — application status badge; verify
- `app/status/[token]/page.tsx` — `statusCodeToBucket` mapping; **adapt** to read `pipeline_stages.type` instead

About ~20 call sites total. Greenfield helps — no compat layer needed.

**Effort:** S for design (above is the design). Implementation of the schema + callsites is M (Wave 2.6 line item).

### 0.7 · Notifications + Security sub-page field-list spec

**Status:** Notifications was open in audit §4.10; Security was locked (Q8). Both have field lists in S07 §2.4 + §2.5. No additional spec needed — those sections are the spec.

**Action:** None. Already done as part of S07.

### 0.8 · Legal consult on AI Fit Analysis six guardrails

**Status:** External work. Action: book a 2-hour structured review with an EU AI Act specialist (~€1500–3000 per `ai-fit-analysis.md` §7).

**Candidate firms** (from `ai-fit-analysis.md` recommendation):
- Algorithm Watch
- Bird & Bird's AI practice
- IT-Recht Kanzlei (Munich)
- Wilson Sonsini's EU AI Act group

**Deliverable from the consult:**
- Sign-off (or modifications) on the six guardrails
- Confirmation that strict-advisory framing is defensible under Annex III
- GDPR Article 22 sign-off on the human-in-the-loop model

**Effort:** External — 2 hours of expert time + 2 weeks elapsed for scheduling.

### 0.9 · Pipeline empty state design

**Status:** ✅ Done 2026-06-16 — `redesign/Pipeline Empty State.dc.html` exists.

---

## Part 3 — Phase 0 dependencies + recommended sequence

```
0.1 trigger fix           ─── independent, do first ──────┐
                                                            │
0.4 file cleanup          ─── do anytime ─────────────────┤
                                                            │
0.3 G-022→G-032 reconcile ─── do anytime ─────────────────┤   ┌─→ Wave 1
                                                            ├─→│
0.5 custom-stages schema  ─── design done; impl in Wave 2.6 │   └─→ Wave 2 (2.6+)
                                                            │
0.7 Notifications spec    ─── ✅ done in S07              ─┤
                                                            │
0.8 Legal consult ─── book ─→ wait ─→ confirm guardrails ──┘
                                              │
                                              ↓
                                         Wave 3.1 unblocked
```

**Recommended Phase 0 order:**

1. **Today** (1 hour): 0.4 file cleanup, 0.3 reconciliation table commit
2. **This week** (S effort): 0.1 trigger fix migration + test
3. **This week** (book it): 0.8 reach out to legal consult firm
4. **Wave 2.6 prep** (~when starting): 0.5 schema migrations from spec above

Phase 0 completes in ~1–2 weeks elapsed for the in-house items, plus 2–4 weeks for the legal consult to land.

---

## Part 4 — Wave 1 ready-to-start checklist

When Phase 0 is done, Wave 1 items can start in parallel:

- [ ] **Wave 1.1 derived status** — depends on 0.1 ✓. Removes `CandidateStatusSelect`; trigger now correct.
- [ ] **Wave 1.2 Settings 4-group regroup** — `/settings/notifications` + `/settings/security` + `/settings/billing` (consolidated). Plus Settings nav refactor.
- [ ] **Wave 1.3 trial pill** — header pill + remove "Trial · Trial" redundancy.
- [ ] **Wave 1.4' drop Dashboard hiring-rate tile** — one-line change pending Q5 dashboard drop.
- [ ] **Wave 1.5 terminology sweep** — multi-file UI string sweep per S10 terminology rules.
- [ ] **Wave 1.6 AI reframing** — build `<AiDraftPanel />` + `<AiDraftTag />`; wrap 5 AI surfaces.
- [ ] **Wave 1.7 (was DROPPED — moved to Wave 2)** Interview scheduling UX nudge — sequence after S09 design lock.
- [ ] **Wave 1.8 ADD** — file cleanup ✓ from 0.4.

Wave 1 is mostly cosmetic / IA work — ~3-4 weeks elapsed; parallelizable.

---

## Part 5 — Risks + watch items

These aren't bugs in the design — they're things to monitor during implementation.

| Risk | Why it's a risk | Mitigation |
|---|---|---|
| Wave 2.6 custom stages touches `~20` files | Big surface; easy to miss a callsite | Use `grep -rn 'status_id' --include='*.ts' --include='*.tsx'` checklist; aim for 100% coverage before merge |
| Wave 2.1 Global Pipeline perf at 1000+ apps | Virtualization is the critical perf engineering | Test at 1000+ before merge; have hard pagination as fallback |
| AI Fit Analysis blocked on legal consult | Could delay Wave 3.1 by months | Sequence: book consult Week 1; Wave 3.1 begins after sign-off |
| Terminology sweep miss | Hard to verify exhaustively | Use `docs/ui-texts.md` as the single source; grep for forbidden terms ("Job", "General Status", "Incomplete") |
| Greenfield + clean of customer data | The whole redesign assumes Q14 clean | Confirm no production customer is using HRHandle pre-launch (per user statement); if any exist, this assumption blows up |
| New Q3 stage `type` enum changes mid-flight | Could break candidate profile contextual block | Add `type` to `pipeline_stages` as NOT NULL CHECK constraint; warning modal on type-change (Q-S04-a) |

---

## Part 6 — When Phase 0 is done

After every Phase 0 item is shipped or scheduled:

1. **Tag the repo** with `redesign-phase-0-complete`
2. **Sign off this document** — mark the override column for any overrides
3. **Start Wave 1** with [`roadmap.md` Wave 1 sequence](roadmap.md#wave-1--quick-structural-wins)
4. **Set a weekly check-in** — Phase 9 (tech debt) + Phase 10 (billing) from your product roadmap coordinate with redesign Waves 2.4 + 2.7 specifically; agree on sequence

---

## Bookend

This document is the bridge from design to implementation. Beyond it:
- Code changes live in PRs against the `staging` branch
- Doc updates flow into [`docs/claude-code-workflow.md`](../claude-code-workflow.md) Phase 5 verification per task
- Each Wave's completion gets a brief retro added to [`docs/8-decisions.md`](../8-decisions.md)
- The redesign corpus stays as the source of truth — when reality diverges from spec during implementation, update the relevant flow doc rather than letting it drift silently

When all waves ship, the redesign is complete. Until then, this corpus + roadmap is the single source of truth.
