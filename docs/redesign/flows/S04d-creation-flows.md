# S4d · Creation flows (vacancy + candidate) — flow analysis

> **Status:** Draft 1, authored 2026-06-17. Built against `Create Vacancy Steps.dc.html` + `Create Candidate Steps.dc.html`. Locked under Q13 (stepped wizard) + Q14 (no migration) + Q1 (kill General Status field).
>
> **Sources:** [`Create Vacancy Steps.dc.html`](../../../redesign/Create%20Vacancy%20Steps.dc.html), [`Create Candidate Steps.dc.html`](../../../redesign/Create%20Candidate%20Steps.dc.html), [`audit.md` §4.6](../audit.md#46-·-s4c-·-s4d-·-creation-flows-create-vacancy-stepsdchtml-create-candidate-stepsdchtml), [`roadmap.md` Wave 2.7](../roadmap.md).
>
> **Why this is third.** Creation flows are how every vacancy and every candidate enters the system. Wave 2.7 rebuild + the schema decisions from S04 (pipeline_stages, no General Status) + the locked S4d wizard structure all converge here. Greenfield helps significantly — these are rewrites, not migrations.

---

## 1. Current implementation

### Routes

| Route | File | Lines | Pattern |
|---|---|---|---|
| `/vacancies/new` | [`app/(dashboard)/vacancies/new/page.tsx`](../../../app/(dashboard)/vacancies/new/page.tsx) | 86 | Server-side data fetch + render `<VacancyForm />` |
| `/candidates/new` | [`app/(dashboard)/candidates/new/page.tsx`](../../../app/(dashboard)/candidates/new/page.tsx) | 83 | Server-side data fetch + render `<CandidateForm />` |

### Form components (the actual work)

| Component | File | Lines | Notes |
|---|---|---|---|
| `VacancyForm` | [`components/vacancies/vacancy-form.tsx`](../../../components/vacancies/vacancy-form.tsx) | **656** | Single-scroll. Already on Phase 9.3 A-005 hit list for RHF migration. AI components inline: `AiJdSuggest`, `AiBiasCheck`. |
| `CandidateForm` | [`components/candidates/candidate-form.tsx`](../../../components/candidates/candidate-form.tsx) | **907** | Single-scroll. Already has **two-path selector** (CV-first / manual) via `entryMode` state. CV parse via `/api/parse-cv`. Inline experience/education editors. |

### Current vacancy form fields

| Field | Required today | Locked decision (Q13/redesign) |
|---|---|---|
| `title` | ✅ | ✅ Required (Step 1) |
| `sector_id` | ✅ | ✏️ **Now optional** (Step 1) |
| `status_id` | ✅ — dropdown (Draft/Open/On hold/Closed/Archived) | ❌ **Removed** — implicit Draft until "Save & publish" footer action |
| `department` | optional | optional (Step 1) |
| `location` | optional | optional (Step 1) |
| `employment_type` | required | required (Step 1) |
| `hiring_manager_name` | optional | optional (Step 1) |
| **`work_mode`** | — (doesn't exist) | ➕ **NEW** (Step 1) — `on_site`, `remote`, `hybrid` |
| `openings_count` | required (default 1) | required (Step 1) |
| `start_date` | ✅ | ✏️ **Now optional** (Step 2) |
| `end_date` | optional | optional (Step 2) |
| `salary_min`, `salary_max`, `salary_currency` | optional | optional (Step 2) |
| `description`, `responsibilities`, `requirements` | required: description; optional: others | description required (Step 3); others optional |
| `show_on_public_page` | toggle | toggle (Step 3) |
| **Scorecard attributes** | not on this form (configured later) | ➕ **NEW** (Step 4, **optional**) |
| **Screening questions** | not on this form (configured later) | ➕ **NEW** (Step 4, **optional**) |
| Custom fields | trailing card | unclear from design — confirm (recommend Step 4 or Settings tab post-create) |

### Current candidate form fields

| Field | Required today | Locked decision |
|---|---|---|
| `entryMode` (CV-first / manual selector) | state-driven | ✅ Step 0 path-picker (unchanged) |
| `first_name`, `last_name` | required | required (Step 1) |
| `email` | optional | optional but triggers **duplicate detection** (Step 3) |
| `phone` | optional | optional (Step 1) |
| `linkedin_profile_url` | optional | optional (Step 1) |
| `location` | optional | optional (Step 1) |
| `timezone` | optional | optional (Step 1) |
| `languages[]` | optional | optional (Step 1) |
| `salary_expectation`, `notice_period` | optional | optional (Step 1) |
| `source` | optional | optional (Step 3) |
| `general_status_id` | defaults to `active` | ❌ **Removed** — status is derived (Q1 + Phase 0.1 trigger fix) |
| `selectedVacancyId` (initial vacancy) | optional | optional (Step 3 — "Initial vacancy") |
| **`starting_stage_id`** | — (always defaults to `applied`) | ➕ **NEW** (Step 3) — pick stage when sourcing warm candidates |
| Custom fields | trailing card | optional (Step 1 or later) |
| Experience entries | inline (`pendingExp`) | Step 2 |
| Education entries | inline (`pendingEdu`) | Step 2 |
| Initial note | optional | Step 4 |
| Pending CV upload | inline | wired into Step 0 / Step 1 |

### Server actions in scope

- `lib/actions/vacancies.ts::createVacancy(input)` — single insert. **Needs:** draft-state support, work_mode field, optional start_date.
- `lib/actions/candidates.ts::createCandidate(input)` — single insert. **Needs:** drop `general_status_id`, duplicate-detection branch.
- `lib/actions/applications.ts::createApplication(input)` — gets a `starting_stage_id` parameter.
- `lib/actions/candidate-background.ts::bulkCreateExperienceEntries` + `bulkCreateEducationEntries` — already exist, reuse.
- `lib/actions/documents.ts::uploadDocument` — already exists, reuse for CV attach.
- `lib/actions/notes.ts::createNote` — already exists, reuse for initial note.
- `/api/parse-cv` — existing endpoint, reuse for Step 0 → Step 1 CV-fill.

---

## 2. Proposed redesign

### 2.1 Create vacancy — 5-step wizard (publishable after Step 1)

**Shell:**

```
┌─ Create vacancy ─────────────────────────── × ─┐
│ Step 1 of 5 · Basics                            │
├──────────────┬──────────────────────────────────┤
│ ● Basics     │  [body]                          │
│ ○ Dates &…   │                                  │
│ ○ Description│                                  │
│ ○ Scorecard… │                                  │
│   NEW · opt  │                                  │
│ ○ Review &…  │                                  │
│              │                                  │
│ [hint card]  │                                  │
├──────────────┴──────────────────────────────────┤
│ [Save as draft]  [Save & publish]  [Next →]    │
└─────────────────────────────────────────────────┘
```

**Hint card in left rail:** "Fill Basics → **Save & publish**. Steps 2–5 take sensible defaults you can refine later."

**Footer actions per step:**
- Step 1: `[Save as draft]` `[Save & publish]` `[Next: Dates & compensation →]`
- Step 2: `[← Back]` `[Save as draft]` `[Save & publish]` `[Next →]`
- Step 3: same shape
- Step 4: `[← Back]` `[Skip]` `[Save & publish]` `[Next →]` — skippable
- Step 5: `[← Back]` `[Save as draft]` `[Publish now]`

**Step 1 — Basics (the only publishable step):**

- Position title * (text input)
- Department (text input)
- Sector (searchable select, **now optional** — `sector_id NULL allowed`)
- Location (text input)
- **Work mode (NEW)** — select: On-site / Remote / Hybrid (`vacancies.work_mode`)
- Employment type (Full-time / Part-time / Contract / Internship — existing)
- Openings (number input, default 1)
- Hiring manager (text input — kept as free text to match current schema; no profile link)

**Callout box (orange):** "Removed: the required Status dropdown. A new vacancy is a Draft until you publish — the footer's Save & publish decides that."

**Step 2 — Dates & compensation:**

- Start date (now optional — `start_date NULL allowed`)
- End date (already optional)
- Minimum salary, Maximum salary, Currency
- Helper text: "Salary range is optional but powers candidate-side filtering and the salary fit knockout."

**Step 3 — Description & AI:**

- **AI assist bar 1** — "Suggest job description sections" — invokes `AiJdSuggest` (existing component, restyle to S10 calm-blue per [`audit.md` §4.13](../audit.md#413-·-s10-·-ai--terminology-ai-and-terminology-systemdchtml))
- **AI assist bar 2** — "Check inclusive language" — invokes `AiBiasCheck` (existing component)
- About the job * (textarea, 0/5000 char counter)
- Responsibilities (textarea)
- Requirements (textarea)
- "Show on public jobs page" toggle (`show_on_public_page`)

**Step 4 — Scorecard & questions (NEW, OPTIONAL):**

- **Left card — Interview scorecard:**
  - "Suggest from JD" button (top right, invokes `AiAssessmentSuggester` — existing)
  - List of attributes; each row: name + must-have toggle (`★ Must-have` / `Nice-to-have`)
  - `[+ Add attribute]` dashed row
  - Helper: "Attributes interviewers rate 1–5. Skip to use a default set you can edit later."
- **Right card — Screening questions:**
  - List of questions; each row: question + type tag (Knockout / Number / Short text / Select)
  - `[+ Add question]` dashed row
  - Helper: "Auto-added to the apply form. Knockout answers flag at screening."
- Footer: "Skip this step → default scorecard + no screening questions. Fully editable later on the vacancy."

**Step 5 — Review & publish:**

- Vacancy summary tile: icon + title + meta line (Department · Location · Work mode · Employment type · Openings)
- 3 summary cards: Salary · Scorecard (N attributes · N must-have) · Description (✓ Complete / ✗ Missing)
- Choice radio cards (locked Q-S4d-a — see §7):
  - **Publish now** (default highlighted) — "Live + apply link generated"
  - **Save as draft** — "Not visible, no apply link yet"
- Footer: `[← Back]` `[Confirm]`

### 2.2 Add candidate — 4 steps + Step 0 path-picker

**Step 0 — Choose path** (already exists in code; design preserves it):

- **Upload CV first** card (default highlighted) — "Upload a PDF/Word CV — AI fills name, contact, experience & education for review."
- **Fill manually** card — "Enter details by hand. You can still attach a CV as a document."

Selecting CV-first triggers an immediate file picker; once parse completes, advances to Step 1 with fields pre-filled.

**Step 1 — Personal information** (CV-prefilled if from CV path):

- **Parsed banner** at top (if CV path): "[CV_filename.pdf] parsed — review fields below" + "AI-filled · review" calm tag
- First name * / Last name *
- **Removed callout (orange):** "Removed: General Status dropdown. Status is now derived from the application stage."
- Email / Phone
- Location / Timezone
- Salary expectation / Notice period
- Languages (multi-select)
- LinkedIn

**Step 2 — Experience & education:**

- Experience card with inline editor (already exists as `pendingExp` state)
- Education card with inline editor (already exists as `pendingEdu` state)
- CV-parsed entries show as parsed cards with "+ N more parsed entries" link

**Step 3 — Application & source:**

- Source (select)
- Initial vacancy (searchable select — optional; can skip and add candidate to no vacancy)
- **Starting stage (NEW)** — visible only when an initial vacancy is selected. Shows chips for the first 3 stages of that vacancy's pipeline (default Applied). Helper: "Sourced someone warm? Drop them straight into a later stage."
- **Duplicate detection banner (NEW)** — fires when email matches an existing candidate. Amber box: "Possible duplicate. [email] matches an existing candidate. **[Review & merge]** before adding." Links to Merge flow (Q10 spec).

**Step 4 — Notes:**

- Single textarea for initial note (optional)
- Footer: `[Save & add another]` `[Add candidate]`

### 2.3 New entry points

The redesign's `Create Flows.dc.html` (superseded by S4d but still useful) mentions **three entry paths converge on the application model:**

1. Public apply form (`/apply/[token]`) — already exists
2. **Add candidate** (this flow)
3. **Review mode** — the new Pipeline triage surface (per [S01 §4.1](S01-pipeline.md#41-·-s1-·-pipeline-pipeline-versionsdchtml))

The "Add candidate" wizard is the only one that gets a stepped UI; the other two have their own surfaces.

---

## 3. Gaps, missing screens, edge cases

### 3.1 Missing screens

| Surface | Why missing | Recommended action |
|---|---|---|
| Step 0 → Step 1 transition with CV parse failure | Not drawn | Inline error on the path-picker card; manual path becomes the default; "Couldn't read this CV — fill manually below" |
| Step 4 (vacancy) skipped behavior | Mentioned but not shown | Server uses defaults: empty scorecard + no screening questions. On Step 5 Review card, the Scorecard summary reads "0 attributes · default" with a "[Set up later]" link to vacancy detail Settings tab |
| Pipeline stages picker for "Starting stage" in candidate Step 3 | Shows 3 chips but no overflow | When the vacancy has > 5 non-terminal stages, show first 3 + "More…" popover. Recall cap-10 (Q3). |
| Duplicate detection click → Merge flow | Banner says "Review & merge" but no link target | Opens the Merge dialog ([Q10 spec](../audit.md#0-status--decisions-locked)) with the matched candidate pre-selected on side B |
| Cancel mid-wizard with unsaved changes | Not drawn | Confirmation modal: "Discard your changes?" Yes → close. No → stay. |
| Auto-save / draft recovery | Not addressed | Server-side: store a `vacancy_drafts` row keyed by user + vacancy (if any saves happened). On wizard re-open, "Resume your draft?" banner. Defer to v1.1. |
| Validation feedback per step | Not drawn | Inline below each field (sonner toast for cross-field errors). Next button disabled if Step 1 required fields are empty. |
| "Save & publish" attempt with incomplete required fields outside Step 1 | Not drawn | Save & publish from Step 2+ implicitly fills missing Step 3 description with a placeholder — actually no, **block with toast**: "Add a job description before publishing." |
| Custom fields in vacancy wizard | Not in design | Confirm with user — recommend Step 4 (alongside scorecard) or omit and rely on Settings tab post-create |
| Custom fields in candidate wizard | Not in design | Same |
| Wizard on mobile | Out of scope (creation = desktop-by-nature) | Show "Open on desktop to create" banner if mobile detected |

### 3.2 Edge cases

| Case | Today | New |
|---|---|---|
| Plan limit hit (max vacancies on plan) | Error toast on submit | Caught at Step 1 "Save as draft" / "Save & publish" — same error pattern |
| Plan limit hit (max candidates) | Error on submit | Same |
| User abandons wizard at Step 3 | Page-leave warning if dirty | Same + offer "Save as draft" with one click |
| User changes vacancy in Step 3 (candidate flow) | N/A | Starting stage picker re-renders with new vacancy's stages |
| Duplicate detection triggers AND user wants to add anyway | Banner shows but user can submit | Allow submit but require confirmation: "This will create a second record. Continue?" |
| CV parse returns minimal data | Step 1 has empty fields | Manual fill, no special UX |
| CV parse hangs > 10s | Currently shows spinner | Add timeout + "Parse taking longer than expected — [fill manually]" link |
| Source not in standard list | Free text input | Same; recommend allow-list with "Other" option |
| User has no vacancies yet (candidate wizard Step 3) | Initial vacancy = empty | Step 3 helper text: "No open vacancies yet — you can add the candidate without a vacancy and link them later." |

### 3.3 Race conditions

- Two recruiters create the same vacancy title simultaneously: both succeed (titles aren't unique).
- Two recruiters add the same candidate email simultaneously: duplicate detection fires on **read** at Step 3, but the actual insert at Step 4 isn't atomically protected. Recommend a unique constraint: `UNIQUE (organization_id, email) WHERE deleted_at IS NULL`. Second insert fails cleanly with the duplicate banner re-shown.

---

## 4. Reuse opportunities

| Need | Reuse from | Notes |
|---|---|---|
| Wizard shell (left rail + step body + footer) | NEW — no equivalent today | Build as `<Wizard />` generic component. Used in vacancy + candidate; potentially reusable for future onboarding flows. |
| Step state management | NEW | `useReducer` or zustand store keyed by wizard ID; URL param `?step=N` for deep-link / back button |
| Per-step Zod schema | Existing `lib/validations/vacancy.ts`, `lib/validations/candidate.ts` | Split into `step1Schema`, `step2Schema`, etc. (or omit/extend per step) |
| Searchable select | `components/ui/searchable-select.tsx` | Direct reuse for Sector, Initial vacancy |
| CV upload + parse | `/api/parse-cv` + existing `handleCVUploadForParsing` logic in `candidate-form.tsx:138` | Lift the logic into a shared hook |
| `AiJdSuggest` | `components/vacancies/ai-jd-suggest.tsx` | Direct reuse, restyle to S10 calm |
| `AiBiasCheck` | `components/vacancies/ai-bias-check.tsx` | Direct reuse, restyle to S10 |
| `AiAssessmentSuggester` | `components/vacancies/ai-assessment-suggester.tsx` | Direct reuse for Step 4 scorecard |
| Custom field form | `components/custom-fields/custom-fields-form.tsx` | If included, slot into Step 4 or terminal step |
| Date pickers | `components/ui/date-picker.tsx` | Direct reuse |
| Inline experience/education editors | `pendingExp` / `pendingEdu` state pattern in `candidate-form.tsx:102-107` | Direct lift into Step 2 |
| Duplicate detection on email | `lib/actions/candidates.ts` already has duplicate detection logic per CLAUDE.md | Add a `checkDuplicate(email)` server action; wire to Step 3 onBlur of email field (debounced) |
| Existing Step 0 path-picker logic | `entryMode` state in `candidate-form.tsx:96` | Direct lift |

**Net new code:**
- Wizard shell + step navigation + draft persistence
- "Starting stage" chip picker (new — depends on Wave 2.6 pipeline_stages)
- Step 5 Review summary tiles (vacancy flow)
- Mobile "open on desktop" banner
- Cancel-with-unsaved-changes confirmation

---

## 5. DB / API changes

### 5.1 Schema

**Vacancy form changes:**

```sql
-- New work_mode column
ALTER TABLE public.vacancies
  ADD COLUMN work_mode TEXT CHECK (work_mode IN ('on_site', 'remote', 'hybrid'));

-- Make start_date optional (was NOT NULL)
ALTER TABLE public.vacancies ALTER COLUMN start_date DROP NOT NULL;

-- Make sector_id optional — was already nullable per Migration 001, confirm
-- (No change if already nullable.)

-- Add is_published flag for cleaner draft semantics
-- (alternative: keep status_id as the source of truth; the UI just hides
-- the dropdown and writes 'draft' or 'open' under the hood)
-- Recommendation: keep status_id, no schema change here.
```

**Candidate form changes:**

```sql
-- Drop general_status_id from candidates (Q1 + Phase 0.1)
-- Coordinate with the candidate profile S2 work — same column.
-- Actually: per the audit recommendation, keep the column as a derived cache.
-- The trigger fix (Phase 0.1) populates it. The form just doesn't write it.
-- So NO schema change here; just remove the field from the form.

-- Add unique constraint on email per org (for duplicate detection insert race)
CREATE UNIQUE INDEX IF NOT EXISTS uq_candidates_org_email
  ON public.candidates (organization_id, lower(email))
  WHERE deleted_at IS NULL AND email IS NOT NULL;
```

**Application / starting stage:**

```sql
-- No schema change. createApplication just accepts an optional starting_stage_id;
-- if null, defaults to the first non-terminal stage (Applied).
```

**Draft persistence (optional v1.1):**

```sql
-- For "Save as draft" mid-wizard recovery. Defer to v1.1 — for v1, "Save as
-- draft" just creates the vacancy row with status_id = 'draft'.
```

### 5.2 Server actions

**Modified:**

- `createVacancy(input)` — accept new `work_mode`; allow null `start_date`; allow null `sector_id`; accept `publish: boolean` to set `status_id` to `open` (if true) or `draft` (if false); accept optional `pipeline_stages_template` for default vs custom seeding
- `createCandidate(input)` — drop `general_status_id` from input shape; `general_status_id` set server-side via Phase 0.1 trigger; integrate duplicate-detection branch into the flow
- `createApplication(input)` — accept optional `starting_stage_id`; default to vacancy's first non-terminal stage when null

**New:**

- `checkCandidateDuplicate(email): Promise<{ duplicate: boolean; candidate?: Pick<Candidate, 'id' | 'first_name' | 'last_name'> }>` — for the Step 3 banner
- `suggestScorecardFromJd(jdText): Promise<{ attributes: { name: string; must_have: boolean }[]; questions: { text: string; type: ... }[] }>` — for Step 4 of vacancy flow (extends existing `AiAssessmentSuggester` output)
- `seedVacancyDefaultStages(vacancyId): Promise<void>` — seeds the 7-stage default template into `pipeline_stages` for a new vacancy (called from `createVacancy` post-insert)

### 5.3 Routes

| Route | Status | Action |
|---|---|---|
| `/vacancies/new` | KEEP | Renders the new Wizard. `?step=N` URL param. |
| `/candidates/new` | KEEP | Renders the new Wizard. `?step=N` URL param. `?cv=true` shortcut for direct CV-first start. `?vacancy=X` pre-fills Initial vacancy. |

---

## 6. Effort estimate

Greenfield rewrites — the existing 656 + 907 lines mostly go away.

### 6.1 Wave 2.7 — Stepped creation flows

| Task | Effort | Reuse |
|---|---|---|
| Wizard shell component (rail + body + footer + step state) | `M` | None |
| Per-step Zod schema split | `S` | Existing validations as input |
| Step navigation (URL param + back button + page-leave warning) | `S` | None |
| **Vacancy wizard Step 1 — Basics** | `S` | Existing field components |
| Add `work_mode` field + select | `S` | Select component |
| `vacancies.work_mode` migration | `S` | None |
| Mark `start_date` + `sector_id` optional | `S` | One-line migration |
| **Vacancy wizard Step 2 — Dates & compensation** | `S` | Existing date picker + currency select |
| **Vacancy wizard Step 3 — Description & AI** | `S` | Existing `AiJdSuggest` + `AiBiasCheck` |
| Restyle AI assist bars to S10 calm-blue | `S` | Per Wave 1.6 reusable `<AiDraftPanel />` |
| **Vacancy wizard Step 4 — Scorecard & questions (NEW)** | `M` | `AiAssessmentSuggester` exists |
| `seedVacancyDefaultStages` server action | `S` | None — pipeline_stages from Wave 2.6 |
| **Vacancy wizard Step 5 — Review & publish** | `S` | Summary tiles + radio cards |
| Publish flow — sets `status_id = 'open'` + generates `application_form_token` if missing | `S` | Existing token generation |
| **Candidate wizard Step 0 — path picker** | `S` | Lift `entryMode` logic from existing form |
| CV-first → parse → autofill Step 1 | `S` | Lift `handleCVUploadForParsing` |
| **Candidate wizard Step 1 — Personal info** | `S` | Existing field components |
| Remove General Status field + add removal callout | `S` | One-line change |
| **Candidate wizard Step 2 — Experience & education** | `S` | Lift `pendingExp` / `pendingEdu` + inline editors |
| **Candidate wizard Step 3 — Application & source** | `M` | Searchable select for vacancy; new starting-stage chip picker |
| `checkCandidateDuplicate` server action + Step 3 banner integration | `S` | Existing duplicate logic |
| `uq_candidates_org_email` migration | `S` | One-line migration |
| Link "Review & merge" banner to Merge dialog (Q10) | `S` | Depends on Merge flow being built |
| **Candidate wizard Step 4 — Notes** | `S` | Existing note composer |
| Mobile "open on desktop" banner | `S` | Single component |
| Cancel-with-unsaved-changes confirmation modal | `S` | AlertDialog pattern |
| Wire Wave 1.6 reusable `<AiDraftPanel />` into all 3 AI surfaces in vacancy flow | `S` | Wave 1.6 prerequisite |

**Wave 2.7 total: ~M-L** (3–4 weeks elapsed).

### 6.2 Coordination

- Depends on **Wave 2.6 pipeline_stages schema** for the starting-stage chip picker.
- Depends on **Wave 2.5 scorecard rebuild** for Step 4 scorecard config (otherwise Step 4 is a placeholder).
- Coordinates with **Q10 Merge flow** for the duplicate-detection "Review & merge" link target.
- Coordinates with **Phase 0.1 trigger fix** so the candidate's auto-derived `general_status_id` is populated correctly post-insert.

---

## 7. Open questions

### 7.1 RESOLVED via locked decisions

| Question | Status |
|---|---|
| Wizard vs single-scroll | ✅ Locked Q13 → stepped wizard |
| General Status field | ✅ Locked Q1 → removed from form (DB column stays as derived cache) |
| Migration of existing data | ✅ Locked Q14 → none |
| Starting stage availability | ✅ Locked — uses Wave 2.6 `pipeline_stages` |

### 7.2 NEW — surfaced by this analysis

- **Q-S4d-a:** Step 5 Review's draft-vs-publish radio default — **Publish now** highlighted (per design) or **Save as draft** (more conservative for first-time users)? *Lean: Publish now* — matches the redesign's "publishable after Step 1" thesis; if someone hits Step 5 they're already committed.
- **Q-S4d-b:** Should the vacancy wizard show **custom fields** in Step 4 or omit and rely on the Settings tab post-create? Custom fields can be required per `custom_field_schemas` — if a custom field is required, omitting from the wizard means we can't validate. *Lean: include custom fields as a Step 4 sub-section* — both scorecard and custom fields are "optional config" in spirit.
- **Q-S4d-c:** **Plan limit reached** at Step 1 publish — block at field level or at submit? *Lean: at submit*. The user might be filling for testing; surface the limit + upgrade CTA only when they try to publish/save draft.
- **Q-S4d-d:** **Hiring manager field** — currently free text. Should the wizard upgrade this to a profile-link picker (select from org members) to enable per-vacancy hiring-team scoping later (S04 Q-S04-c)? *Lean: keep free text v1* — defer per-vacancy hiring-team feature; matches the audit's recommendation in S04.
- **Q-S4d-e:** **Default scorecard template** when user skips Step 4 — empty (forces them to set up later) OR 5 generic attributes (Communication / Problem solving / Domain knowledge / Culture add / Drive) marked as defaults? *Lean: empty* — generic defaults are noise; users who skip Step 4 will get an empty Scorecard tab + a "Suggest from JD" CTA there.
- **Q-S4d-f:** **CV parse mid-wizard re-trigger** — what if a user uploads a different CV after Step 1? *Lean: silently re-parse and update fields with a banner "New CV parsed — fields updated"* — no destructive overwrite, but transparent.
- **Q-S4d-g:** **`work_mode` location interaction** — if `work_mode = 'remote'`, should `location` field be hidden or shown? *Lean: keep both visible* — many "remote" roles have a region constraint ("Remote, EU only").
- **Q-S4d-h:** **Draft persistence** for mid-wizard cancellation — v1 just creates a `draft` vacancy row OR v1.1 introduces `vacancy_drafts` recovery table? *Lean: v1 = create draft on cancel-with-content* — server creates the row in `draft` state, surfaces a "Continue draft" CTA next time the user visits `/vacancies/new`. v1.1 = full mid-wizard recovery.

---

## 8. Test plan

### 8.1 Functional — vacancy wizard

- [ ] Wizard renders with Step 1 active
- [ ] Step rail shows correct active/completed/pending state
- [ ] Required fields validated before "Next" is enabled
- [ ] "Save as draft" persists with `status_id = 'draft'`
- [ ] "Save & publish" at Step 1 publishes with default Steps 2–5 values
- [ ] "Save & publish" with missing description blocks with toast
- [ ] Step 2 — Dates & compensation: null start_date accepted
- [ ] Step 3 — AI Suggest sections invokes `AiJdSuggest`
- [ ] Step 3 — Bias check invokes `AiBiasCheck`
- [ ] Step 4 — Suggest from JD pre-populates scorecard
- [ ] Step 4 — Skip uses empty defaults
- [ ] Step 5 — Review summary tiles render correctly
- [ ] Step 5 — Publish now vs Save as draft works
- [ ] On successful publish, redirects to vacancy detail with `application_form_token` generated
- [ ] Page-leave warning fires on dirty state
- [ ] Cancel modal confirms before closing
- [ ] URL param `?step=N` deep-links to step

### 8.2 Functional — candidate wizard

- [ ] Step 0 path picker renders, defaults to CV-first
- [ ] CV upload triggers parse + advances to Step 1 with fields pre-filled
- [ ] CV parse failure shows error + falls back to manual
- [ ] Step 1 — General Status field absent
- [ ] Step 2 — Experience + Education inline editors work
- [ ] Step 2 — CV-parsed entries shown as parsed cards
- [ ] Step 3 — Email blur fires `checkCandidateDuplicate`
- [ ] Step 3 — Duplicate banner shows when match found
- [ ] Step 3 — Banner "Review & merge" link opens Merge dialog
- [ ] Step 3 — Initial vacancy select shows org's vacancies
- [ ] Step 3 — Starting stage chips appear only after vacancy selected
- [ ] Step 3 — Starting stage chips render first 3 non-terminal stages
- [ ] Step 4 — Note saves to `candidate_notes`
- [ ] "Add candidate" creates candidate + application (if vacancy chosen)
- [ ] "Save & add another" persists candidate + resets wizard to Step 0
- [ ] `?vacancy=X` URL param pre-fills Step 3 Initial vacancy

### 8.3 Non-functional

- [ ] CV parse < 5s on 10-page CV
- [ ] AI Suggest from JD < 5s
- [ ] Wizard renders < 500ms cold load
- [ ] All 5 steps accessible via keyboard tab
- [ ] Screen reader can navigate steps
- [ ] Mobile shows "open on desktop" banner

### 8.4 Regression

- [ ] Existing vacancy detail page still loads vacancies created via wizard
- [ ] LinkedIn cross-post still works on wizard-created vacancies
- [ ] Public `/jobs/[slug]` listing includes published vacancies from wizard
- [ ] Existing candidates still display correctly post-`general_status_id`-form-removal (column stays in DB)
- [ ] Custom fields config still respected
- [ ] Plan-limit enforcement still works

---

## 9. Verification

Aligned with [`docs/claude-code-workflow.md`](../../claude-code-workflow.md) Phase 5:

- [ ] All sub-tasks in §6 complete
- [ ] Tests in §8 pass
- [ ] Docs updated:
  - [ ] `docs/3-architecture/frontend.md` — wizard pattern documented
  - [ ] `docs/3-architecture/backend.md` — new server actions
  - [ ] `docs/3-architecture/database.md` — `work_mode` column, `uq_candidates_org_email` index
  - [ ] `docs/7-api/endpoints.md` — `checkCandidateDuplicate`, `seedVacancyDefaultStages`
  - [ ] `docs/8-decisions.md` — Q-S4d-a/b/c/d/e/f/g/h decisions
  - [ ] `docs/ui-texts.md` — wizard strings (step labels, hints, callouts)
- [ ] Ripple check — `vacancy-form.tsx` callers (only the create + edit pages today). Edit page may need partial reuse; sequence after wizard ships.
- [ ] Ripple check — `candidate-form.tsx` callers (create + edit). Same.

---

## 10. What to do after reading

1. **Confirm the new Q-S4d-a through Q-S4d-h** answers (or override).
2. **Decide on edit-page convergence** — when the wizard ships for create, what happens to `/vacancies/[id]/edit` and `/candidates/[id]/edit`? Recommend: edit pages stay as single-scroll forms (matches the desktop power-user pattern), but lift any shared sub-components (e.g., the scorecard config card from Step 4) into shared components used by both wizard and edit page. Wave 2.7 covers the wizard; edit-page refactor is a follow-up.
3. **Next flow doc:** S2 Candidate profile is the natural next — covers the daily-driver candidate surface, including the Merge flow that's surfaced from S4d's duplicate detection. Or jump to S5 Public pages (apply form upgrade) since it ties to Step 4 of vacancy creation (screening questions auto-inject into apply form).

---

## Appendix — file inventory for this flow

**New files:**

| File | Purpose |
|---|---|
| `components/ui/wizard.tsx` | Generic wizard shell (rail + body + footer + step state) |
| `components/vacancies/vacancy-wizard.tsx` | The 5-step vacancy wizard |
| `components/vacancies/vacancy-wizard-step-basics.tsx` | Step 1 |
| `components/vacancies/vacancy-wizard-step-dates.tsx` | Step 2 |
| `components/vacancies/vacancy-wizard-step-description.tsx` | Step 3 (wraps existing AI components) |
| `components/vacancies/vacancy-wizard-step-scorecard.tsx` | Step 4 |
| `components/vacancies/vacancy-wizard-step-review.tsx` | Step 5 |
| `components/candidates/candidate-wizard.tsx` | The 4-step candidate wizard + Step 0 |
| `components/candidates/candidate-wizard-step-path.tsx` | Step 0 path picker |
| `components/candidates/candidate-wizard-step-personal.tsx` | Step 1 |
| `components/candidates/candidate-wizard-step-experience.tsx` | Step 2 |
| `components/candidates/candidate-wizard-step-application.tsx` | Step 3 (with starting-stage picker + dup detection) |
| `components/candidates/candidate-wizard-step-notes.tsx` | Step 4 |
| `components/candidates/duplicate-detection-banner.tsx` | New |
| `components/candidates/starting-stage-picker.tsx` | New |
| `lib/actions/check-duplicate.ts` | `checkCandidateDuplicate` server action |
| `lib/hooks/use-cv-parse.ts` | Shared hook lifted from `candidate-form.tsx` |
| `scripts/047_vacancies_work_mode.sql` | New migration |
| `scripts/048_vacancies_start_date_nullable.sql` | New migration |
| `scripts/049_candidates_org_email_unique.sql` | New migration |

**Modified files:**

| File | Change |
|---|---|
| `app/(dashboard)/vacancies/new/page.tsx` | Replace `<VacancyForm />` with `<VacancyWizard />` |
| `app/(dashboard)/candidates/new/page.tsx` | Replace `<CandidateForm />` with `<CandidateWizard />` |
| `lib/actions/vacancies.ts` | `createVacancy` accepts `work_mode`, `publish`, null `start_date`; new `seedVacancyDefaultStages` |
| `lib/actions/candidates.ts` | `createCandidate` drops `general_status_id` from input shape; integrate dup detection |
| `lib/actions/applications.ts` | `createApplication` accepts `starting_stage_id` |

**Retained as-is (edit pages):**

| File | Note |
|---|---|
| `components/vacancies/vacancy-form.tsx` | Stays for `/vacancies/[id]/edit`. Lift shared sub-components into `components/vacancies/shared/` over time. |
| `components/candidates/candidate-form.tsx` | Same for `/candidates/[id]/edit`. |

**Docs touched:**
- `docs/3-architecture/frontend.md`
- `docs/3-architecture/backend.md`
- `docs/3-architecture/database.md`
- `docs/7-api/endpoints.md`
- `docs/8-decisions.md`
- `docs/ui-texts.md`

**Tests added:**
- `tests/components/ui/wizard.test.tsx`
- `tests/components/vacancies/vacancy-wizard.test.tsx`
- `tests/components/candidates/candidate-wizard.test.tsx`
- `tests/lib/actions/check-duplicate.test.ts`
- `tests/lib/actions/seed-vacancy-default-stages.test.ts`
