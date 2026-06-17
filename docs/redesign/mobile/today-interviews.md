# Mobile design — Today's interviews

> **Why this matters.** Recruiters check today's interviews between back-to-back meetings, on the way to a room, walking to coffee. "What's next?" is the question. The redesign drops the Dashboard (or maybe doesn't — see [`audit.md` §2.1](../audit.md#21-🔴-today-dashboard-is-in-three-states-at-once)). Whatever owns "today's interviews" needs a real mobile design — and right now it has none.
>
> **References:** Current Dashboard at [`app/(dashboard)/dashboard/page.tsx`](../../../app/(dashboard)/dashboard/page.tsx) shows "Upcoming Interviews" card (next 5 scheduled). Current Interviews list at [`app/(dashboard)/interviews/page.tsx`](../../../app/(dashboard)/interviews/page.tsx) is desktop-table-first.

---

## Target devices

Phone-primary. **Lock screen widget** worth considering for v2 but out of scope for v1.

---

## The "where does this live" question

Three candidate homes for "today's interviews on mobile":

| Option | Pros | Cons |
|---|---|---|
| **A** — A new "Today" mobile-first surface (the dropped dashboard, reborn) | Clear home for time-sensitive info; can grow to include offers awaiting reply, new applicants, etc. | New screen, conflicts with §2.1 ambiguity |
| **B** — Interviews list page with a "Today" filter pinned to top | Reuses existing route; no new screen | Filter is buried; on mobile, the "what's next" use case is so primary it shouldn't need a filter tap |
| **C** — Mobile-only home screen that's different from desktop dashboard | Solves the mobile use case without committing to a desktop "Today" | Two product surfaces to maintain |

**Recommendation:** **B as the launch path** (low risk), **A as the post-launch goal** (resolve §2.1 first). This doc sketches both.

---

## Layout sketch — Option A (Today screen)

```
┌─────────────────────────────────┐
│  Today                          │
│  Tuesday, June 16               │
└─────────────────────────────────┘

┌─────────────────────────────────┐  ← interviews
│  📅 Interviews · 3 today        │
│  ─────────────────────────────  │
│  10:00 — 10:30                  │
│  🎥 Video · Senior Eng          │
│  Alex Merabishvili              │
│  [Join meeting →]               │
│  ─────────────────────────────  │
│  13:00 — 14:00                  │
│  🎥 Video · Senior Eng          │
│  Sarah Chen                     │
│  [Join meeting →]               │
│  ─────────────────────────────  │
│  16:00 — 16:30                  │
│  📞 Phone · Marketing Lead      │
│  Maria Lopez                    │
└─────────────────────────────────┘

┌─────────────────────────────────┐  ← offers
│  📨 Offers awaiting reply · 2   │
│  ─────────────────────────────  │
│  Alex M. · sent 5d ago          │
│  Maria L. · sent 2d ago         │
└─────────────────────────────────┘

┌─────────────────────────────────┐  ← new applicants
│  👋 New applicants · 7          │
│  [Review new →]                 │  ← takes you to Review mode if on mobile
└─────────────────────────────────┘

┌─────────────────────────────────┐  ← stale candidates (optional, collapsible)
│  ⏰ Stale > 5d · 4              │
└─────────────────────────────────┘
```

### Interview card priority

Top-to-bottom by time. Past interviews of the day stay in the list but dim (50% opacity) — useful context ("did I do the 10am?"). Cards with `google_meet_link` or `meeting_link` get an explicit "Join meeting →" CTA. Cards without (in-person, phone) show the type label only.

### Behaviors

- **Tap an interview card** → opens candidate profile with the application context.
- **Tap "Join meeting"** → opens the meet link in the device's preferred app (Google Meet app, Zoom app, etc.).
- **Pull-to-refresh** → refetches the day's data.
- **Auto-refresh** every 5 minutes while the screen is foregrounded.

---

## Layout sketch — Option B (Interviews list with Today pinned)

```
┌─────────────────────────────────┐
│ ←  Interviews             [+]   │
└─────────────────────────────────┘

┌─────────────────────────────────┐  ← Today section, always at top, always expanded
│  Today · 3                      │
│                                 │
│  10:00 · Alex M. · Sr Eng       │
│  [Join →]                       │
│  ─────────────────────────────  │
│  13:00 · Sarah C. · Sr Eng      │
│  [Join →]                       │
│  ─────────────────────────────  │
│  16:00 · Maria L. · Marketing   │
└─────────────────────────────────┘

[Tomorrow ▼]                       ← collapsed by default
[This week ▼]
[Past ▼]
[All scheduled ▼]
```

Filter tabs from the desktop (`All / Scheduled / Past / Cancelled / No-show`) collapse into the expandable sections. **No status filter on mobile by default** — recruiters here are looking forward, not back.

The "+" header button opens the new-interview form. On mobile, this should pre-fill today's date as the default.

---

## Card structure

A single interview card on either Option A or B:

```
┌─────────────────────────────────┐
│  10:00 — 10:30 · 30 min         │
│  🎥 Video Interview             │
│                                 │
│  Alex Merabishvili              │
│  Senior Engineer (Acme)         │
│                                 │
│  Interviewer: Sophia M.         │
│                                 │
│  [Join meeting →]    [⋯]        │
└─────────────────────────────────┘
```

- Time first (most important).
- Type icon + label.
- Candidate name + role.
- Interviewer (matters for handoff).
- Primary CTA: Join (if link) or "View details" (if not).
- `⋯` menu: Reschedule / Cancel / Email candidate.

---

## States

| State | Treatment |
|---|---|
| Loading | Skeleton for sections + first few cards |
| No interviews today | "🎉 No interviews today" + quick link to schedule one |
| All interviews of the day are past | Show them but at 50% opacity; insert "All done for today" note |
| Network failure | Inline retry banner, doesn't block scroll |
| Cancelled / no-show interview | Render the card with `line-through` style + cancel badge; below today's section, not above |

---

## Edge cases

- **Timezone:** All times in the user's local timezone (current behavior). When a recruiter is traveling, the device timezone is the truth.
- **Same-time-different-candidates:** Two interviews at 10:00 — possible with multi-interviewer setups. Render both, no visual collision warning (the recruiter is aware).
- **Interview with no candidate** (data integrity edge case): show "Unknown candidate" — current behavior preserved.
- **Past-due interview status:** if an interview is `scheduled` but its time has passed by > 1 hour, surface a thin "Mark complete or no-show?" prompt on the card.

---

## What's not on mobile

- **Bulk-reschedule** — desktop only.
- **Multi-select on the list** — desktop only.
- **Interview history beyond ~30 days** — desktop only. Mobile shows "Past · this month" by default; older requires desktop or explicit "show older" tap.

---

## Notifications integration

If the org has G-030 webhooks configured, the same Slack/Teams notifications cover this. The mobile Today screen is the **canonical** in-product surface; webhooks are the secondary push.

Push notifications to the device itself are out of scope (would require service worker + push subscription + per-user opt-in). Worth a v2 line.

---

## Open questions

1. Option A vs Option B for v1?
2. If Option A — does it appear on desktop too (as the dropped/revived Dashboard)? See §2.1 ambiguity.
3. Stale-candidates threshold — 5d, 7d, configurable?
4. New-applicants count — does tapping it open Review mode (S1) or the candidate list filtered to status=Applied?
5. Lock-screen widget (iOS WidgetKit / Android App Widget) — v2 scope?
