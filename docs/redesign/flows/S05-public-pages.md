# S5 · Public pages — flow analysis

> **Status:** Draft 1, authored 2026-06-17. Covers three candidate-facing surfaces: `/jobs/[slug]` (job listing), `/apply/[token]` (apply form), `/status/[token]` (candidate tracker).
>
> **Sources:** [`Public Pages.dc.html`](../../../redesign/Public%20Pages.dc.html), [`audit.md` §4.7](../audit.md#47-·-s5-·-public-pages-public-pagesdchtml). **Mobile:** [`mobile/apply-form.md`](../mobile/apply-form.md) (canonical for apply form). Per-screen mobile is more important here than for any other flow — most candidates apply from phones.
>
> **Why this is sixth.** Public pages are the candidate's only impression of HRHandle. The redesign adds the missing **screening questions** injection (per Q12, feeds knockout flags into pipeline), plus a light brand polish on the listing + status pages. Mostly preserves existing real functionality.

---

## 1. Current implementation

### Routes

| Route | File | Lines | Pattern |
|---|---|---|---|
| `/jobs/[slug]` | [`app/jobs/[slug]/page.tsx`](../../../app/jobs/[slug]/page.tsx) | 134 | Org's public listing page. Slug = `organizations.public_page_slug` (or backward-compat UUID). |
| `/apply/[token]` | [`app/apply/[token]/page.tsx`](../../../app/apply/[token]/page.tsx) | 188 | Per-vacancy apply form. Token = `vacancies.application_form_token`. |
| `/status/[token]` | [`app/status/[token]/page.tsx`](../../../app/status/[token]/page.tsx) | 209 | Candidate-safe status tracker (G-016). Token = `applications.public_token`. |

### Components

| Component | File | Lines | Notes |
|---|---|---|---|
| `ApplyForm` | [`components/apply/apply-form.tsx`](../../../components/apply/apply-form.tsx) | **401** | CV upload + parse + Turnstile + GDPR Article 13 notice. Per-field state. |
| `StatusStepper` | [`components/status/status-stepper.tsx`](../../../components/status/status-stepper.tsx) | — | Visual stage tracker — uses public buckets (Received / Under review / Interview / Decision) |
| `WithdrawButton` | [`components/status/withdraw-button.tsx`](../../../components/status/withdraw-button.tsx) | — | G-022 candidate self-withdraw |

### Server actions / API

| Endpoint | Purpose |
|---|---|
| `lib/actions/public-apply.ts::submitPublicApplication` | Server action wired to ApplyForm submit. Verifies Turnstile, creates candidate (or links to existing via duplicate-detection on email), inserts application + experience/education from CV parse. |
| `/api/parse-cv` | POST endpoint that takes a file, returns `{ success, data: ParsedCVInput }`. Used inline from ApplyForm during file change. |
| `lib/application-status-bucket.ts::statusCodeToBucket` | Maps internal `application_statuses.code` → public-safe bucket (Received / Under review / Interview / Decision / Closed). |

### Integrations

- **Cloudflare Turnstile** — `@marsidev/react-turnstile`, invisible mode. `TURNSTILE_SECRET_KEY` env var. Server verifies in `submitPublicApplication`. Fails-open with server warning when unset (CLAUDE.md).
- **CV parse** — `/api/parse-cv` calls the org's AI provider; returns structured `ParsedCVInput`.
- **JSON-LD JobPosting** — `app/apply/[token]/page.tsx:77` injects schema.org markup for SEO.
- **Public listing slug** — `organizations.public_page_slug` (Migration 021). Backward-compat with old UUID tokens.

### Current behavior — what works

- ✅ Apply form CV upload + auto-parse + field prefill
- ✅ GDPR Article 13 notice (controller = org, processor = HRHandle, 30-day retention)
- ✅ Invisible Turnstile captcha
- ✅ Closed vacancy state ("This position is no longer open")
- ✅ Status page with G-022 self-withdraw button
- ✅ Status bucket abstraction (no internal stage names leak)
- ✅ Org listing with logo + thin brand text + "Powered by HRHandle"
- ✅ Token-as-credential model with 404-on-missing (no oracle for application existence)

### Current behavior — what doesn't exist

- ❌ Screening questions on apply form
- ❌ Light brand polish (brand-blue CTA, thin brand bar, role count)
- ❌ Apply form "Thanks for applying" confirmation card design
- ❌ "Track your application →" link from confirmation to status page (per status mobile design)
- ❌ Camera-as-CV-source on mobile (apply form mobile spec)

---

## 2. Proposed redesign

Three sub-pages, each gets specific updates.

### 2.1 `/jobs/[slug]` — Public job listing

**Visual changes only.** Logic unchanged.

**Header card:**

```
┌────────────────────────────────────────────────┐
│ ▓▓▓▓▓ (8px brand-blue bar)                     │
│                                                │
│              [Logo or "A"]                     │
│                                                │
│              Acme Corp                         │
│       Open Positions · 3 roles                 │
└────────────────────────────────────────────────┘
```

- 8px brand-blue bar at top (brand affordance, doesn't compete with logo)
- Centered logo (existing) — falls back to initial letter
- Org name (existing, restyled larger)
- **"Open Positions · 3 roles"** — new line with role count (NEW addition per spec)

**Role cards** (per-vacancy):

```
┌────────────────────────────────────────────────┐
│ Senior Business Analyst              Apply →   │
│ Analytics · Tbilisi · Full-time                │
│ Lead requirements for our digital lending      │
│ platform, partnering with product, engineering │
│ and risk…                                      │
└────────────────────────────────────────────────┘
```

- 2-line description clamp (already exists)
- **"Apply →" in brand-blue** (new — currently neutral)
- Click anywhere on card → `/apply/[token]`

**Footer:** "Powered by HRHandle" centered, low-emphasis (unchanged).

**Empty state:** "No open positions right now. Check back soon." (vs current generic empty).

### 2.2 `/apply/[token]` — Apply page (biggest change in S5)

**Layout structure unchanged:** header card with job details + apply form + "View all open positions" footer link.

**The NEW addition (Q12 + S04 wiring):** screening questions section, auto-injected between the standard CV-and-contact fields and the GDPR notice + submit button.

Form layout (top to bottom):
1. **CV upload** (existing) — parse spinner + parsed banner
2. **First name * / Last name *** (existing)
3. **Email *** (existing)
4. **Phone** (existing)
5. **LinkedIn URL** (existing)
6. **NEW: Screening questions section** (only renders if vacancy has any)
7. **GDPR notice** (existing)
8. **Invisible Turnstile** (existing)
9. **Submit** (existing) — restyle to brand-blue

#### 2.2.1 Screening questions section

Renders only if the vacancy has `vacancy_questions WHERE kind = 'screening_question'`. Each question is one of four answer types (per S04 Wave 2.5):

| Type | UI | Knockout? |
|---|---|---|
| `yes_no_knockout` | Two-button toggle (Yes / No). Required. | Yes — wrong answer flags at screening. |
| `number` | Numeric input. Optional, with helper text. | Soft — flags if outside configured range. |
| `short_text` | Single-line input. Optional. | No — informational. |
| `select` | Single-select dropdown. Required. | Configurable — per-option flag. |

**Visual treatment:**

```
A few quick questions
───────────────────────────────────────────────
1.  Eligible to work in Georgia? *
    [ Yes ]  [ No ]

2.  Salary expectation (monthly)
    [____]

3.  Notice period
    [____________________]
```

**No special styling for knockout questions** (per [`mobile/apply-form.md`](../mobile/apply-form.md) — labeling a question "Disqualifying" produces dishonest answers).

**Knockout behavior:**
- Server-side: store answer; compute knockout flag against the vacancy's configured rules; attach to `applications.screening_flags` (JSONB).
- Client-side: never block submit — knockout answers still create the application (per audit spec line: "knockout answers still allow SUBMIT (flag internally, don't block — legal safety)").
- Internal pipeline: the candidate's profile screening contextual block (per S02) reads these flags as the auto-flagged checks.

**Order:** matches the recruiter's drag-reorder order from S04's Apply form tab.

#### 2.2.2 Confirmation card (post-submit)

Replace the form with a confirmation. Already exists but design refines:

```
┌────────────────────────────────────────────────┐
│              ✓                                 │
│         Thanks for applying!                   │
│                                                │
│ We've sent a confirmation to                   │
│ alex@example.com                               │
│                                                │
│  ┌────────────────────────────────────────┐    │
│  │ Track your application →               │    │
│  └────────────────────────────────────────┘    │
│                                                │
│       [ View other open roles ]                │
└────────────────────────────────────────────────┘
```

- Brand-green check icon
- Email confirmation reassurance
- **"Track your application →"** → `/status/<applications.public_token>` (only if org has status feature enabled; default yes)
- **"View other open roles"** → `/jobs/<org-slug>` (only if `public_page_slug` set)

#### 2.2.3 Closed vacancy state

(Unchanged from current implementation — clean "This position is no longer open" card.)

### 2.3 `/status/[token]` — Candidate tracker

**Preserve everything that's shipped.** Add light polish + design-system colors.

Per audit RR-11 (the G-022 withdraw button) — **must be preserved**.

**Layout:**

```
┌─ Acme Corp ───────────────────────────────────┐
│                                               │
│   Senior Business Analyst                     │
│   Analytics · Tbilisi · Full-time             │
│                                               │
└───────────────────────────────────────────────┘

┌─ Application status ──────────────────────────┐
│                                               │
│   ● Received       ━━ ● Under review          │
│                      ━━ ○ Interview           │
│                          ━━ ○ Decision        │
│                                               │
│   Last updated: 2 days ago                    │
└───────────────────────────────────────────────┘

┌─ Withdraw application (G-022 — preserve) ─────┐
│                                               │
│   No longer interested?                       │
│   [ Withdraw application ]                    │
└───────────────────────────────────────────────┘
```

**Behavior preserved:**
- Buckets: Received / Under review / Interview / Decision / Closed (per `statusCodeToBucket`)
- Never shows internal stage names, scorecards, or fit scores (per [redesign source](../../../redesign/SCREEN-SPECS.md))
- Withdraw button for non-terminal states (G-022 — emits activity log entry on the recruiter side)
- Token-as-credential model — 404 on missing/expired (no oracle)

**Terminal states:**

| Status | Bucket | What candidate sees |
|---|---|---|
| `hired` | Decision | Brand-green tile: "You've been hired into [Role] 🎉" + start date if offer accepted |
| `rejected` | Decision | Neutral gray tile: "After review, we've decided to move forward with other candidates. Thank you for applying." (no internal reason) |
| `withdrawn` | Closed | Neutral tile: "Application withdrawn on [date]." |
| `expired` | Closed | "This vacancy is no longer open." |

**Polish additions:**
- Use design-system palette (existing has neutral gray; new = brand-blue accent on stepper)
- Footer: "Need help? Contact [org name]." — small + low-emphasis (already exists, restyled)
- Mobile-first responsive: stepper renders horizontal on desktop, vertical on phone

---

## 3. Gaps, missing screens, edge cases

### 3.1 Missing screens

| Surface | Why missing | Recommended action |
|---|---|---|
| Listing page on phone | Spec implicit | Single-column cards stack; logo card stays full-width; per `mobile/apply-form.md` |
| Apply form parsing state mid-screening-Qs | Not drawn | CV parsing spinner blocks form; screening Qs render but disabled |
| Listing with 0 open vacancies | Existing handler "No open positions" | Polish — see §2.1 |
| Listing with 0 vacancies marked public | Same | "No open positions right now. Check back soon." |
| Apply with no screening Qs configured | Existing behavior — section just absent | No change |
| Confirmation with no public listing slug | "View other open roles" hidden | Existing fallback |
| Confirmation when status feature disabled | "Track your application" hidden | Existing |
| Status page with `withdrawn` state | Not drawn | Neutral tile, see §2.3 |
| Status page with `hired` state | Not drawn | Brand-green tile + start date |
| Status page when offer pending | Not drawn explicitly | Tile: "Offer sent on [date]. Check your inbox to accept or decline. [Open offer →]" → `/offer/<token>` |
| Status page with multiple applications from same candidate (different vacancies) | Today: each app has its own token + URL | No change — each token is per-application |

### 3.2 Edge cases

| Case | Today | New |
|---|---|---|
| Knockout screening Q answered "wrong" | N/A | Submit succeeds; flag stored; recruiter sees flagged screening checks in candidate profile screening block (per S02) |
| All screening Qs are knockout AND all flagged | N/A | Submit still succeeds; recruiter decides via Advance/Reject (no auto-rejection — Q12 lock) |
| CV parse fails on apply form | Form falls back to manual entry | Same; screening Qs still render |
| Candidate submits twice (same email + same vacancy) | Per public-apply.ts:165 — silently succeeds with same UX | Same — duplicate-detection on email merges with existing application if any |
| Screening question added/removed AFTER candidate applied | N/A | Old answers preserved on `applications.screening_answers`; new questions appear empty in the recruiter view |
| Apply page hit with valid token after vacancy closed | "Position no longer open" | Same — `isClosed` check at page level |
| Status page hit with valid token after vacancy deleted | 404 (deliberate — no oracle) | Same |
| Candidate self-withdraws via G-022 | Already works (activity log on recruiter side) | Same |
| Listing page hit with deleted org slug | 404 | Same |

### 3.3 Race conditions

- Apply submit + recruiter closes vacancy in parallel: server-side check on `vacancy.status === 'open'` AND `archived_at IS NULL` AND `deleted_at IS NULL` at insert time. Late submit fails cleanly with "Position no longer open" state on next page load. Acceptable.

---

## 4. Reuse opportunities

| Need | Reuse from | Notes |
|---|---|---|
| Listing page layout | `app/jobs/[slug]/page.tsx` | Polish only — add brand bar, role count |
| Apply page header card | `app/apply/[token]/page.tsx` | Polish only |
| CV upload + parse | `ApplyForm:handleFileChange` | Direct |
| GDPR notice | Existing in `ApplyForm` | Direct |
| Turnstile invisible | Existing | Direct |
| Field prefill from parsed CV | Existing | Direct |
| Status stepper | `StatusStepper` | Restyle to design system palette |
| Withdraw button (G-022) | `WithdrawButton` | Direct |
| Status bucket mapping | `statusCodeToBucket` | Direct |
| Job posting JSON-LD | Existing | Direct |
| Closed-vacancy state | Existing | Direct |
| `public_page_slug` resolution | Existing | Direct |
| Per-token security model | Existing (admin client + 404-on-missing) | Direct |
| Email confirmation send | Existing email infrastructure | Direct |

**Net new code:**
- Screening questions renderer component
- Per-answer-type input components (yes-no toggle / numeric / short-text / select)
- Screening flag computation server-side
- Listing page brand bar + role count
- Confirmation card restyling with status + listing links
- Status page state-specific tiles (hired / withdrawn / expired)

---

## 5. DB / API changes

### 5.1 Schema

```sql
-- Per-application screening answers
ALTER TABLE public.applications
  ADD COLUMN screening_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN screening_flags JSONB NOT NULL DEFAULT '[]'::jsonb;
-- screening_answers shape:
--   [{ "question_id": "...", "answer": "...", "answered_at": "..." }, ...]
-- screening_flags shape:
--   [{ "question_id": "...", "flag": "knockout" | "soft", "reason": "..." }, ...]

-- Index for the recruiter-side profile screening block lookup
CREATE INDEX idx_applications_screening_flags
  ON public.applications USING gin (screening_flags);
```

`vacancy_questions` already has the `kind = 'screening_question'` differentiation per S04 Wave 2.5 spec. The `screening_answer_type` column on `vacancy_questions` drives the apply form rendering.

### 5.2 Server actions

**Modified:**

- `submitPublicApplication(input)` — accept `screening_answers: { question_id: string, answer: any }[]`. Compute knockout/soft flags against vacancy's configured rules. Write both `screening_answers` and `screening_flags` columns.

**New:**

- `lib/actions/public-apply.ts::getApplyFormConfig(token)` — server component data fetcher; returns vacancy details + ordered screening questions (no recruiter-only fields). Called from the apply page server component.

**Unchanged:**

- `/api/parse-cv` — same
- Status page query — same

### 5.3 Routes

| Route | Status | Action |
|---|---|---|
| `/jobs/[slug]` | KEEP | Restyle only |
| `/apply/[token]` | KEEP | Add screening section + confirmation card; restyle CTAs |
| `/status/[token]` | KEEP | Restyle stepper + add terminal-state tiles |

---

## 6. Effort estimate

### 6.1 Wave 3.2 — Public pages polish

| Task | Effort | Reuse |
|---|---|---|
| Listing — brand bar + role count + brand-blue Apply CTA | `S` | Page restyle |
| Apply page — header card restyle | `S` | Page restyle |
| Apply form — restyle to design system + brand-blue submit | `S` | ApplyForm component |
| **Screening questions renderer** | `M` | New |
| Per-answer-type input components (yes-no / number / short-text / select) | `S` | New |
| Server-side screening flag computation | `S` | New rules engine |
| `submitPublicApplication` accept + persist screening answers | `S` | Modify existing |
| `applications.screening_answers` + `screening_flags` migration | `S` | New columns |
| `getApplyFormConfig` server action | `S` | New |
| Confirmation card with track + listing links | `S` | New |
| Status page — restyle stepper to design palette | `S` | Existing component |
| Status page — terminal state tiles (hired / withdrawn / expired) | `S` | New variants |
| Status page — offer-pending state with `/offer/<token>` link | `S` | New variant |
| Mobile responsive — listing single-column on phone | `S` | CSS |
| Mobile responsive — apply form per `mobile/apply-form.md` | `M` | New mobile-specific UX |

**Wave 3.2 total: ~M-L** (3 weeks elapsed).

### 6.2 Coordination

- Depends on **Wave 2.5 scorecard** (`vacancy_questions.kind` + `screening_answer_type` columns)
- Depends on **S04 apply form tab** (the recruiter-side configuration of which screening questions to ask)
- Coordinates with **S02 candidate profile** (Screening contextual block consumes `screening_flags`)
- Coordinates with **S5c Public offer** (status page "Open offer →" link)
- Mobile work follows [`mobile/apply-form.md`](../mobile/apply-form.md) spec verbatim

---

## 7. Open questions

### 7.1 RESOLVED via locked decisions

| Question | Status |
|---|---|
| Screening questions | ✅ Q12 → render on apply form; flag knockouts internally; don't block submit |
| Greenfield | ✅ Q14 → no migration of existing tokens / applications |
| Status page preservation | ✅ G-022 withdraw preserved |
| Mobile | ✅ `mobile/apply-form.md` spec locked |

### 7.2 NEW — surfaced by this analysis

- **Q-S5-a:** **Screening question reordering by candidate** — should screening Qs render in the recruiter's configured order, or grouped by type (knockouts first / soft second / informational last)? *Lean: recruiter's configured order* — matches the live preview on the S04 Apply form tab; preserves recruiter intent.
- **Q-S5-b:** **Camera-as-CV-source on mobile** — flagged in [`mobile/apply-form.md` Open Q 1](../mobile/apply-form.md#open-questions). Ship in v1 (require `/api/parse-cv` to accept image) or v1.1? *Lean: v1.1* — image-to-text adds parser complexity; ship without it first.
- **Q-S5-c:** **Confirmation card "Track your application" link** — always show, or only if org has explicitly enabled the status feature? *Lean: always show* — feature is on by default for all orgs; saves an org-level toggle. Match audit's Q9 "Settings → Notifications" pattern of inferring sensible defaults.
- **Q-S5-d:** **Listing page role count display** — "3 roles" simple count, or break down by department? *Lean: simple count* — too much detail clutters the org page; let candidates explore by clicking through.
- **Q-S5-e:** **Status page offer-pending state link** — should it deep-link directly to `/offer/<token>` (skip the read-only confirmation tile) or stay informational? *Lean: deep-link* — candidate has already received an offer email; status page mention is a backup.
- **Q-S5-f:** **Screening Q maximum count per vacancy** — spec doesn't cap. *Lean: cap at 10* — beyond that the apply form gets long and tiring on phones. Matches the pipeline-stages cap-10 pattern (Q3).
- **Q-S5-g:** **Re-apply after withdrawal** — if a candidate withdraws and the same email re-applies to the same vacancy, allow or block? *Lean: allow* — duplicate-detection on email merges with the withdrawn application (per Q10 same-vacancy collision rule). A new application replaces the withdrawn one in status.
- **Q-S5-h:** **GDPR notice expansion on mobile** — per `mobile/apply-form.md` it's collapsed to a "ⓘ Your data" pill. On desktop it's currently always-visible paragraph. *Lean: collapse-by-default everywhere* — desktop too. Saves ~150px of vertical space; mobile has it right.

---

## 8. Test plan

### 8.1 Functional — `/jobs/[slug]`

- [ ] Listing renders for org with public_page_slug set
- [ ] Listing falls back to UUID public_page_token (backward compat)
- [ ] Brand-blue bar + role count display
- [ ] Only `status=open` + `show_on_public_page=true` + `application_form_token` set vacancies appear
- [ ] Role card click → `/apply/[token]`
- [ ] "Apply →" in brand blue
- [ ] Empty state when 0 vacancies
- [ ] Footer "Powered by HRHandle" shown
- [ ] Mobile single-column layout

### 8.2 Functional — `/apply/[token]`

- [ ] Apply page renders with vacancy header
- [ ] Closed-vacancy state when `status != 'open'` or `archived_at` set
- [ ] CV upload + parse + field prefill
- [ ] CV parse failure falls back gracefully
- [ ] Screening section renders only if vacancy has screening_questions
- [ ] Screening Qs render in recruiter-configured order
- [ ] yes_no_knockout: two-button toggle, required validation
- [ ] number: numeric input with helper, soft validation
- [ ] short_text: single-line input
- [ ] select: single-select dropdown
- [ ] Submit with knockout answer wrong still succeeds (no block)
- [ ] Submit persists screening_answers JSONB
- [ ] Submit computes and persists screening_flags
- [ ] GDPR notice present (collapsed per Q-S5-h)
- [ ] Turnstile invisible captcha
- [ ] Submit creates candidate (or links via duplicate detection)
- [ ] Submit creates application
- [ ] Confirmation card renders post-submit
- [ ] "Track your application" link to /status/<token>
- [ ] "View other open roles" link to /jobs/<slug> when slug set
- [ ] Mobile per `mobile/apply-form.md`

### 8.3 Functional — `/status/[token]`

- [ ] Status page renders with bucket only
- [ ] Internal stage names never visible
- [ ] Stepper highlights current bucket
- [ ] Last updated timestamp shown
- [ ] G-022 withdraw button visible for non-terminal states
- [ ] Withdraw confirmation modal works
- [ ] Withdraw triggers activity log on recruiter side
- [ ] Hired tile renders with start date
- [ ] Rejected tile is neutral gray (no internal reason)
- [ ] Withdrawn tile renders with date
- [ ] Expired tile when vacancy closed
- [ ] Offer-pending tile with link to /offer/<token>
- [ ] 404 on missing token (no oracle)
- [ ] Mobile responsive

### 8.4 Non-functional

- [ ] Listing page < 1s cold load
- [ ] Apply page CV parse < 5s on 10-page CV
- [ ] All public pages indexable (Robots.txt allows; status page noindex'd)
- [ ] JSON-LD JobPosting validates per Google's tool
- [ ] No PII leaks in error responses

### 8.5 Regression

- [ ] Existing public_page_token UUID slugs still work (backward compat)
- [ ] Existing application_form_token tokens still work
- [ ] Existing applications.public_token tokens still work
- [ ] CV parse pipeline unchanged
- [ ] Turnstile fails-open with warning when unset
- [ ] M-006 CV parse failure type distinction (network vs file)
- [ ] BL-009 settings redirects (no impact on public)

---

## 9. Verification

Aligned with [`docs/claude-code-workflow.md`](../../claude-code-workflow.md) Phase 5:

- [ ] All sub-tasks in §6 complete
- [ ] Tests in §8 pass
- [ ] Docs updated:
  - [ ] `docs/3-architecture/frontend.md` — three public surfaces
  - [ ] `docs/3-architecture/backend.md` — `submitPublicApplication` signature change, `getApplyFormConfig` new
  - [ ] `docs/3-architecture/database.md` — `applications.screening_answers` + `screening_flags` columns
  - [ ] `docs/9-compliance/gdpr.md` — confirm Article 13 notice unchanged
  - [ ] `docs/8-decisions.md` — Q-S5-a through Q-S5-h decisions
  - [ ] `docs/ui-texts.md` — new copy
- [ ] Ripple check — recruiter-side screening contextual block (S02) reads `screening_flags`

---

## 10. What to do after reading

1. **Confirm Q-S5-a through Q-S5-h** (or override).
2. **Decide on Q-S5-h (GDPR collapse everywhere)** — meaningful UX change; quick decision.
3. **Next flow doc:** **S5c Public offer** — small (~2500 words), tightly scoped, builds on the offer-pending state from this doc.

---

## Appendix — file inventory for this flow

**New files:**

| File | Purpose |
|---|---|
| `components/apply/screening-questions-section.tsx` | New — renders the screening Qs section |
| `components/apply/screening-yes-no-toggle.tsx` | New |
| `components/apply/screening-number-input.tsx` | New |
| `components/apply/screening-short-text-input.tsx` | New |
| `components/apply/screening-select.tsx` | New |
| `components/apply/apply-confirmation-card.tsx` | New — replaces inline confirmation |
| `components/status/status-state-tile.tsx` | New — terminal-state tiles |
| `lib/actions/public-apply-config.ts` | New — `getApplyFormConfig` |
| `lib/screening/compute-flags.ts` | New — knockout / soft flag rules |
| `scripts/053_applications_screening_columns.sql` | New migration |

**Modified files:**

| File | Change |
|---|---|
| `app/jobs/[slug]/page.tsx` | Add brand bar + role count + brand-blue CTA |
| `app/apply/[token]/page.tsx` | Server-side fetch screening Qs + thread through to ApplyForm |
| `app/status/[token]/page.tsx` | Add state-specific tiles + restyle stepper |
| `components/apply/apply-form.tsx` | Render screening section between fields and GDPR; restyle submit; collapse GDPR notice per Q-S5-h |
| `components/status/status-stepper.tsx` | Design-system palette |
| `lib/actions/public-apply.ts::submitPublicApplication` | Accept screening_answers, compute flags, persist both |

**Docs touched:**
- `docs/3-architecture/frontend.md`
- `docs/3-architecture/backend.md`
- `docs/3-architecture/database.md`
- `docs/9-compliance/gdpr.md`
- `docs/8-decisions.md`
- `docs/ui-texts.md`

**Tests added:**
- `tests/components/apply/screening-questions-section.test.tsx` — all 4 answer types
- `tests/components/apply/apply-confirmation-card.test.tsx`
- `tests/components/status/status-state-tile.test.tsx` — 4 terminal states
- `tests/lib/screening/compute-flags.test.ts` — knockout + soft rules
- `tests/lib/actions/public-apply.test.ts` — extended with screening flow
