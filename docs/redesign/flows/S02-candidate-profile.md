# S2 · Candidate profile — flow analysis

> **Status:** Draft 1, authored 2026-06-17. Built against the user-uploaded `Candidate Profile A Refined.dc.html` (refined Version 1, top-bar layout).
>
> **Sources:** [`Candidate Profile A Refined.dc.html`](../../../redesign/Candidate%20Profile%20A%20Refined.dc.html), [`audit.md` §4.2](../audit.md#42-·-s2-·-candidate-profile-candidate-profile-a-refineddchtml), [`roadmap.md` Wave 2.3](../roadmap.md). Mobile: [`mobile/candidate-profile.md`](../mobile/candidate-profile.md).
>
> **Why this is fourth.** Candidate profile is the daily-driver decision surface — every advance, reject, schedule, offer happens here. Wave 2.3 rebuild + Q10 Merge flow + Q11 banner threshold + Q12 screening gate (folded into stage move) all land on this page. The audit's claim that ~70% of the structure already exists holds — this is a refactor with three meaningful additions (active-application selector, stage-contextual block, repeat-applicant banner) and one new flow (Merge).

---

## 1. Current implementation

### Route

[`app/(dashboard)/candidates/[id]/page.tsx`](../../../app/(dashboard)/candidates/[id]/page.tsx) — 589 lines.

### Layout today

Two-column grid (1fr / 400px right rail) defined at [line 434](../../../app/(dashboard)/candidates/[id]/page.tsx#L434). Sticky right rail at [line 511](../../../app/(dashboard)/candidates/[id]/page.tsx#L511).

**Header** ([line 376](../../../app/(dashboard)/candidates/[id]/page.tsx#L376)):
- Back arrow + avatar + name + `StatusPill` (current general status) + headline experience line
- Right cluster: `CandidateStatusSelect` (editable dropdown — **to be removed per Q1**) + `DeleteCandidateButton` + Edit button

**Summary strip** ([line 424](../../../app/(dashboard)/candidates/[id]/page.tsx#L424)) — horizontal chips: location, timezone, languages, salary expectation, notice period, years experience.

**Left column** ([line 437](../../../app/(dashboard)/candidates/[id]/page.tsx#L437)):
1. `AiSummaryPanel` — on-demand AI summary
2. "Applied vacancies" card with `AddApplicationDialog` + `CandidateApplicationsList` — every application listed with status, evaluation, offers
3. `ExperienceSection`
4. `EducationSection`
5. Custom fields display (if any)
6. `ActivityFeed` — composer + activity timeline

**Right rail** ([line 511](../../../app/(dashboard)/candidates/[id]/page.tsx#L511)):
1. `AiNotesExtractor` — "Structure interview notes" AI
2. `ContactCard`
3. `CandidateDocuments`
4. Interviews list (latest 3)
5. `MetadataFooter` — source, dates, metadata

### Components in scope

| Component | Path | Lines | Reuse fate |
|---|---|---|---|
| `CandidateStatusSelect` | [`components/candidates/candidate-status-select.tsx`](../../../components/candidates/candidate-status-select.tsx) | 113 | **DELETE** per Q1 — status is now derived |
| `SummaryStrip` | [`components/candidates/summary-strip.tsx`](../../../components/candidates/summary-strip.tsx) | 46 | KEEP — unchanged |
| `ContactCard` | [`components/candidates/contact-card.tsx`](../../../components/candidates/contact-card.tsx) | 109 | KEEP — unchanged |
| `MetadataFooter` | [`components/candidates/metadata-footer.tsx`](../../../components/candidates/metadata-footer.tsx) | 38 | KEEP — unchanged |
| `CandidateDocuments` | [`components/candidates/candidate-documents.tsx`](../../../components/candidates/candidate-documents.tsx) | 208 | KEEP — unchanged |
| `AddApplicationDialog` | [`components/candidates/add-application-dialog.tsx`](../../../components/candidates/add-application-dialog.tsx) | 124 | KEEP — moves to header as "Add to vacancy" action |
| `CandidateApplicationsList` | [`components/candidates/candidate-applications-list.tsx`](../../../components/candidates/candidate-applications-list.tsx) | 109 | RESTRUCTURE — splits into ActiveApplicationSelector + ApplicationHistoryTable + StageContextualBlock |
| `ApplicationEvaluation` | [`components/candidates/application-evaluation.tsx`](../../../components/candidates/application-evaluation.tsx) | 449 | REBUILD per Q14 scorecard greenfield + Q12 screening gate folded |
| `ExperienceSection` | [`components/candidates/experience-section.tsx`](../../../components/candidates/experience-section.tsx) | 263 | KEEP — unchanged (add "Show N more" collapse) |
| `EducationSection` | [`components/candidates/education-section.tsx`](../../../components/candidates/education-section.tsx) | 281 | KEEP — unchanged |
| `ActivityFeed` | [`components/candidates/activity-feed.tsx`](../../../components/candidates/activity-feed.tsx) | 277 | KEEP — already has @mentions (G-021) |
| `AiSummaryPanel` | [`components/candidates/ai-summary-panel.tsx`](../../../components/candidates/ai-summary-panel.tsx) | 194 | KEEP — restyle to S10 calm; moves to right rail |
| `AiNotesExtractor` | [`components/candidates/ai-notes-extractor.tsx`](../../../components/candidates/ai-notes-extractor.tsx) | 405 | KEEP — restyle; folds into a single "AI tools ✨" action sheet alongside AiSummaryPanel per right rail consolidation |
| `DeleteCandidateButton` | [`components/candidates/delete-candidate-button.tsx`](../../../components/candidates/delete-candidate-button.tsx) | 40 | KEEP — moves into header `⋯` menu |
| `CustomFieldsDisplay` | shared | — | KEEP — moves to right rail (DETAILS section) |
| `OfferPanel` | `components/offers/` (referenced) | — | KEEP — moves into Offer-stage contextual block |

### Server actions touched

| Action | Use | Change |
|---|---|---|
| `updateApplicationStatus(id, statusId)` | Stage move via Advance/Reject buttons | Unchanged. Powers the Q12 folded-screening pattern. |
| `rejectApplication(...)` | Reject from contextual block | Unchanged. |
| Candidate fetch query | Server component | Add: count of closed applications (for Q11 banner threshold), application history join, vacancy pipeline_stages join (per S04 Wave 2.6) |

### DB tables read

`candidates`, `applications`, `vacancies`, `pipeline_stages` (post Wave 2.6), `candidate_experience`, `candidate_education`, `candidate_documents`, `candidate_evaluations`, `candidate_evaluation_answers`, `vacancy_questions`, `interviews`, `offers`, `candidate_activity`, `rejection_reasons`, `rejection_templates`, `custom_field_*`.

---

## 2. Proposed redesign

### 2.1 Header (locked from upload)

```
┌────────────────────────────────────────────────────────────────────────┐
│ [AM] Aleksandre Merabishvili  [Active · 1 live application]            │
│      Senior Business Analyst at Space Neobank · Tbilisi · 12y · langs  │
│                                                                         │
│                          [Edit]  [+ Add to vacancy]  [⋯]               │
└────────────────────────────────────────────────────────────────────────┘
```

**Changes vs today:**
- Status pill is **derived** (read-only) — no editable dropdown. The pill reads "Active · N live applications" / "Hired (Role)" / "Archived".
- **`[+ Add to vacancy]`** is a primary header action — lifted from the current "Applied vacancies" card's add button.
- **`[⋯]` menu** consolidates: Archive · Delete · Export · **Merge** (Q10) — Merge is the new entry point.

### 2.2 Repeat-applicant banner (Q11 locked: 3+ rejections)

Shown only when the candidate has **3 or more** previously-closed applications (rejected or withdrawn). Amber `⟲` icon + text:

```
┌────────────────────────────────────────────────────────────────────────┐
│ ⟲  Repeat applicant. Applied to 10 previous roles here — 8 rejected,   │
│    2 withdrawn. Most recent: HR Coordinator, rejected 2mo ago          │
│    (reason: regulatory).                          [View history ⤵]     │
└────────────────────────────────────────────────────────────────────────┘
```

- Counts come from `applications` where `status IN ('rejected', 'withdrawn')` for this candidate.
- "Most recent" pulls the latest closed application with its rejection_reason name.
- "View history ⤵" expands the Application history table below (or scrolls to it).
- **Hide entirely** when count < 3.

### 2.3 Active-application selector

```
                                                                          
  ACTIVE APPLICATION                                                      
  ┌─[Senior Business Analyst] [Screening]┐                               
  └──────────────────────────────────────┘  Only live applications appear  
                                            here. Closed ones live in     
                                            History above.                
```

**The single source of truth.** Whatever's selected here drives:
- The pipeline tracker
- The stage-contextual block
- The right rail Actions buttons
- The per-application ⋯ menu (Copy public status link / Remove from vacancy)

**Behavior:**
- Shows only **live** applications (status not in `rejected`, `withdrawn`, `hired`).
- If only 1 live application: rendered as a label, not a picker (no need to switch).
- If multiple: dropdown picker; chevron + state pill summarizes selected.
- If 0 live applications: selector shows "No live applications" + Add-to-vacancy CTA. Page falls back to candidate-level view (no per-app contextual block).
- Persists selection in URL: `?app=<applicationId>` for deep-linking.

### 2.4 Pipeline tracker (compact horizontal)

Below the selector. Shows the per-vacancy pipeline stages (via `pipeline_stages` table, per S04 Wave 2.6) as small connected chips:

```
[Applied]━━[Screening]━━[Interview]┄┄[Offer]┄┄[Hired]
   ✓        ●(current)
```

- Past stages = filled green with check
- Current stage = highlighted with stage color, ring
- Future stages = outlined neutral
- Terminal stages (Rejected / Withdrawn) — shown only if the application is in one; otherwise hidden
- Click a stage = moves the application (Q12: this **is** the screening decision — folded into stage move)

### 2.5 Stage-contextual block (the new construct)

**Swaps based on the current stage's `pipeline_stages.type`:**

#### Type = `standard` (e.g., Applied, Hired)

Minimal block. Shows just headline copy:
- Applied: "Newly applied. Review the CV and screening checks below, then Advance or Reject."
- Hired: success card with hire date + role + "View offer" link

#### Type = `review` (Screening — Q12 folded)

"Screening checks · auto-flagged from the apply form" card. Read-only context, **no Yes/No control**.

- "All clear" badge (green) if all knockout/must-have checks pass, else "Needs review" amber
- Helper text (verbatim from design): *"No manual yes/no here — to screen in, **Advance**; to screen out, **Reject** (right). The full **Scorecard** (1–5) appears at the Interview stage."*
- Each knockout/must-have check rendered as a small tile:
  - Salary fit (e.g. "$4.5k ≤ $5k budget" + check)
  - Work eligibility (e.g. "GE citizen ✓")
  - Notice period (e.g. "1 month ✓")
- The actual decision = Advance / Reject buttons in the right rail. Q12 locked.

#### Type = `interview` (Interview stages — including multi-round HR/Tech/Final)

Interview-toolkit block. Per-round:

```
┌───────────────────────────────────────────────────┐
│ 🎥 Video interview              Tomorrow 14:00     │
│ 60 min · with you                         [Join]   │
└───────────────────────────────────────────────────┘
[Add full scorecard]  [Reschedule]

This is where the full 1–5 scorecard lives —
fillable once the interview is marked complete.
Its average becomes the fit score.
```

- Shows the most recent scheduled interview for this application + stage
- **Scorecard** is per-interview-round, anti-anchoring (per Wave 2.5 spec)
- "Add full scorecard" opens an inline modal: attribute grid (1–5) + forced recommendation (Strong yes / Yes / Lean no / No) + required reason
- If no interview scheduled yet: "[Schedule interview]" CTA + helper text "Set up the interview before adding a scorecard."
- Past rounds collapse to a small summary list above the current round (avg score + recommendation per past round)

#### Type = `offer`

Create-offer form OR existing-offer status:

If no offer exists for this application yet:
```
┌───────────────────────────────────────────────────┐
│ Create offer · Senior Business Analyst             │
│ Compensation: [5,000 / mo]     Currency: [USD]    │
│ Start date:   [Jul 1, 2026]    Respond by: [...]  │
│ Offer details: [Benefits, equity, …]              │
│ [Save & send]  [Save draft]      Sends accept-     │
│                                  decline link     │
└───────────────────────────────────────────────────┘
```

- Reuses `OfferPanel` component (currently inside `CandidateApplicationsList`).
- "Save & send" generates a `public_token`, marks `status = 'sent'`, sends email with `/offer/[token]` link.

If offer exists: render the offer status (sent/accepted/declined/expired/withdrawn) per `app/offer/[token]/page.tsx` patterns + actions: Withdraw / Resend / Mark as accepted manually.

### 2.6 Left column structure (final)

After the contextual block:

1. **Application tracker + stage-contextual block** (above)
2. **Experience** (compact) — "5 roles · 12y", first role expanded, "Show 4 more roles" link
3. **Education** + **Notes & activity** — side-by-side compact in two flex columns

Per-application `⋯` menu (on the active-application selector card) = Copy public status link / Remove from vacancy.

### 2.7 Right rail structure (final)

```
ACTIONS
[Advance to Interview →]
[Schedule] [Email] [Reject]

✨ AI summary                          [Generate]

DOCUMENTS                              + Upload
  📄 CV_Merabishvili.pdf · 217 KB · 4d ago  [Open]

DETAILS
  Salary expectation        $4,500 / mo
  Notice period             1 month
  Location                  Tbilisi, GE
  Timezone                  GMT+4
  Source                    LinkedIn
  Added                     Jun 8, 2026

CONTACT
  Email                     alex@gmail.com
  Phone                     +995 599 89 29 17
  LinkedIn                  View profile

CUSTOM FIELDS
  Referred by               Nino (internal)
  Work eligibility          GE citizen
```

**Changes vs today:**
- AI summary collapsed by default with explicit "Generate" — per S10 calm pattern
- AI notes extractor folds into AI summary panel (one "AI tools" surface; expanding shows both actions)
- DETAILS section added — pulls fields previously only on the candidate edit page into a read view
- CONTACT moved below DETAILS (today it's above — design swaps for thumb-reach on tablet)
- Interviews list **removed from right rail** — now lives in the stage-contextual block per application
- MetadataFooter merged into DETAILS — no separate footer card

### 2.8 Application history (collapsible table)

Shown when "View history" expanded from the repeat-applicant banner (or always visible at page bottom if banner doesn't fire but closed applications exist):

```
┌─ Application history ──────────────────────────────────────────────┐
│ 10 closed · 8 rejected · 2 withdrawn                                │
├─────────────────────────────────────────────────────────────────────┤
│ HR Coordinator        [Rejected]  Reason: regulatory               │
│                                              2mo ago · reached Interview │
│ Product Analyst       [Withdrawn] Candidate withdrew              │
│                                              4mo ago · reached Screening │
│ Business Analyst (Jr) [Rejected]  Reason: experience              │
│                                              5mo ago · reached Applied │
│                          [Show all 10]                             │
└─────────────────────────────────────────────────────────────────────┘
```

- Sorted by closed date desc
- Each row: vacancy title · status badge · reason · "X ago · reached [stage]"
- Click row → opens that application's full evaluation (read-only modal)

### 2.9 Merge candidates flow (Q10 locked spec)

**Triggers:**
1. Header `⋯` menu → "Merge with another candidate…"
2. Duplicate-detection banner on Add Candidate Step 3 → "Review & merge" link (per S04d)

**3-step confirm dialog:**

```
Step 1 — Pick the duplicate
  [🔍 Search candidates...]
  Recent / suggested:
    • Aleksandre Merabishvili (alex@personal.com) — 3 apps
    • A. Merabishvili (a.merab@work.com)         — 2 apps

Step 2 — Choose surviving record + resolve conflicts
  Choose which record survives:
    ⦿ This candidate (alex@gmail.com, 1 active app)
    ○ Other candidate (alex@personal.com, 3 closed apps)

  Resolve conflicting fields:
    Field          | Keep                | Other            | Pick
    Name           | Aleksandre Merab.   | A. Merabishvili  | (●) (○)
    Email          | alex@gmail.com      | alex@personal..  | (●) (○)
    Phone          | +995 599 89 29 17   | (empty)          | (auto)
    Location       | Tbilisi, GE         | (empty)          | (auto)
    LinkedIn       | (empty)             | linkedin.com/…   | (○) (●)

  Combined automatically (union):
    Applications:    1 active + 3 closed = 4
    Notes:           5 + 2 = 7
    Activity:        12 + 8 = 20 entries
    Documents:       2 + 1 = 3
    Interviews:      2 + 0 = 2
    Scorecards:      1 + 0 = 1

  Same-vacancy collision:
    Both records applied to "Senior BA". Keeping the most-advanced
    application (the one currently at Screening). The other will be
    archived with a "merged from duplicate" note.

Step 3 — Confirm
  This action cannot be undone (but the merge is logged in the audit log).
  Old candidate page URLs will redirect to this one.
  [Cancel]                                              [Merge candidates]
```

**Merge rules** (locked from Q10):
- **Always combined (union):** applications, notes, activity, documents, interviews, scorecards
- **Chosen one wins (with default to most recent):** name, primary email, phone, location, LinkedIn, custom field values
- **Same-vacancy collision:** keep the application furthest along by stage `sort_order`; archive the other with note `merged_from_duplicate: <candidate_id>`
- **Audit log entry:** `merged_candidate` event with from/to IDs + chosen field map
- **Redirects:** old `/candidates/<merged_from_id>` returns 301 to `/candidates/<surviving_id>` (recoverable in the audit log if ever needed)

---

## 3. Gaps, missing screens, edge cases

### 3.1 Missing screens

| Surface | Why missing | Recommended action |
|---|---|---|
| Empty state (candidate with 0 applications and 0 history) | Not drawn | "Not added to any vacancies yet" + `[+ Add to vacancy]` (existing copy from `CandidateApplicationsList:78`) |
| Stage-contextual block for new "review" type if added later | Spec only covers Screening | If future custom stage type = `review`, render scorecard-only (no scheduling). Same as `interview` minus the schedule UI. |
| Multi-round interview history within a single application | Mentioned ("prior rounds collapse to a summary") but not pixelled | Collapsed accordion: each past round shows date + interviewer + avg score + recommendation |
| Merge dialog with > 2 candidates | Not addressed | Merge 1 pair at a time; recursive merging if the surviving record itself has another duplicate. Show banner: "This candidate may also match alex+third@gmail.com — merge again?" |
| Per-application "⋯" menu when on Screening (the screening-checks block) | Spec covers "Copy public status link / Remove from vacancy" only | Add: "Withdraw on behalf of candidate" (mimics G-022 from internal side) |
| Closed-application read-only state | "Application history" lists them but viewing detail not drawn | Modal that shows the same left-column layout (tracker + stage block + experience snapshot) but all controls disabled with "Closed [date]" banner |
| Hired candidate state | Status pill shows "Hired (Role)" but no contextual UI defined | Header status pill + a slim banner above the page: "Hired into Senior BA on Jul 1, 2026. [View offer details]". Left column shows applications history. Right rail unchanged. |
| Archived candidate state | Similar | Header status pill "Archived" + banner. All write actions disabled. |
| Candidate-self-withdraw notification (G-022) | Not in spec | Activity feed entry with "Candidate withdrew via status page" — already shipped per G-022. Mention in §4 (regression). |
| Merge undo / restore | Q10 says "irreversible-ish" | Document: audit log entry includes the chosen field map; manual SQL recovery possible but no UI. Acceptable per Q10. |

### 3.2 Edge cases

| Case | Today | New |
|---|---|---|
| Candidate has no live applications but isn't Hired/Archived | Status displays "Active" (the seed default) | Status shows "Active · 0 live applications". Active-app selector renders empty state. Page falls back to candidate-only view. |
| Candidate hired in one role + still active in another | Today: `general_status_id = 'hired'` overrides | Display "Hired (Role A) · 1 live application (Role B)" — derived from applications. Both contextual blocks accessible via selector. |
| AI summary generated but stale (CV updated since) | Stale cache shown | Banner: "Summary based on a previous CV upload. [Re-generate]" |
| Custom fields schema changed since candidate created | Renders with available fields | Same. Fields not in current schema render under "Legacy fields" sub-section. |
| Documents over 100 (paginated) | Today not addressed | Show 10 most recent + "Show all" pagination |
| Long candidate name | Wraps in header | Truncate to 1 line with `text-ellipsis`; full name on hover/tap |
| 100+ applications across a long career | All rendered in `CandidateApplicationsList` | History table paginates 20 per page; live applications never paginate (selector dropdown handles it) |

### 3.3 Race conditions

- Two recruiters on the same candidate, one advances stage while the other rejects: optimistic UI on both; the later write wins; the earlier client's stale view re-fetches on next interaction. Acceptable.
- Merge in progress while another user is on the to-be-merged candidate: their page returns the 301 redirect; toast: "This candidate was merged. You're now viewing the surviving record." Acceptable.

---

## 4. Reuse opportunities

| Need | Reuse from | Notes |
|---|---|---|
| Avatar with initials | Inline computation in [`page.tsx:367`](../../../app/(dashboard)/candidates/[id]/page.tsx#L367) | Same |
| Summary strip | `SummaryStrip` | Direct |
| Application tracker | New small component reading `pipeline_stages` for the selected app's vacancy | New, ~30 LOC |
| Screening checks block | New small component | Reads `vacancy_questions` of kind `screening_question` + the candidate's answers from apply form |
| Interview card | New small component | Reads `interviews` filtered to current application + current stage |
| Full scorecard modal | NEW per Wave 2.5 spec | 1–5 grid + forced recommendation radio + required reason textarea + anti-anchoring server filter |
| Create-offer form | `OfferPanel` (existing inside CandidateApplicationsList) | Lift out, render in Offer-stage contextual block |
| Existing-offer status panel | `OfferPanel` view variant | Same component |
| Documents card | `CandidateDocuments` | Direct |
| Right-rail AI surface | `AiSummaryPanel` + `AiNotesExtractor` combined into one "AI tools" panel | Restyle both to S10 calm; consolidate UI shell |
| Contact card | `ContactCard` | Direct |
| Custom fields | `CustomFieldsDisplay` | Direct; render in right rail under DETAILS |
| Experience + Education | `ExperienceSection`, `EducationSection` | Direct; add "Show N more" collapse to Experience |
| Notes composer | Existing inside `ActivityFeed` | Direct |
| Activity timeline | `ActivityFeed` | Direct; already has G-021 @mentions |
| Add application dialog | `AddApplicationDialog` | Direct; moves to header `+ Add to vacancy` |
| Delete candidate | `DeleteCandidateButton` | Direct; moves to header `⋯` menu |
| Header `⋯` menu | DropdownMenu | Standard pattern |
| Merge dialog | NEW | New 3-step component |
| Repeat-applicant banner | NEW | New small component, conditional on 3+ closed count |
| Application history table | NEW | New collapsible table |
| Active-application selector | NEW | New dropdown component bound to URL `?app=` |
| Per-application `⋯` menu | NEW | Standard DropdownMenu |
| Stage-contextual block dispatcher | NEW | Switch on `pipeline_stages.type` → renders one of four sub-components |

**Net new code (no reuse):**
- Application tracker visualization
- Stage-contextual block dispatcher + 4 sub-components (screening / interview / offer / standard)
- Full scorecard modal (Wave 2.5)
- Repeat-applicant banner
- Application history table
- Active-application selector
- Merge candidates dialog (3-step)
- Application history read-only modal

---

## 5. DB / API changes

### 5.1 Schema

Most of S2's schema needs are already covered by Waves 2.5 (scorecard) and 2.6 (pipeline_stages). S2-specific additions:

```sql
-- Per-application "merged from" provenance
ALTER TABLE public.applications
  ADD COLUMN merged_from_candidate_id UUID REFERENCES public.candidates(id);
-- Used when a same-vacancy collision archives the loser.
-- Note: the column points to the ORIGINAL candidate ID (now redirecting).

-- Candidate redirects (for merge URL handling)
CREATE TABLE IF NOT EXISTS public.candidate_merges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  merged_from_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  merged_into_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  field_choices JSONB NOT NULL,            -- which fields kept from which side
  same_vacancy_collisions JSONB,           -- archived applications
  merged_by UUID REFERENCES public.profiles(id),
  merged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (merged_from_id)                  -- one merge per original candidate
);
CREATE INDEX idx_candidate_merges_from ON public.candidate_merges (merged_from_id);
CREATE INDEX idx_candidate_merges_into ON public.candidate_merges (merged_into_id);
```

**Soft-delete of merged candidate:** the `merged_from_id` candidate row is marked `deleted_at = NOW()` and `notes = 'Merged into <other_id>'`. The route handler for `/candidates/[id]` checks `candidate_merges` for a redirect target before returning 404.

### 5.2 Server actions

**New:**

- `lib/actions/merge-candidates.ts`:
  - `findMergeCandidates(currentId, searchTerm?)` — returns potential matches (similar email / similar name) + a small list
  - `previewMerge(fromId, intoId)` — returns conflict diff + combined counts (drives Step 2 UI)
  - `executeMerge(fromId, intoId, fieldChoices)` — atomic transaction:
    1. Lock both candidate rows
    2. Union applications (with same-vacancy collision logic)
    3. Union notes / activity / documents / interviews / scorecards
    4. Apply chosen identity fields to surviving record
    5. Soft-delete source candidate
    6. Insert `candidate_merges` row
    7. Write audit log entry
- `lib/actions/candidate-history.ts::getCandidateHistory(candidateId)` — returns closed applications with vacancy titles + rejection reasons + last-reached-stage

**Modified:**

- Candidate detail server component query — add closed-application count (drives Q11 banner threshold), application history join.
- `updateApplicationStatus` — no signature change; just used more directly from the new Advance / Reject buttons.

### 5.3 Routes

| Route | Status | Action |
|---|---|---|
| `/candidates/[id]` | KEEP | The rebuilt detail page. URL param `?app=<applicationId>` for active-app selection. |
| `/candidates/[id]/edit` | KEEP | Unchanged for v1. Wave 2.7 candidate-form work doesn't touch this. |
| `/candidates/[id]/history` | OPTIONAL NEW | Could host the full history table on its own page if pagination grows. v1: inline only. |
| Redirect from merged candidate | NEW MIDDLEWARE | 301 → surviving candidate ID via `candidate_merges` lookup |

---

## 6. Effort estimate

### 6.1 Wave 2.3 — Candidate profile rebuild

| Task | Effort | Reuse |
|---|---|---|
| Page shell + 2-column layout (existing) | `S` | Lift existing layout |
| Remove `CandidateStatusSelect` from header | `S` | One file delete + reference remove |
| Derived status pill | `S` | Compute from applications: live count + hired role + archived |
| Repeat-applicant banner (3+ threshold) | `S` | New, ~50 LOC |
| Active-application selector | `S` | New dropdown + URL param sync |
| Application tracker | `S` | Reads `pipeline_stages` |
| Stage-contextual block dispatcher | `S` | Switch component |
| Screening contextual sub-block (Q12 folded) | `S` | New, reads vacancy_questions of kind screening_question |
| Interview contextual sub-block | `M` | Interview card + scorecard modal launcher |
| Full scorecard modal (1–5 grid + recommendation + reason) | `M` | Wave 2.5 dep |
| Anti-anchoring server filter for scorecards | `S` | Wave 2.5 dep |
| Offer contextual sub-block | `S` | Lift `OfferPanel` |
| Standard / Hired / Archived contextual sub-blocks | `S` | Small text blocks |
| Application history collapsible table | `S` | New, reads closed applications |
| Per-application `⋯` menu | `S` | DropdownMenu |
| Header `[+ Add to vacancy]` action | `S` | Lift `AddApplicationDialog` |
| Header `⋯` menu (Archive / Delete / Export / Merge) | `S` | DropdownMenu + 4 actions |
| Right rail consolidation | `S` | Move ContactCard, DETAILS section, CustomFieldsDisplay |
| AI tools panel (combine Summary + Notes Extractor) | `S` | Wrap both in one collapsible card |
| Restyle AI surfaces to S10 calm | `S` | Wave 1.6 prerequisite |
| Update server-side query for closed-app count + history | `S` | Add aggregates |

**Wave 2.3 total: ~M-L** (3–4 weeks elapsed). Was originally estimated `L` rebuild; lift-heavy refactor brings it down.

### 6.2 Merge flow (Q10 locked)

| Task | Effort | Reuse |
|---|---|---|
| `candidate_merges` table migration | `S` | None |
| `applications.merged_from_candidate_id` column migration | `S` | None |
| `findMergeCandidates` server action | `S` | New |
| `previewMerge` server action | `M` | Conflict diff + counts logic |
| `executeMerge` server action (atomic transaction) | `M` | Critical correctness path |
| Merge dialog UI (3-step) | `M` | New component |
| 301 redirect middleware for merged candidates | `S` | Middleware addition |
| Audit log entry + activity feed entries | `S` | Reuse `lib/audit-log.ts` |
| Tests — happy path | `S` | New |
| Tests — same-vacancy collision | `S` | New |
| Tests — undo prevention | `S` | New |

**Merge total: ~M** (2 weeks elapsed).

### 6.3 Coordination

- Depends on **Wave 2.5 scorecard** (full scorecard modal in Interview block)
- Depends on **Wave 2.6 pipeline_stages** (application tracker + stage-contextual dispatcher)
- Depends on **Phase 0.1 trigger fix** (derived status display)
- Coordinates with **Wave 2.7 candidate wizard** (duplicate detection links to Merge dialog)
- Coordinates with **S5c Public offer flow** (Offer contextual block uses same `OfferPanel`)

---

## 7. Open questions

### 7.1 RESOLVED via locked decisions

| Question | Status |
|---|---|
| Active-app selector | ✅ Locked design |
| Derived status | ✅ Q1 — remove dropdown, fix trigger (Phase 0.1) |
| Repeat-applicant banner threshold | ✅ Q11 → 3+ |
| Screening manual gate | ✅ Q12 → folded into Advance/Reject |
| Scorecard scale + greenfield | ✅ Q14 + Wave 2.5 |
| Candidate Merge | ✅ Q10 → full spec locked |
| Stage types in contextual block | ✅ Q3 → standard / interview / offer / review enum |

### 7.2 NEW — surfaced by this analysis

- **Q-S2-a:** Should the **active-application selector hide entirely when only 1 live application exists**, or always render as a labeled chip for consistency? *Lean: hide when 1* — saves vertical space; helper text shifts to inline on the tracker card.
- **Q-S2-b:** **Multi-round interview history within one application** — collapsed accordion in the Interview contextual block, or a separate "Round history" tab on the candidate profile? *Lean: collapsed accordion* — fits the contextual-block pattern; tab adds nav weight.
- **Q-S2-c:** **AI summary regeneration policy** — auto-invalidate when CV is re-uploaded, or always show stale-with-banner? *Lean: stale-with-banner* — explicit user action ("Re-generate") matches S10's "AI never auto-applies" rule.
- **Q-S2-d:** **Merge dialog "search candidates" Step 1** — surface name-similarity / email-similarity matches automatically, or pure manual search? *Lean: hybrid* — manual search is the primary, but if the candidate has a flagged duplicate from the wizard, that match is pinned at top with a "Suggested duplicate" badge.
- **Q-S2-e:** **Hired-state candidate** — should the profile become read-only after Hire, or remain editable for follow-up actions (e.g., recruiter wants to update LinkedIn URL after hire)? *Lean: stay editable* — recruiters genuinely update post-hire facts; banner makes hire status clear.
- **Q-S2-f:** **Application history modal vs in-page expansion** — when viewing a closed application's evaluation from the history table, modal overlay or expand-in-place? *Lean: modal* — preserves scroll position on the main page; closer to read-only "inspection" intent.
- **Q-S2-g:** **Per-application Withdraw-on-behalf** — should recruiters be able to withdraw an application internally without the candidate's self-action? Today only candidate can withdraw via G-022. *Lean: add* — sometimes the candidate signals withdrawal via email/phone and the recruiter records it. Reuses existing `withdrawn` status with new audit-log nuance ("withdrawn by recruiter on behalf of candidate").
- **Q-S2-h:** **Right rail order — DETAILS vs CONTACT first?** Design has DETAILS first, CONTACT second. Pre-redesign convention has CONTACT first. *Lean: follow design (DETAILS first)* — most-used fields surface higher.

---

## 8. Test plan

### 8.1 Functional

- [ ] Profile renders for candidate with 1 live application
- [ ] Profile renders for candidate with multiple live applications + selector dropdown
- [ ] Profile renders for candidate with 0 live applications (empty contextual block, history-only view)
- [ ] Profile renders for Hired candidate (banner + read-only-ish state per Q-S2-e)
- [ ] Profile renders for Archived candidate
- [ ] Derived status pill computes correctly (Active · N live / Hired (Role) / Archived)
- [ ] Repeat-applicant banner appears when closed-app count ≥ 3
- [ ] Repeat-applicant banner hides when count < 3
- [ ] Active-app selector switches contextual block + tracker + actions atomically
- [ ] URL `?app=<id>` deep-links to specific application
- [ ] Application tracker shows current + past + future stages
- [ ] Screening contextual block shows knockout/must-have checks
- [ ] Screening block does NOT include manual Yes/No control
- [ ] Advance from Screening moves to next stage via `updateApplicationStatus`
- [ ] Reject opens rejection dialog (existing pattern)
- [ ] Interview block shows scheduled interview + Join link if present
- [ ] Interview block shows "Add full scorecard" modal launcher
- [ ] Scorecard modal enforces forced recommendation + required reason
- [ ] Anti-anchoring: other reviewers' answers hidden until current user submits
- [ ] Offer block shows Create offer form if no offer exists
- [ ] Offer block shows offer status if offer exists
- [ ] Save & send creates offer + token + email
- [ ] Application history table expands from banner click
- [ ] History row click opens read-only application detail (per Q-S2-f)
- [ ] AI tools panel collapsed by default
- [ ] AI summary generates on click + stays expanded
- [ ] AI notes extractor available alongside summary
- [ ] Right rail order: Actions → AI → Documents → DETAILS → CONTACT → CUSTOM FIELDS
- [ ] Header `[+ Add to vacancy]` opens AddApplicationDialog
- [ ] Header `⋯` shows Archive / Delete / Export / Merge
- [ ] Delete candidate works (existing pattern)
- [ ] Merge dialog Step 1 searches + suggests
- [ ] Merge Step 2 shows conflict diff + counts
- [ ] Merge Step 3 confirms + executes atomically
- [ ] Post-merge, source candidate URL 301 → surviving
- [ ] Audit log entry created for merge
- [ ] Same-vacancy collision archives loser with note

### 8.2 Non-functional

- [ ] Page load < 1s on warm cache (300+ apps in history)
- [ ] Application tracker renders < 100ms
- [ ] Merge preview < 500ms
- [ ] Merge execute < 3s (atomic transaction)
- [ ] Mobile layout per [`mobile/candidate-profile.md`](../mobile/candidate-profile.md)

### 8.3 Regression

- [ ] G-021 @-mentions still work in notes composer
- [ ] G-022 self-withdraw events still surface in activity
- [ ] G-025 scorecard sharing still works post-Wave 2.5 rebuild
- [ ] BL-007 candidate-delete cascade still works
- [ ] Soft-deleted candidates redirect to 404 (not the merged-redirect path)
- [ ] Existing notification deep-links to candidate profile still work

---

## 9. Verification

Aligned with [`docs/claude-code-workflow.md`](../../claude-code-workflow.md) Phase 5:

- [ ] All sub-tasks in §6 complete
- [ ] Tests in §8 pass
- [ ] Docs updated:
  - [ ] `docs/3-architecture/frontend.md` — new layout structure
  - [ ] `docs/3-architecture/backend.md` — merge server actions + redirect middleware
  - [ ] `docs/3-architecture/database.md` — `candidate_merges` table, `merged_from_candidate_id` column
  - [ ] `docs/7-api/endpoints.md` — `findMergeCandidates`, `previewMerge`, `executeMerge`, `getCandidateHistory`
  - [ ] `docs/8-decisions.md` — Q-S2-a/b/c/d/e/f/g/h decisions
  - [ ] `docs/ui-texts.md` — new strings (merge dialog steps, banner copy)
- [ ] Ripple check — every consumer of `candidate_status_select` removed
- [ ] Ripple check — every reference to `general_status_id` from the UI side removed (DB column stays)

---

## 10. What to do after reading

1. **Confirm the new Q-S2-a through Q-S2-h** answers (or override).
2. **Decide on Merge timing** — bundle with Wave 2.3 profile rebuild, or sequence as its own follow-up after 2.3 ships? Recommend bundle: the duplicate-detection link in Wave 2.7's candidate wizard needs Merge to land at the same time.
3. **Next flow doc:** S9 Interview scheduling (small, mostly-unblocked) OR S5 Public pages (apply form + status page upgrade) OR S5c Public offer. Recommend **S9 first** — quickest of the three; mostly polishes existing flows. Then S5 + S5c which are public-facing and need careful spec.

---

## Appendix — file inventory for this flow

**New files:**

| File | Purpose |
|---|---|
| `components/candidates/repeat-applicant-banner.tsx` | New (Q11 3+ threshold) |
| `components/candidates/active-application-selector.tsx` | New |
| `components/candidates/application-tracker.tsx` | New (renders per-vacancy `pipeline_stages`) |
| `components/candidates/stage-contextual-block.tsx` | New (dispatcher) |
| `components/candidates/stage-block-screening.tsx` | New (Q12 folded — read-only checks) |
| `components/candidates/stage-block-interview.tsx` | New |
| `components/candidates/stage-block-offer.tsx` | New (wraps `OfferPanel`) |
| `components/candidates/stage-block-standard.tsx` | New |
| `components/candidates/scorecard-modal.tsx` | New (1–5 grid + recommendation + reason; Wave 2.5) |
| `components/candidates/application-history-table.tsx` | New (collapsible) |
| `components/candidates/application-detail-modal.tsx` | New (read-only view of closed app) |
| `components/candidates/merge-candidates-dialog.tsx` | New (3-step Q10 spec) |
| `components/candidates/candidate-ai-tools-panel.tsx` | New (combines summary + notes extractor) |
| `components/candidates/candidate-details-section.tsx` | New (right-rail DETAILS) |
| `lib/actions/merge-candidates.ts` | New |
| `lib/actions/candidate-history.ts` | New |
| `middleware.ts` (or per-page redirect logic) | Add merged-candidate 301 |
| `scripts/050_candidate_merges.sql` | New migration |
| `scripts/051_applications_merged_from.sql` | New migration |

**Modified files:**

| File | Change |
|---|---|
| `app/(dashboard)/candidates/[id]/page.tsx` | Rewrite for new structure; remove `CandidateStatusSelect`; add closed-app count query |
| `components/candidates/candidate-applications-list.tsx` | Splits responsibilities — keeps the list rendering but is reduced; tracker / contextual block lifted out |
| `components/candidates/application-evaluation.tsx` | Rebuild per Wave 2.5 scorecard greenfield |
| `components/candidates/ai-summary-panel.tsx` | Restyle to S10 calm; integrate into `candidate-ai-tools-panel` |
| `components/candidates/ai-notes-extractor.tsx` | Same |

**Deleted files:**

| File | Reason |
|---|---|
| `components/candidates/candidate-status-select.tsx` | Removed per Q1 |

**Retained (touched only via reference):**

| File | Note |
|---|---|
| `SummaryStrip`, `ContactCard`, `MetadataFooter`, `CandidateDocuments`, `ExperienceSection`, `EducationSection`, `ActivityFeed`, `AddApplicationDialog`, `DeleteCandidateButton`, `CustomFieldsDisplay`, `OfferPanel` | All retained as-is or with minor signature changes |

**Docs touched:**
- `docs/3-architecture/frontend.md`
- `docs/3-architecture/backend.md`
- `docs/3-architecture/database.md`
- `docs/7-api/endpoints.md`
- `docs/8-decisions.md`
- `docs/ui-texts.md`

**Tests added:**
- `tests/components/candidates/active-application-selector.test.tsx`
- `tests/components/candidates/stage-contextual-block.test.tsx`
- `tests/components/candidates/scorecard-modal.test.tsx`
- `tests/components/candidates/merge-candidates-dialog.test.tsx`
- `tests/lib/actions/merge-candidates.test.ts` — happy + collision + redirect
- `tests/lib/actions/candidate-history.test.ts`
