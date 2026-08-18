# Mobile design — Offer approval (`/offer/[token]`)

> **Why this matters.** Offer approval is the highest-stakes candidate-facing moment in the product. The candidate gets an email with a link and opens it on whatever device they have — almost always a phone. A clunky mobile experience here can lose an offer.
>
> **References:** Current implementation at [`app/offer/[token]/page.tsx`](../../../app/offer/[token]/page.tsx). Desktop redesign in [`redesign/Public Offer.dc.html`](../../../redesign/Public%20Offer.dc.html). Audit at [`audit.md` §4.8](../audit.md#48-·-s5c-·-public-offer-public-offerdchtml).

---

## Target devices

- **Primary:** 375–414px viewports. Portrait.
- **Special consideration:** Most offer emails are opened from native iOS Mail / Gmail / Outlook → handed off to Safari/Chrome. The page must render fast on cellular (LTE worst case).

---

## Layout sketch — state: `sent` (the only state the candidate normally sees)

```
┌─────────────────────────────────┐
│  Offer from Acme Inc.           │
│                                 │
│  Hi Alex,                       │
│  Here's your offer.             │
└─────────────────────────────────┘

┌─────────────────────────────────┐  ← hero summary tile — most important
│  Senior Engineer                │
│  Acme Inc.                      │
│  ─────────────────────────────  │
│  €120,000 / year                │
│  Start: Aug 1, 2026             │
│  ─────────────────────────────  │
│  ⏱ Respond by Jun 22 · 6 days   │  ← countdown
└─────────────────────────────────┘

┌─────────────────────────────────┐  ← optional recruiter note
│  💬 From Sophia                 │
│  "Looking forward to having you │
│   on the team! Let me know if   │
│   you have questions."          │
└─────────────────────────────────┘

┌─────────────────────────────────┐  ← offer body — the legalish bit
│  Full offer details             │
│                                 │
│  We're delighted to offer you   │
│  the position of Senior         │
│  Engineer at Acme Inc., with    │
│  the following terms…           │
│                                 │
│  [Show full offer ▼]            │  ← collapse long bodies on mobile
└─────────────────────────────────┘

   < scroll point — actions stick below >

┌─────────────────────────────────┐  ← sticky bottom action bar
│  [   Decline   ] [   Accept   ] │  ← Accept = brand-green; Decline = neutral
└─────────────────────────────────┘

  Sent 6 days ago · Keep this link private
```

---

## Behavior

### Sticky action bar — the design call

Per the redesign, Accept and Decline are the primary action. On a long-form offer page, these can sit far below the viewport. **Solution:** sticky bottom bar that:

- Appears immediately on page load (offer body is collapsed by default — see below).
- Remains visible during scroll.
- Sits above the safe-area inset.
- Background is solid white with thin top border (not transparent — must distinguish from offer text).

### Confirm-step (REDESIGN-DECISIONS §S5c locked decision)

Both Accept and Decline get a confirm step on mobile. **Accept** confirm is small ("Confirm you accept this offer?" → big Accept button + Cancel link). **Decline** confirm is bigger, with an optional message field:

```
┌─────────────────────────────────┐
│  Decline this offer?            │
│                                 │
│  Add a message (optional)       │
│  [                            ] │
│  [                            ] │  ← multi-line, 3 rows visible
│                                 │
│  [ Confirm decline ]            │
│  Cancel                         │
└─────────────────────────────────┘
```

Decline message goes to existing `offers.decline_reason` column (currently unused — wire on this PR).

### Countdown UI

Time-bounded offers (with `expiry_date`) show a countdown in the hero tile. Granularity rules:

- **> 24 hours away:** "Respond by Jun 22 · X days"
- **2–24 hours:** "Respond by Jun 22 · X hours" with amber color
- **< 2 hours:** "Respond by Jun 22 · X minutes" with amber color, slight pulse
- **Past:** State is `expired` — see below

Pulse only on the final 2 hours; constant flashing is hostile.

### Offer body — collapse on mobile

The offer body is plain text (markdown-rendered). For substantive offers it's 5–15 paragraphs. On mobile, **show the first 3 lines + "Show full offer ▼"** — collapsed by default. This pushes Accept/Decline visibly closer to the viewport top so users don't think they have to read everything to act.

The compensation, start date, and respond-by are already in the hero tile, so the body collapse doesn't hide critical info.

### Recruiter note placement

Above the offer body, below the hero. Always-visible. Optional field — if empty, hide the entire card. Visually distinct from the offer body (rounded card with `💬` accent) so it doesn't read as part of the offer terms.

---

## States

The `offers` table state machine has 5 states; mobile design for each:

### `sent` (the normal case)

Full design above. Sticky Accept/Decline bar.

### `accepted`

```
┌─────────────────────────────────┐
│  ✓ Offer accepted               │
│                                 │
│  You accepted on Jun 16 at      │
│  4:32 PM.                       │
│                                 │
│  Acme's HR team has been        │
│  notified. They'll be in touch  │
│  about next steps.              │
└─────────────────────────────────┘
```

Brand-green check. No actions. Hero tile still visible above for record.

### `declined`

```
┌─────────────────────────────────┐
│  Offer declined                 │
│                                 │
│  You declined this offer on     │
│  Jun 16. Thank you for letting  │
│  us know.                       │
└─────────────────────────────────┘
```

Neutral gray, not red. Declining is not a failure.

### `expired`

```
┌─────────────────────────────────┐
│  ⏱ This offer has expired      │
│                                 │
│  The respond-by date was Jun    │
│  10. Please reach out to        │
│  recruiter@acme.com if you'd    │
│  like to discuss.               │
└─────────────────────────────────┘
```

Amber. Show recruiter contact if available — the candidate may want to re-engage.

### `withdrawn`

```
┌─────────────────────────────────┐
│  Offer no longer available      │
│                                 │
│  Acme has withdrawn this offer. │
│  Please contact them for more   │
│  information.                   │
└─────────────────────────────────┘
```

Neutral, brief, no detail. The recruiter has out-of-band reasons; the candidate page shouldn't speculate.

---

## What about "Ask a question" as a third option?

[`audit.md` §4.8](../audit.md#48-·-s5c-·-public-offer-public-offerdchtml) flagged this as open. **Mobile recommendation:** include as a thin tertiary link **above** the sticky Accept/Decline bar, not in the bar itself.

```
                                 ↑ scroll
  ─ or [ Ask a question ] ─

┌─────────────────────────────────┐
│  [   Decline   ] [   Accept   ] │
└─────────────────────────────────┘
```

Tapping opens a small composer sheet that emails the offer's `created_by` recruiter. Saves wavering candidates without diluting the binary decision.

---

## States not directly visible to candidates

- `draft` — recruiter editing pre-send. Not reachable via the public URL ([line 199](../../../app/offer/[token]/page.tsx#L199) returns notFound).

---

## Performance — mobile-specific

- **Inline critical CSS** for above-fold (hero + first card). Offer page is served by Next.js → already efficient.
- **No images** in the offer body (markdown should strip or warn on image URLs).
- **No analytics tracking** scripts on the offer page — this is a candidate-facing legal-equivalent surface; avoid third-party scripts beyond Supabase.

---

## Gestures

- **Pull-to-refresh** disabled (terminal page state, no reason to refresh).
- **Pinch-to-zoom** allowed (a candidate may want to zoom in on numbers — never disable zoom on legal-text pages).
- **Long-press on hero tile values** → standard browser text-selection (so they can copy salary/date for their records).

---

## Open questions

1. "Ask a question" — is this in scope for v1, or v2?
2. Decline-message field — is it stored only, or also delivered to the recruiter via Slack/email notification?
3. Countdown when `expiry_date` is null — show no countdown? "Open-ended" badge?
4. Accept confirm — does the user get an email confirmation post-accept? Spec doesn't say.
5. PDF attachment in offer email — flagged as v2 in product roadmap. Confirm out of scope here.
