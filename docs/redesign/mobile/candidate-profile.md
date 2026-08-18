# Mobile design — Candidate profile (`/candidates/[id]`)

> **Why this matters.** Recruiters and hiring managers check candidate profiles on phones — during a commute, between meetings, to verify a name before a call. The current page is a 2-column grid (1fr / 400px) designed for desktop. The redesign's mobile guidance is "rail collapses below content" — accurate but underspecified.
>
> **References:** Current implementation at [`app/(dashboard)/candidates/[id]/page.tsx`](../../../app/(dashboard)/candidates/[id]/page.tsx). Desktop redesign in [`redesign/Candidate Profile A Refined.dc.html`](../../../redesign/Candidate%20Profile%20A%20Refined.dc.html). Audit at [`audit.md` §4.2](../audit.md#42-·-s2-·-candidate-profile-candidate-profile-a-refineddchtml).

---

## Target devices

Same as apply-form: 375–414px primary. **But** profile pages are also opened on tablets and small laptops during interviews; treat 768px as a hard breakpoint where the desktop two-column layout returns.

---

## Layout sketch — portrait phone

```
┌─────────────────────────────────┐
│ ←  Alex Merabishvili    ⋯ Edit  │  ← compact header. Status pill INSIDE name row.
│    Active · 1 live application  │  ← derived status (post Wave 1.1)
│    Senior Eng at Acme Inc.      │
└─────────────────────────────────┘
                                   ← summary strip becomes horizontal-scroll chips
┌─────────────────────────────────┐
│ 📍 SF · 🕐 PST · 💬 EN, RU      │
│ 💰 €80k · ⏱ 4 weeks · 8 yrs    │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ APPLICATION                     │  ← single visible application; selector below if N>1
│ ┌─────────────────────────────┐ │
│ │ Senior Engineer · Acme      │ │
│ │ Applied 12d ago · Interview │ │
│ │ ┌───────────────────────┐   │ │
│ │ │ Switch application ▼  │   │ │  ← only if N>1; otherwise hidden
│ │ └───────────────────────┘   │ │
│ └─────────────────────────────┘ │
│                                 │
│ [Advance to Offer]              │  ← primary action, brand-blue, full-width
│ [Schedule] [Email] [Reject…]    │  ← secondary actions in 3-up row
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ ▼ Stage block (Interview)       │  ← contextual; collapsible
│ Next interview: Tue 12:30       │
│ [Join meeting] [Reschedule]     │
│ Add scorecard                   │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ ▼ Experience (3)                │  ← collapsed by default on mobile
│   Senior Eng @ Acme   2022–now  │
│   …                             │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ ▼ Education (1)                 │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ ▼ Documents (2)                 │
│   📄 alex-cv.pdf                │
│   📄 portfolio.pdf              │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ ▼ Contact                       │
│   alex@example.com              │
│   +1 555 123 4567               │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Notes & activity                │  ← always expanded — primary use case
│ [Add a note…  @mention          │
│  available ]                    │
│                                 │
│ ─ Activity ──────────────────── │
│ 2d ago · Status → Interview     │
│ 5d ago · Note by Sophia: "…"    │
└─────────────────────────────────┘
```

---

## Behavior — the design decisions

### Header

- **Status pill on the same row as the name** — saves vertical space. If the derived status is "Active · 1 live application", the application count is a tiny secondary line below the name, never inline.
- **`⋯` and `Edit`** stay in the header but `⋯` opens a bottom sheet (not a dropdown — dropdowns on iOS are hard to dismiss).
- **Back button** is `←` chevron only, no "Candidates" label — saves horizontal space for the name.

### The "stage-contextual block" — bottom sheet, not inline

Per the desktop redesign, the stage block swaps between Screening / Interview / Offer / Standard. On desktop it's a 600px-wide inline block. On mobile that's a tall inline block that pushes everything down.

**Recommended:** stage-contextual block is **inline but collapsible by default**, opening to a slide-up bottom sheet for the action-heavy stages (Interview scorecard, Offer creation form). This solves two problems:

1. Scorecards are tall (5–8 attributes × ~80px each). As inline blocks they dwarf the rest of the page.
2. Action-heavy forms benefit from the modal-like focus of a bottom sheet.

Bottom-sheet pattern:
- Drag handle at top, swipe-down to dismiss.
- Backdrop scrim covers the page behind.
- Sheet height max 85% viewport.
- Sticky primary button at sheet bottom.

### Single active application by default

Most candidates have one live application. Showing a selector for the common case is friction. **Only render the application-selector chip when N > 1.** When N = 1, just render the application directly with the per-app `⋯` menu accessible from the application card.

### Collapsible sections

Desktop shows experience, education, documents, contact all expanded. On mobile, **collapse all by default below Application + Activity** — the user is here for a reason; reading 12 jobs of experience inline is rare.

Exception: **Notes & activity is always expanded** on mobile. It's the most common reason someone opens a profile on phone ("what did we last discuss with this candidate?").

### Right rail dissolves into left-column blocks

The desktop right rail (Actions / AI summary / Documents / Details / Contact / Custom fields) becomes individual collapsible cards in the single-column flow. Order from top:

1. Application + actions (primary)
2. Stage block (contextual)
3. Experience
4. Education
5. Documents
6. Contact
7. Custom fields (if any)
8. Notes & activity (always expanded)

The AI summary and "Structure interview notes" actions live behind a single "AI tools ✨" link near the activity composer, expanding to a small action sheet — not their own cards. Saves three card slots; AI is on-demand anyway per S10.

---

## Action priority for thumb reach

The bottom 33% of the viewport is the thumb zone. Place primary action there:

- **"Advance to [Next stage]"** is the most common action and gets the brand-blue full-width button.
- Schedule / Email / Reject are secondary; row of three under Advance.
- Reject is **never first or red-as-default**; sit in the row, but use a destructive style only after opening the rejection dialog.

If the user scrolls past the application card, the **Advance button stays sticky at the bottom edge** of the viewport with a thin shadow above. Swipe-down on the sticky button collapses it to a small floating chip ("Advance").

---

## Gestures

- **Pull-to-refresh** on the page → refetches the candidate.
- **Swipe back from left edge** → standard iOS / Android back navigation (don't override).
- **Long-press on the application card** → opens the per-app `⋯` menu as a bottom sheet (Copy public status link / Remove from vacancy).
- **Swipe down on a bottom sheet** → close.

---

## States

| State | Treatment |
|---|---|
| Loading | Skeleton for header + first card; below-fold is lazy-loaded |
| No active applications (only closed) | Header status shows "Archived"; primary block shows "Application history" instead of action card |
| Repeat applicant | Amber banner inserted between summary strip and Application card; tappable to expand to detail |
| Hired | Header status shows "Hired (Role)"; primary action row hidden — replaced with single "View offer" link |
| Error fetching candidate | Standard error card with "Try again" |

---

## What's not on mobile

- **Side-by-side scorecards** (multiple reviewers' scorecards next to each other) — desktop-only. On mobile, scorecards are stacked vertically in the scorecard sheet.
- **Multi-column custom field rendering** — single column always.
- **Drag-reorder for any list** (experience entries, education) — desktop-only.

---

## Open questions

1. Bottom sheet vs inline for scorecard — would the user accept a different UX on mobile vs desktop here?
2. Where does the "Add to vacancy" action live on mobile? Header `⋯` menu? Or floating action chip?
3. Activity feed pagination — load all, or paginate? At 200+ activity items, loading-all is slow on cellular.
4. Merge candidates (header `⋯` action) — undefined feature; spec needed before mobile design.
