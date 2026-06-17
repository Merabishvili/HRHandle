# S9 · Interview scheduling — flow analysis

> **Status:** Draft 1, authored 2026-06-17. Smallest of the flow docs — the existing surface is closer to the spec than any other.
>
> **Sources:** [`Interview Scheduling.dc.html`](../../../redesign/Interview%20Scheduling.dc.html), [`audit.md` §4.12](../audit.md#412-·-s9-·-interview-scheduling-interview-schedulingdchtml). Mobile: handled via [`mobile/today-interviews.md`](../mobile/today-interviews.md) for the view side; scheduling is desktop-primary.
>
> **Why this is fifth.** Per [S02 §10](S02-candidate-profile.md#10-what-to-do-after-reading) recommendation — small doc, mostly polish, useful breather between the heavier S04/S04d/S02/S2 rebuilds and the public-facing trio. The audit confirms: *"current code accepts both pre-fill orderings; the redesign locks the default entry to candidate-first. That's a UX nudge, not a rebuild."*

---

## 1. Current implementation

### Routes

| Route | File | Lines | Pattern |
|---|---|---|---|
| `/interviews/new` | [`app/(dashboard)/interviews/new/page.tsx`](../../../app/(dashboard)/interviews/new/page.tsx) | 165 | Server-side data fetch + render `<InterviewForm />` |

URL params accepted: `?candidate=<id>` and `?vacancy=<id>`. Both optional. Pre-fill the form pickers.

### Form component

| Component | File | Lines |
|---|---|---|
| `InterviewForm` | [`components/interviews/interview-form.tsx`](../../../components/interviews/interview-form.tsx) | **516** |

Fields:
- Candidate (dropdown, searchable)
- Vacancy (dropdown, filtered to `open` or `draft` statuses)
- Type (radio: `phone` / `video` / `onsite`)
- Date + Time + Duration (minutes)
- Interviewer (dropdown of org members from `profiles`)
- Notes (textarea, candidate-facing optional message)
- Hidden: `application_id` (resolved from candidate + vacancy)
- Hidden flags: `hasGoogleCalendar`, `hasZoom`, `hasMicrosoft` (from user's profile refresh tokens)
- Toggle: "Email the candidate" (boolean)

Behavior:
- Type = `video` → checks for connected calendar provider; auto-generates meeting link
- Submit → `createInterview()` server action
- `createInterview` returns `{ id, meetLink, warnings: string[] }` per recent audit work (M-006 / interview error handling)

### Server actions touched

| Action | File | Notes |
|---|---|---|
| `createInterview` | [`lib/actions/interviews.ts`](../../../lib/actions/interviews.ts) | Already returns `{id, meetLink, warnings}`. Calls Google / Zoom / Microsoft based on user's connected provider. Falls back to no link if unconnected. |
| `updateInterviewStatus(id, 'cancelled')` | Same | Already does best-effort cleanup (deleteCalendarEvent + deleteZoomMeeting) per recent audit work |

### Calendar integrations (existing)

Per [`CLAUDE.md`](../../../CLAUDE.md) + recent audit work:

- **Google Calendar** — `profiles.google_refresh_token`, auto-creates Google Meet link
- **Zoom** — `profiles.zoom_refresh_token`, auto-creates Zoom meeting
- **Microsoft Teams** — `profiles.microsoft_refresh_token`, auto-creates Teams meeting
- **Calendly (G-031)** — separate org-level OAuth; recruiter generates UTM-tagged scheduling link from candidate profile; webhook fires back to create the interview row. Different surface — not the `/interviews/new` form.

### Related list page

[`app/(dashboard)/interviews/page.tsx`](../../../app/(dashboard)/interviews/page.tsx) — 298 lines. The Interviews list with filters (Scheduled / Past / Cancelled / No-show), Join links, status pills. **Audit §4.11** notes the list is already feature-complete; S8 Reports flow covers its restyling.

---

## 2. Proposed redesign

The audit's framing — *"a UX nudge, not a rebuild"* — holds. The design polishes the form into two clear contexts:

### 2.1 Context A — launched from a candidate/pipeline (pre-filled)

When the URL has `?candidate=<id>` (or `?candidate=<id>&vacancy=<id>`):

**Breadcrumb:** `Alex Brown ›  Schedule interview` — links back to candidate profile.

**Layout:** two-column with form left + right rail (340px).

**Form fields (left):**

```
Candidate
┌─────────────────────────────────────────────────────────┐
│ [AM]  Alex Brown                       Pre-filled ✓     │
│       Senior Business Analyst · Screening               │
└─────────────────────────────────────────────────────────┘
    (rendered as read-only card, NOT a dropdown)

Vacancy
┌─────────────────────────────────────────────────────────┐
│ Senior Business Analyst   from this application         │
└─────────────────────────────────────────────────────────┘
    (rendered as labeled read-only row when derived from app)

Interview type
[🎥 Video (selected)]  [📞 Phone]  [🏢 On-site]
    (segmented control — replaces current radio buttons)

Date         Time      Duration
[Jun 15, '26][14:00]   [60 min]

Interviewer
[Nino Beridze ▾]

Notes for the candidate (optional)
[Anything they should prepare or bring…]
```

**Right rail:**

```
┌─ Google Calendar connected ────────────────────────────┐
│ A Google Meet link will be created automatically and   │
│ added to both calendars. Switch in Settings →          │
│ Integrations.                                          │
└────────────────────────────────────────────────────────┘

SUMMARY
  When         Mon Jun 15, 14:00
  Duration     60 min
  Type         Video · Meet
  With         Nino Beridze

┌─ Email the candidate ──────────────────────────────────┐
│ Send invite + Meet link now              [● on]       │
└────────────────────────────────────────────────────────┘

[Cancel]      [Schedule interview]
```

**Auto-derive behaviors:**
- If candidate has exactly **one live application**, vacancy auto-derives from it.
- If candidate has multiple live applications, vacancy field shows a dropdown limited to those vacancies + helper "Pick which application this interview is for."
- If candidate has **no** live application, show inline warning "This candidate isn't in any pipeline yet — add them to a vacancy first" with a link to the candidate profile's `+ Add to vacancy` action.

### 2.2 Context B — standalone entry (from `/interviews` → "Schedule")

No pre-fill. Both pickers at top:

```
New interview
┌──────────────────────┐  ┌──────────────────────┐
│ Candidate            │  │ Vacancy              │
│ [Search candidates…] │  │ [Select vacancy ▾]   │
└──────────────────────┘  └──────────────────────┘
ⓘ  Picking a candidate who's already in a pipeline
   auto-fills the vacancy. The rest of the form is
   identical to above.
```

After both are picked → form renders identically to Context A (without the breadcrumb + pre-filled candidate card; just the dropdowns at top).

### 2.3 Connected-calendar banner — copy variants

The right-rail banner adapts based on what's connected:

| Connected | Banner | Meeting link generated |
|---|---|---|
| Google only | "Google Calendar connected — A Google Meet link will be created automatically and added to both calendars." | Google Meet |
| Zoom only | "Zoom connected — A Zoom meeting will be created automatically with one-click join." | Zoom |
| Microsoft only | "Microsoft 365 connected — A Teams meeting will be created automatically." | Teams |
| Multiple | Show **provider picker** in banner: "Use [Google Meet ▾]". Default = whichever was connected first. | User-picked |
| None | Amber: "No calendar connected — you'll need to add a meeting link manually after scheduling." [Connect →] | None (manual paste) |
| Phone / On-site type | Banner hides (no link needed) | N/A |

### 2.4 Field-level changes vs today

| Field | Today | New |
|---|---|---|
| Candidate | Dropdown always | Read-only card when pre-filled |
| Vacancy | Dropdown always | Read-only label "from this application" when derived; dropdown when multiple live apps |
| Type | Radio (`phone`, `video`, `onsite`) | Segmented control with icons |
| Date / Time / Duration | Inline | Same, restyled |
| Interviewer | Dropdown | Same |
| Notes | Textarea | Same |
| Meeting link | Hidden field; auto-populated | Right-rail banner makes it explicit; provider-picker if multiple connected |
| Email candidate | Toggle | Same, moved into right rail |
| Submit | Bottom of form | Right rail bottom action |

### 2.5 Stage-aware scheduling (per Q3 locked + S02)

Per locked Q3 (per-vacancy `pipeline_stages` with type-restricted enum) + S02 multi-round interview support:

- When scheduling for a candidate in an **Interview-type** stage, the scheduled interview is associated with the current `pipeline_stages.id` (not just `application_id`).
- This enables multi-round support — "HR Interview", "Technical Interview", "Final Interview" each have their own scheduled interview + scorecard.
- The candidate profile (per [S02 §2.5](S02-candidate-profile.md#25-stage-contextual-block-the-new-construct)) Interview-stage contextual block reads `interviews` filtered to current `pipeline_stage_id`.

Effect on the form: a new hidden field `pipeline_stage_id` populated automatically from the candidate's current application stage. No UI change — but the schema (`interviews.pipeline_stage_id`) needs the column.

### 2.6 What's NOT in scope for S9

Per the audit and the design's deliberate focus:

- **Calendar conflict detection** (showing the interviewer's other commitments at the chosen time) — flagged as gap, not designed, not v1.
- **Multi-attendee scheduling** (panel interviews where multiple interviewers attend) — out of scope. Single interviewer per scheduled interview for v1. (Hooks for v2: change `interviewer_id` to an array via a new junction table.)
- **Calendly self-scheduling flow** (G-031) — uses a separate org-level OAuth flow + recruiter-generated link from candidate profile. No changes here.
- **Recurring interviews** — out of scope.
- **Time-zone explicit picker** — uses recruiter's locale today; out of scope to surface the explicit picker.

---

## 3. Gaps, missing screens, edge cases

### 3.1 Missing screens

| Surface | Why missing | Recommended action |
|---|---|---|
| Multiple connected calendars — provider picker | Not drawn | Small inline select on the calendar banner per §2.3 |
| No-calendar-connected state on `video` type | Not drawn | Amber banner with [Connect →] link to `/settings/integrations` |
| Candidate not in any pipeline | Not drawn | Inline warning + link back to candidate profile's Add-to-vacancy |
| Multi-app candidate vacancy picker | Mentioned in audit §4.12 ("Spec doesn't address the standalone entry") | Dropdown limited to candidate's live applications |
| Edit existing interview | Not in scope of S9 design but route exists | Reuse same form pre-filled with existing interview data; submit reschedules; calendar event updates via existing logic per `updateInterviewStatus`-adjacent action |
| Interview slot already past | Not addressed | Confirm modal: "This time is in the past — schedule anyway? (Useful for logging completed interviews retroactively.)" |
| Confirmation post-schedule | Not drawn | Sonner toast: "Interview scheduled with [Candidate] on [date]" + link "View" → candidate profile |

### 3.2 Edge cases

| Case | Today | New |
|---|---|---|
| Recruiter has no connected calendar but picks `video` | Submit creates interview with empty `meeting_link` | Amber banner explicit; user can paste a manual link in a new optional field (TBD field) OR proceed without link |
| Email send fails | Returns `warnings: ['email_failed']` per recent audit work | Toast: "Interview scheduled, but the invitation email couldn't be sent" — already implemented |
| Google API quota hit (auto-link fails) | Returns `warnings` | Toast: "Interview scheduled; the Meet link will be added manually" — same pattern |
| Candidate is in 2 live apps with same vacancy (shouldn't happen, but…) | Today doesn't validate | Per duplicate-detection + merge work, this shouldn't be reachable. If it is: server returns clear error |
| Interviewer = the recruiter themselves | Today: allowed | Same — common case ("with you") |
| Interviewer = soft-deleted profile | Today: filtered out | Same — filter on query |
| Notes field exceeds reasonable length (~10K chars) | Not validated | Cap at 5,000 chars with counter |

### 3.3 Race conditions

- Recruiter A and Recruiter B both schedule with the same interviewer at the same time: both succeed independently; conflict detection is out of scope. Interviewer gets two calendar invites. Acceptable for v1.

---

## 4. Reuse opportunities

| Need | Reuse from | Notes |
|---|---|---|
| Form scaffolding | `InterviewForm` 516 LOC | Restructure but retain field components |
| Date/time picker | Existing `DatePicker` | Direct |
| Searchable candidate select | `SearchableSelect` (used in candidate-form) | Direct |
| Searchable vacancy select | Same | Direct |
| Interviewer dropdown | Existing select | Direct |
| `createInterview` server action | Existing in `lib/actions/interviews.ts` | Modify to accept optional `pipeline_stage_id` |
| Google Calendar auto-link | Existing `lib/google/calendar.ts` | Direct |
| Zoom auto-link | Existing `lib/zoom/meetings.ts` | Direct |
| Microsoft Teams auto-link | Existing `lib/microsoft/` | Direct |
| Cancel interview cleanup | Existing `updateInterviewStatus` → cleanup logic | Direct |
| Email send | Existing email infrastructure (Resend) | Direct |
| Type segmented control | New pattern — replaces radio | Small new component, reusable for other type-pickers |

**Net new code:**
- Read-only candidate card (renders pre-filled candidate)
- Calendar-banner component with provider variants
- Right-rail summary card (live-updates as form changes)
- Provider picker for multi-connected case
- "Stage-aware" hidden field wiring (auto-population of `pipeline_stage_id`)

---

## 5. DB / API changes

### 5.1 Schema

Per locked Q3 (per-vacancy custom stages, S04 Wave 2.6):

```sql
-- New column to associate an interview with a specific pipeline stage
-- (for multi-round support: HR / Technical / Final each have their own)
ALTER TABLE public.interviews
  ADD COLUMN pipeline_stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL;

-- Index for the candidate-profile Interview-stage block lookup
CREATE INDEX idx_interviews_application_stage
  ON public.interviews (application_id, pipeline_stage_id)
  WHERE status != 'cancelled';
```

No other schema changes. The interview model is otherwise mature.

### 5.2 Server actions

**Modified:**

- `createInterview(input)` — accept optional `pipeline_stage_id`; if not provided, server resolves from the current `applications.pipeline_stage_id`
- Multi-provider auto-link logic — when more than one provider connected, accept `preferred_provider: 'google' | 'zoom' | 'microsoft'` parameter

**Unchanged:**

- `updateInterviewStatus(id, status)` — cancel cleanup works as-is

**New:**

- Lightweight `lib/actions/interviews.ts::getCandidateApplicationsForScheduling(candidateId)` — returns the candidate's live applications + their current stage, so the vacancy picker can populate correctly when candidate is pre-filled but vacancy isn't

### 5.3 Routes

| Route | Status | Action |
|---|---|---|
| `/interviews/new` | KEEP | Restructured to two-column with right rail |
| `/interviews/[id]/edit` | OPTIONAL NEW | Reuse the same form for editing. Defer to v1.1 if the inline reschedule action on candidate profile is enough. |

---

## 6. Effort estimate

Per audit: this is the smallest flow rebuild in the whole redesign.

### 6.1 Tasks

| Task | Effort | Reuse |
|---|---|---|
| Restructure form into two-column layout | `S` | Existing form |
| Read-only candidate card component | `S` | New, ~30 LOC |
| Read-only vacancy label "from this application" | `S` | New, ~15 LOC |
| Type segmented control component | `S` | New, ~40 LOC |
| Right-rail calendar banner with provider variants | `S` | New, ~80 LOC |
| Right-rail live summary card | `S` | New, ~50 LOC |
| Right-rail email toggle move + actions | `S` | Existing toggle |
| Provider picker (when multiple connected) | `S` | New select |
| `interviews.pipeline_stage_id` migration | `S` | One-line migration |
| `createInterview` accept `pipeline_stage_id` + `preferred_provider` | `S` | Modify existing |
| `getCandidateApplicationsForScheduling` server action | `S` | New, small |
| Multi-app candidate vacancy picker | `S` | Conditional render |
| No-calendar amber banner | `S` | Banner variant |
| Past-time confirmation modal | `S` | AlertDialog |
| Notes 5K char counter | `S` | Counter component |
| Breadcrumb when candidate-pre-filled | `S` | Conditional render |

**Total: ~S-M** (1–2 weeks elapsed). Smallest flow in the redesign.

### 6.2 Coordination

- **Depends on Wave 2.6** (`pipeline_stages` table) for the multi-round stage-aware scheduling.
- **Depends on S02** (Interview-stage contextual block) for the consumption side — interviews are surfaced there.
- **Coordinates with S04** vacancy `[View pipeline →]` and "Needs attention" Overview card — both link into scheduling.
- **Coordinates with mobile** (`mobile/today-interviews.md`) — the schedule form is desktop-only; viewing today's interviews has its own mobile pattern.

---

## 7. Open questions

### 7.1 RESOLVED via locked decisions

| Question | Status |
|---|---|
| Form structure | ✅ Spec close to current; locked polish-not-rebuild |
| Type control | ✅ Segmented vs radio — locked segmented |
| Multi-round support | ✅ Q3 → per-vacancy stages enable; new `pipeline_stage_id` column |
| Calendly conflict | ✅ Out of scope (uses separate G-031 surface) |

### 7.2 NEW — surfaced by this analysis

- **Q-S9-a:** **No-calendar-connected video interview** — allow scheduling and let recruiter paste a manual link, or block until they connect? *Lean: allow + manual link field appears* — recruiters might use ad-hoc Whereby / Around links; don't gate on integration.
- **Q-S9-b:** **Multi-provider connected — default picker** — first-connected provider, or org-default setting? *Lean: first-connected* — simpler; org-default is a v1.1 setting.
- **Q-S9-c:** **Edit interview (reschedule)** — own page `/interviews/[id]/edit`, modal on candidate profile, or both? *Lean: modal on candidate profile only* — matches the redesign's "stage-contextual" pattern; reduces route surface.
- **Q-S9-d:** **Past-time scheduling** — allow with confirm, or block? *Lean: allow with confirm* — useful for retroactive logging of completed interviews; common in busy teams.
- **Q-S9-e:** **Interviewer = soft-deleted profile** mid-flight (interviewer left the org) — what happens to the existing scheduled interview? *Lean: show "Interviewer left organization" + Reschedule prompt* — defer logic to candidate profile contextual block.
- **Q-S9-f:** **Multi-application candidate** — when launching scheduling from candidate profile, do we auto-select the **currently-active** application or show a picker? *Lean: auto-select if S02 selector has a selection (URL `?app=`)*; otherwise picker.

---

## 8. Test plan

### 8.1 Functional

- [ ] `/interviews/new` renders standalone (both pickers)
- [ ] `/interviews/new?candidate=X` renders with candidate pre-filled card + vacancy derived
- [ ] `/interviews/new?candidate=X&vacancy=Y` renders with both pre-filled
- [ ] `/interviews/new?candidate=X` where candidate has multiple live apps shows vacancy dropdown
- [ ] `/interviews/new?candidate=X` where candidate has 0 live apps shows inline warning
- [ ] Type segmented control (video / phone / onsite) toggles
- [ ] Calendar banner shows when type = video
- [ ] Calendar banner hides when type = phone or onsite
- [ ] Banner variant matches connected providers
- [ ] Provider picker visible when multiple connected
- [ ] Amber "No calendar connected" when type = video and none connected
- [ ] Summary card updates live as form changes
- [ ] Email-the-candidate toggle defaults on
- [ ] Submit creates interview with all fields
- [ ] Submit returns toast on success
- [ ] Submit returns warning toast on email_failed
- [ ] Submit returns warning toast on auto-link failure
- [ ] Past-time selection prompts confirm
- [ ] `pipeline_stage_id` auto-populated from current app stage
- [ ] Cancel button returns to source (candidate profile or interviews list)

### 8.2 Non-functional

- [ ] Form renders < 500ms
- [ ] Submit + auto-link < 5s
- [ ] Email send happens async (doesn't block form submit)
- [ ] Keyboard navigation through all fields

### 8.3 Regression

- [ ] Existing scheduled interviews still display correctly post-`pipeline_stage_id` migration (column nullable)
- [ ] Calendar cancellation cleanup still works
- [ ] G-031 Calendly link generation from candidate profile unchanged
- [ ] Existing notification links to interviews still work

---

## 9. Verification

Aligned with [`docs/claude-code-workflow.md`](../../claude-code-workflow.md) Phase 5:

- [ ] All sub-tasks in §6 complete
- [ ] Tests in §8 pass
- [ ] Docs updated:
  - [ ] `docs/3-architecture/frontend.md` — restructured layout
  - [ ] `docs/3-architecture/backend.md` — new server action, modified `createInterview`
  - [ ] `docs/3-architecture/database.md` — `interviews.pipeline_stage_id` column
  - [ ] `docs/4-integrations/google.md` — Q-S9-b multi-provider defaulting
  - [ ] `docs/4-integrations/zoom.md` — same
  - [ ] `docs/8-decisions.md` — Q-S9-a/b/c/d/e/f decisions
  - [ ] `docs/ui-texts.md` — new banner copy variants
- [ ] Ripple check — candidate profile Interview-stage contextual block reads from new `pipeline_stage_id` column

---

## 10. What to do after reading

1. **Confirm the new Q-S9-a through Q-S9-f** answers (or override).
2. **Decide on edit-interview surface** — confirm Q-S9-c (modal on candidate profile only) so we don't need `/interviews/[id]/edit`.
3. **Next flow doc:** S5 Public pages (`/jobs/[slug]` + `/apply/[token]` + status page) — substantial spec for the public-facing apply form upgrade. Then S5c Public offer (quicker). Then S7 Settings, S8 Reports, S10 AI/terminology.

---

## Appendix — file inventory for this flow

**New files:**

| File | Purpose |
|---|---|
| `components/interviews/scheduled-candidate-card.tsx` | Read-only candidate card for pre-filled state |
| `components/interviews/interview-type-segmented.tsx` | New segmented control |
| `components/interviews/calendar-integration-banner.tsx` | Right-rail banner with provider variants + picker |
| `components/interviews/interview-summary-card.tsx` | Right-rail live summary |
| `lib/actions/interviews-scheduling.ts` | `getCandidateApplicationsForScheduling` helper |
| `scripts/052_interviews_pipeline_stage_id.sql` | New migration |

**Modified files:**

| File | Change |
|---|---|
| `app/(dashboard)/interviews/new/page.tsx` | Pass through additional data; layout unchanged here |
| `components/interviews/interview-form.tsx` | Restructure to two-column; lift sub-components; add provider picker; add segmented control |
| `lib/actions/interviews.ts::createInterview` | Accept `pipeline_stage_id` + `preferred_provider` |

**Docs touched:**
- `docs/3-architecture/frontend.md`
- `docs/3-architecture/backend.md`
- `docs/3-architecture/database.md`
- `docs/4-integrations/google.md`
- `docs/4-integrations/zoom.md`
- `docs/4-integrations/microsoft.md` (if exists)
- `docs/8-decisions.md`
- `docs/ui-texts.md`

**Tests added:**
- `tests/components/interviews/interview-form.test.tsx` — pre-fill + standalone + multi-app
- `tests/components/interviews/calendar-integration-banner.test.tsx` — provider variants
- `tests/lib/actions/interviews-scheduling.test.ts` — pipeline_stage_id resolution

---

**Net effect of S9:** the smallest flow rebuild in the package. Most of the work is restructuring the existing 516-line form into a two-column layout with a right rail summary, with one schema column for multi-round support. No new integrations, no major UX paradigm shifts.
