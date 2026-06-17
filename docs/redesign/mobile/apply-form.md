# Mobile design — Apply form (`/apply/[token]`)

> **Why this matters most.** Most applies land on phones (per [`docs/1-product/roadmap.md`](../../1-product/roadmap.md) i18n notes — public surfaces are mobile-first by default). The redesign devotes one paragraph to mobile across the entire package; this doc fills the gap for the highest-stakes mobile surface — the candidate's first impression of HRHandle.
>
> **References:** Current implementation at [`app/apply/[token]/page.tsx`](../../../app/apply/[token]/page.tsx) + `components/apply/apply-form.tsx`. Desktop redesign in [`redesign/Public Pages.dc.html`](../../../redesign/Public%20Pages.dc.html). Audit notes at [`audit.md` §4.7](../audit.md#47-·-s5-·-public-pages-public-pagesdchtml).

---

## Target devices

- **Primary:** 375–414px viewports (iPhone SE 2nd gen → iPhone 15 Pro Max). Portrait only.
- **Secondary:** 360px (older Android), 768px (small tablet portrait).
- **Browsers:** iOS Safari (the actual constraint — Mobile Safari's `<input type="file">` and Turnstile interactions are the spec edge cases), Chrome on Android.
- **One-handed reach:** Bottom-third of viewport is thumb-friendly; top is two-handed. Primary CTA (Submit) belongs in the thumb zone.

---

## Layout sketch

```
┌─────────────────────────────────┐  ← scroll start
│ ← All open positions            │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ [Logo] Acme Inc.            │ │
│ │ Senior Engineer             │ │
│ │ Remote · Engineering · F-T  │ │
│ │                             │ │
│ │ About the Job               │ │
│ │ Lorem ipsum dolor sit amet… │ │
│ │ [Show more ▼]               │ │  ← clamped at 4 lines on mobile
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Your CV                     │ │
│ │ ┌─────────────────────────┐ │ │
│ │ │  📎  Upload CV          │ │ │  ← single big tap target (full width, 56px tall)
│ │ │  PDF or DOCX, up to 5MB │ │ │
│ │ └─────────────────────────┘ │ │
│ │                             │ │
│ │ ─ or paste a LinkedIn URL ─ │ │
│ │ [linkedin.com/in/…       ]  │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ About you                   │ │
│ │ First name *                │ │
│ │ [                        ]  │ │
│ │ Last name *                 │ │
│ │ [                        ]  │ │
│ │ Email *                     │ │
│ │ [                        ]  │ │
│ │ Phone                       │ │
│ │ [                        ]  │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ A few quick questions       │ │  ← screening questions (NEW per redesign)
│ │ Are you eligible to work    │ │
│ │ in the UK? *                │ │
│ │ ( ) Yes  ( ) No             │ │  ← knockout = same UI, no special styling
│ │                             │ │
│ │ Notice period (weeks)       │ │
│ │ [   ]                       │ │
│ └─────────────────────────────┘ │
│                                 │
│ GDPR notice (collapsed by      │  ← thin, low-emphasis. Tap to expand.
│ default) [ⓘ Your data]         │
│                                 │
│ [        Apply now        ]    │  ← sticky bottom on scroll past 60%; brand-blue, 52px tall
└─────────────────────────────────┘
```

---

## Behavior

### CV upload — the hardest part

Mobile CV upload has three viable input modes; **all three must work** because users have different file workflows:

1. **File picker** (`<input type="file" accept="application/pdf,.docx">`) — iOS opens Files app + iCloud + cloud providers. Default. **Works fine, no changes needed.**
2. **Camera fallback** — many candidates' CVs exist only as printed/PDF docs. **Add a secondary "Take a photo" button below the file picker** that opens camera with `capture="environment"` and uses the existing `/api/parse-cv` endpoint with image input. If the API doesn't support image-to-text today, gate this with a feature flag and surface as "Coming soon".
3. **Paste LinkedIn URL** — already in scope per the redesign. Adds a non-CV path for candidates who don't have one ready.

**iOS Safari quirk:** Tapping the file input while the keyboard is open inside another field can hang on some iOS versions. Solution: blur active inputs before opening picker. Worth adding to the existing `ApplyForm` regardless.

**Parse feedback:** After successful CV parse, scroll the "About you" section into view with the fields already filled — make the parse visible. If parse fails, fall back to manual entry without losing user time (current behavior is already correct here per M-006 in the recent audit work).

### Sticky CTA

The form is long. The "Apply now" button is the primary action. **It should stick to the bottom of the viewport once the user has scrolled past ~60% of the form** and the form is at least partially valid. Anchor to the safe-area inset (`env(safe-area-inset-bottom)`) so it sits above the iOS home indicator.

If the form is invalid, the sticky button shows but is disabled with a thin hint above it: "Add your name and email to apply" — never block the button without saying why.

### Screening questions

The redesign's S5 says screening questions render here with two kinds: **knockout** (eligibility) and **soft/informational** (salary, notice). On mobile:

- **No special visual treatment for knockout** — labelling a question as "Disqualifying" up front is creepy and produces dishonest answers. Internal flag, not user-facing.
- **Radio buttons** for Y/N — never dropdowns on mobile (extra tap).
- **Numeric notice period** — `inputMode="numeric"` to get the number keyboard, not the full keyboard.
- **Maximum 3 screening Qs visible** — collapse beyond that with "X more questions ▼" so the form doesn't feel infinite.

### GDPR notice

Per spec, GDPR Article 13 notice (controller / processor / 30-day retention) is mandatory. On desktop it's a paragraph block. On mobile, a paragraph block is wall-of-text doom.

**Solution:** thin "ⓘ Your data" pill that expands inline on tap. Always **above** the submit button (never below — users won't scroll past Submit). Expand state has a thin scroll-internal max-height so the rest of the form is still reachable.

### Turnstile

Invisible Turnstile widget per current implementation. On mobile this is effectively zero-friction. Failure UX matters:

- If Turnstile blocks (rare), surface a single sentence: "Couldn't verify — refresh and try again" with a one-tap "Refresh" button. **Don't** show a Turnstile checkbox fallback on mobile — it requires precision tapping that's hostile to thumbs.

---

## States

| State | Treatment |
|---|---|
| Loading | Skeleton for header + form, no spinner. Page is already light enough to render fast. |
| CV parsing | Inline progress bar on the CV card ("Parsing CV…"), form fields locked but visible. |
| CV parse failed | Inline notice on CV card ("Couldn't read this file — please enter your details below"), form fields unlocked. M-006 in current implementation already distinguishes network vs file failure; keep both messages. |
| Validation error | Inline below the field, never above the form. Submit button stays sticky-bottom with the "Fix N errors above ↑" label. |
| Submitting | Sticky button → loading spinner inline, stays at bottom. Disable all inputs. |
| Success | Replace entire form with confirmation card (see below). |
| Closed vacancy | Replace form with "This position is no longer open" card (current behavior is correct). |

---

## Success state (after submission)

```
┌─────────────────────────────────┐
│  ✓ Thanks for applying!         │
│                                 │
│  We've sent a confirmation to   │
│  alex@example.com               │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Track your application →  │  │  ← only if status page enabled
│  └───────────────────────────┘  │
│                                 │
│  [ View other open roles ]      │
└─────────────────────────────────┘
```

- Brand-green check icon (already in design system).
- Email confirmation reassurance text.
- "Track your application" deep-links to `/status/<token>` (current G-016) — only if the org has the status feature enabled.
- "View other open roles" links to `/jobs/<slug>` if the org has a public listing slug.

---

## What's not on mobile

- **Side-by-side preview of public apply page** in the apply-form builder (S4 vacancy → Apply form tab). That's a recruiter surface and stays desktop-only.
- **Drag-reorder of fields in the field builder** — same reason.
- **Org JSON-LD JobPosting** — invisible (head tag), no UI change for any device.

---

## Open questions

1. Camera-as-CV-source — flag for now (require API support) or design without it?
2. Sticky CTA on iOS — should it appear immediately or only after some scroll? Design preference.
3. Screening Qs: max-3-visible-before-collapse — confirm the threshold.
4. What does the status page look like on mobile if the candidate taps "Track your application"? See [`audit.md` RR-11](../audit.md#3-regression-risk-register) — the withdraw button (G-022) needs mobile placement.
