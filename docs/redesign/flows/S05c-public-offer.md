# S5c · Public offer flow — flow analysis

> **Status:** Draft 1, authored 2026-06-17. Smallest of the public-facing flow docs.
>
> **Sources:** [`Public Offer.dc.html`](../../../redesign/Public%20Offer.dc.html), [`audit.md` §4.8](../audit.md#48-·-s5c-·-public-offer-public-offerdchtml). Mobile: [`mobile/offer-approval.md`](../mobile/offer-approval.md) (canonical for the candidate's phone experience — most offers are opened on a phone).
>
> **Why this is seventh.** Public offer is the highest-stakes candidate-facing moment in the product — a clunky experience here loses real hires. The redesign is mostly polish + two specific additions: countdown UI on `expiry_date`, and a confirm-before-decline modal. All five state machines already work per G-018 (Migration 035 + the `/offer/[token]` route).

---

## 1. Current implementation

### Route

| Route | File | Lines |
|---|---|---|
| `/offer/[token]` | [`app/offer/[token]/page.tsx`](../../../app/offer/[token]/page.tsx) | 226 |

Token = `offers.public_token` (per [Migration 035](../../../scripts/035_offers.sql)). Same token-as-credential model as `/apply/[token]` and `/status/[token]`.

### Schema (Migration 035)

```
offers (
  id, organization_id, application_id,
  role_title, compensation_amount, compensation_currency, compensation_period,
  start_date, expiry_date,
  body, recruiter_message,
  status TEXT CHECK ('draft','sent','accepted','declined','expired','withdrawn'),
  public_token, sent_at, responded_at, decline_reason,
  …
)
```

Partial unique index: `uq_offers_one_active_per_app` — only one non-terminal offer per application.

### Current behavior

| State | Today |
|---|---|
| `draft` | Not reachable via public URL — `notFound()` |
| `sent` | Shows offer summary + body + recruiter note + Accept / Decline buttons (one-tap each) |
| `accepted` | Green badge + accepted-date |
| `declined` | Gray badge + declined-date |
| `expired` | Amber badge + "respond-by has passed" |
| `withdrawn` | Gray badge + "offer withdrawn" |

Cron job auto-expires `sent` offers past their `expiry_date` (existing per G-018).

### What works today

- ✅ All five states implemented
- ✅ Token-gated route with 404 on missing
- ✅ Compensation displayed with currency + period
- ✅ Plain-text offer body (markdown-rendered would be a future enhancement)
- ✅ Recruiter message optional
- ✅ Accept / Decline flips application status internally
- ✅ Send notifications via webhooks (G-030 if connected)

### What's missing

- ❌ Countdown UI on `expiry_date` ("5 days left" with amber pulse near 0)
- ❌ Confirm-before-decline modal (today is one-tap)
- ❌ Decline message persistence — column `offers.decline_reason` exists but isn't wired
- ❌ Brand-accent visual polish (currently neutral gray, not branded)
- ❌ "Ask a question" 3rd option (open in audit §4.8)
- ❌ PDF attachment (deferred to v2 per product roadmap)

---

## 2. Proposed redesign

### 2.1 `sent` state — the decision moment

Token-gated page. Header + branded offer card + privacy footer.

**Header (above the offer card):**

```
OFFER FROM ACME CORP

Hi Aleksandre, here's your offer
```

- Eyebrow: brand-blue small-caps "OFFER FROM [Org name]"
- Headline: large, personalized with `candidates.first_name`

**Offer card** (centered, max ~600px wide):

```
┌───────────────────────────────────────────────┐
│ ▓▓▓▓▓ (6px brand-blue bar)                    │
│                                               │
│   💼  Role           Senior Business Analyst  │
│   🏢  Employer       Acme Corp                │
│   💰  Compensation   $5,000 / month           │
│   📅  Start date     July 1, 2026             │
│   ⏱   Respond by    June 26, 2026             │
│                       · 5 days left           │ ← countdown
│   ───────────────────────────────────────     │
│                                               │
│   OFFER DETAILS                               │
│   We're delighted to offer you the Senior     │
│   Business Analyst role. This is a full-time  │
│   position with our Analytics team in         │
│   Tbilisi, including health insurance, 24     │
│   days annual leave, and an annual learning   │
│   budget. We think you'll do great things     │
│   here.                                       │
│   ───────────────────────────────────────     │
│                                               │
│   A NOTE FROM THE RECRUITER                   │
│   "It was a pleasure meeting you across the   │
│   rounds — the team is genuinely excited.     │
│   Happy to hop on a call if any questions.    │
│   — Nino"                                     │
│   ───────────────────────────────────────     │
│                                               │
│   When you're ready, accept or decline        │
│   below. You'll see a confirmation straight   │
│   away.                                       │
│                                               │
│   [    Accept offer    ]    [    Decline    ] │
└───────────────────────────────────────────────┘

Sent June 21, 2026.
Keep this link private — it's the only way to view
or respond to this offer.
```

#### 2.1.1 Countdown UI on "Respond by"

Computed client-side from `expiry_date`:

| Time remaining | Display | Color |
|---|---|---|
| > 7 days | "June 26, 2026 · 12 days left" | neutral gray |
| 2–7 days | "June 26, 2026 · 5 days left" | amber text |
| 1–48 hours | "June 26, 2026 · 24 hours left" | amber text |
| < 1 hour | "June 26, 2026 · 45 minutes left" | amber text + slight pulse |
| Past | (state flips to `expired` via cron; this page no longer shows the countdown) |

**Pulse only on the final 2 hours.** Constant flashing is hostile — per `mobile/offer-approval.md`.

If `expiry_date IS NULL`, no countdown line. Show "Take your time" or just omit.

#### 2.1.2 Accept / Decline buttons

Both pass through a **confirm step** (locked by REDESIGN-DECISIONS S5c). One-tap accept is a known risk.

**Accept confirm:**

```
┌───────────────────────────────────────────────┐
│ Accept this offer?                            │
│                                               │
│ This lets Acme Corp know you're joining.      │
│ The recruiter will be in touch with next      │
│ steps.                                        │
│                                               │
│  [   Go back   ]      [   Confirm accept  ]  │
└───────────────────────────────────────────────┘
```

Brand-blue "Confirm accept" button.

**Decline confirm** (per design):

```
┌───────────────────────────────────────────────┐
│ Decline this offer?                           │
│                                               │
│ This lets Acme Corp know you won't be         │
│ joining. You can add an optional note for     │
│ the recruiter.                                │
│                                               │
│ ┌─────────────────────────────────────────┐  │
│ │ Optional message…                       │  │
│ │                                         │  │
│ └─────────────────────────────────────────┘  │
│                                               │
│  [   Go back   ]      [   Confirm decline  ] │
└───────────────────────────────────────────────┘
```

- Optional message textarea (max 1000 chars, persists to `offers.decline_reason`)
- "Confirm decline" button **red** (destructive action)

Both confirmations are inline within the card (not modal overlays) on desktop. Mobile uses bottom-sheet (per [`mobile/offer-approval.md`](../mobile/offer-approval.md)).

### 2.2 Terminal states

All four already exist; design adds light visual polish.

**`accepted`** state:

```
┌─────────────────────────────┐
│          ✓                  │
│  You accepted this offer 🎉  │
│                             │
│  The recruiter at Acme has  │
│  been notified and will be  │
│  in touch with the next     │
│  steps. Welcome aboard!     │
│                             │
│  Accepted June 22, 2026     │
└─────────────────────────────┘
```

- Brand-green check in circle
- Headline "You accepted this offer 🎉"
- Per S10: 🎉 emoji allowed (one of the few places per redesign source — warm moment)
- Below the tile: the summary tile + offer body stay visible (read-only) so the candidate has a record

**`declined`** state — neutral gray tile:

```
┌─────────────────────────────┐
│ You declined this offer.    │
│ Thank you for letting the   │
│ team know. The recruiter    │
│ has been notified.          │
└─────────────────────────────┘
```

Neutral. Not red. Declining is not a failure.

**`expired`** state — amber tile:

```
┌─────────────────────────────┐
│ ⏱ This offer has expired.   │
│ If you'd still like to      │
│ discuss, please contact     │
│ the recruiter directly.     │
└─────────────────────────────┘
```

Show recruiter contact email if available — candidate may want to re-engage.

**`withdrawn`** state — neutral tile:

```
┌─────────────────────────────┐
│ This offer has been         │
│ withdrawn.                  │
│ The recruiter has retracted │
│ this offer. Contact them    │
│ if you have questions.      │
└─────────────────────────────┘
```

Brief, neutral, no detail. Recruiter has out-of-band reasons.

### 2.3 Privacy footer (preserved)

```
Sent June 21, 2026.
Keep this link private — it's the only way to view
or respond to this offer.
```

Centered, low-emphasis. Matches the design's "link is the credential" framing.

### 2.4 What's NOT in scope

- **"Ask a question" 3rd option** — open in audit §4.8. Recommended as **out of scope for v1** (saves the binary decision); revisit if real candidate behavior shows hesitation patterns. If shipped: a thin tertiary link above the sticky Accept/Decline bar, opening a composer sheet that emails the offer's `created_by` recruiter.
- **PDF attachment** — deferred to v2 per product roadmap. The in-product HTML email + this page cover common cases.
- **Counter-offer / negotiation flow** — v2; today's revision path is withdraw + create new.
- **E-signature** (DocuSign etc.) — v2.
- **Multi-currency display** (showing the candidate the equivalent in their local currency) — out of scope.

---

## 3. Gaps, missing screens, edge cases

### 3.1 Missing screens

| Surface | Why missing | Recommended action |
|---|---|---|
| Offer with no `expiry_date` set | Today renders without countdown | Show "Take your time" tertiary text, or just omit the respond-by line |
| Offer with no `recruiter_message` | Today: section hidden | Same; hide entirely |
| Offer body in markdown | Today: plain text | v1 unchanged; markdown rendering is v1.1 enhancement |
| Recruiter contact in expired tile | Mentioned ("contact the recruiter") but no email | Inject recruiter email from `offers.created_by → profiles.email`; copyable |
| Accept confirm modal | Not drawn explicitly (only Decline shown) | Same shape as Decline minus the message field; brand-blue button |
| Concurrent edit (recruiter withdraws while candidate is reading) | Today: candidate Accept fails on server with status mismatch | Surface clean error: "This offer was withdrawn by the recruiter — refresh to see the latest status." |
| Offer accepted but candidate reopens link later | Today: shows accepted state | Same; candidate can refer back to the offer terms permanently |

### 3.2 Edge cases

| Case | Today | New |
|---|---|---|
| Accept on already-accepted offer | Server returns no-op | Same; client refreshes to show accepted state |
| Decline on already-declined offer | Server returns no-op | Same |
| Countdown displays "0 minutes left" | N/A | Cron should flip to `expired` before this happens; if user sees it, show "Expiring now" and disable buttons |
| `expiry_date` in the past on `sent` state | Cron should have run, but may not have | Server-side check at render — if `expiry_date < now()` AND `status = 'sent'`, treat as `expired` (and let cron catch up) |
| Multiple offer revisions over time | Per Migration 035 — multiple terminal offers per app allowed | Same; this page shows only the current `public_token`'s offer |
| Long offer body | Page scrollable | Same; mobile collapses per `mobile/offer-approval.md` ("Show full offer ▼") |
| Recruiter sends multiple drafts → publishes one | `uq_offers_one_active_per_app` enforces single live | Same |

### 3.3 Race conditions

- Recruiter withdraws + candidate clicks Accept simultaneously: server-side `WHERE status = 'sent'` guard fails the Accept; UI shows "withdrawn" state. Acceptable.
- Two devices for same candidate (offer link opened on phone + desktop): both can submit; second submit hits the same `WHERE status = 'sent'` guard; UI shows the accepted-from-first-device state. Acceptable.

---

## 4. Reuse opportunities

| Need | Reuse from | Notes |
|---|---|---|
| Page server component | `app/offer/[token]/page.tsx` | Polish only |
| Offer state machine | Migration 035 + existing server actions | Direct |
| Token-gated lookup | Existing admin client + 404 pattern | Direct |
| Auto-expire cron | Existing cron job | Direct |
| Notification fanout (Slack/Teams) | Existing webhook infrastructure (G-030) | Direct |
| Email sender | Existing Resend setup | Direct |
| Markdown body rendering (if v1.1) | Existing MDX pipeline (per `lib/guides/` for guide rendering) | Future |
| Status page link integration | S5 status page offer-pending tile per `S05-public-pages.md §2.3` | Direct |

**Net new code:**
- Countdown component with amber-near-end + pulse logic
- Accept confirm inline panel
- Decline confirm inline panel with optional message textarea
- Recruiter contact extraction for expired state
- State-specific tile components (one per terminal state)
- Brand-accent bar styling

---

## 5. DB / API changes

### 5.1 Schema

**No new tables.** All required columns already exist (Migration 035).

**Decline message wiring** — `offers.decline_reason` column already exists; just write to it from the new confirm flow.

### 5.2 Server actions

**Modified:**

- `lib/actions/offers.ts::respondToOffer(token, action: 'accept' | 'decline', declineMessage?: string)` — accept the optional message; persist to `decline_reason`; emit activity log entry.

**Unchanged:**

- Cron auto-expire
- Status flip → application status flip (existing G-018 behavior)
- Webhook fan-out

### 5.3 Routes

| Route | Status | Action |
|---|---|---|
| `/offer/[token]` | KEEP | Restyle only |

No new routes.

---

## 6. Effort estimate

The smallest flow rebuild after S9.

| Task | Effort | Reuse |
|---|---|---|
| Restyle offer card (brand-accent bar + design system colors) | `S` | Page restyle |
| Countdown component | `S` | New, ~60 LOC with date-fns formatters |
| Accept confirm inline panel | `S` | New, small |
| Decline confirm inline panel with message field | `S` | New, small |
| Wire `decline_reason` persistence | `S` | One-line server action change |
| State-specific tile components (accepted / declined / expired / withdrawn) | `S` | 4 small components |
| Server-side `expiry_date < now()` defensive flip | `S` | Page-level check |
| Recruiter contact in expired tile | `S` | Join to profiles |
| Mobile responsive per `mobile/offer-approval.md` | `S` | Existing mobile spec |

**Total: ~S** (1 week elapsed). Smallest flow in the redesign.

### Coordination

- Coordinates with **S5 Public pages** (status page offer-pending tile links here)
- Coordinates with **S02 Candidate profile** (offer-stage contextual block reuses `OfferPanel` on the recruiter side; this page is the candidate-side counterpart)
- Coordinates with **G-030 webhooks** (notification fanout on accept/decline unchanged)

---

## 7. Open questions

### 7.1 RESOLVED via locked decisions

| Question | Status |
|---|---|
| Confirm-before-decline | ✅ Locked (REDESIGN-DECISIONS) |
| Five-state model | ✅ Already shipped (G-018) |
| PDF attachment | ✅ v2 per product roadmap |
| Counter-offer | ✅ v2 |

### 7.2 NEW — surfaced by this analysis

- **Q-S5c-a:** **"Ask a question" 3rd option** — ship in v1 (saves wavering candidates) or defer? *Lean: defer to v1.1* — adds an out-of-band recruiter-email surface that lives outside the offer state machine; ship the binary decision first and observe drop-off if any.
- **Q-S5c-b:** **Countdown granularity at ≤ 1 hour** — "45 minutes left" or "Less than 1 hour left"? *Lean: precise minutes* — creates urgency; matches the redesign's "decision moment" intent.
- **Q-S5c-c:** **Accepted state — keep summary tile visible above the accepted tile** (so the candidate has a record), or replace entirely? *Lean: keep visible* — matches the design "summary tile + body stay visible above these so the candidate always sees what the offer was" per `Public Offer.dc.html` notes.
- **Q-S5c-d:** **Decline message visibility to recruiter** — surface in the offer panel on candidate profile (per S02 Offer-stage contextual block), also surface in Slack/Teams notification body via G-030 webhook? *Lean: both* — recruiter wants this signal; webhook should include the decline reason if present.
- **Q-S5c-e:** **Markdown body rendering** — v1 plain text (current), or v1.1 markdown? *Lean: v1.1* — current customers can use plain offers; markdown helps formatting but adds parser surface.
- **Q-S5c-f:** **Emoji 🎉 on accepted state** — keep (matches design + warm moment), or strict no-emoji per design system? *Lean: keep* — one of the few sanctioned emoji moments per design source.

---

## 8. Test plan

### 8.1 Functional

- [ ] `/offer/[token]` renders in `sent` state with all summary fields
- [ ] Countdown shows correct time-remaining text per granularity rules
- [ ] Countdown turns amber at < 7 days
- [ ] Countdown pulses at < 2 hours
- [ ] No countdown line when `expiry_date IS NULL`
- [ ] Offer body renders plain text
- [ ] Recruiter message renders or hides per presence
- [ ] Accept button → confirm panel → confirm → status flips to `accepted`
- [ ] Decline button → confirm panel with message field → confirm → status flips to `declined`
- [ ] Decline message persists to `offers.decline_reason`
- [ ] Decline with empty message succeeds (optional)
- [ ] Cancel from confirm panel returns to decision moment
- [ ] Accepted state shows brand-green tile + summary above
- [ ] Declined state shows neutral tile
- [ ] Expired state shows amber tile + recruiter contact
- [ ] Withdrawn state shows neutral tile
- [ ] Server-side: `expiry_date < now()` AND `status = 'sent'` treated as expired even before cron runs
- [ ] 404 on missing/invalid token (no oracle)
- [ ] Webhook (G-030) fires on accept + decline with correct payload
- [ ] Activity log entry created on each transition

### 8.2 Non-functional

- [ ] Page load < 1s on cellular
- [ ] No third-party scripts (Supabase only — candidate-facing legal-text surface)
- [ ] Pinch-zoom allowed (legal text)
- [ ] Inline CSS for above-fold

### 8.3 Regression

- [ ] Existing offers with valid tokens still load
- [ ] Cron auto-expire still works
- [ ] Recruiter-side `OfferPanel` (used in S02 Offer-stage contextual block) renders correctly with the new decline_reason field
- [ ] Application status flip on accept (status → `hired`) still works
- [ ] No PII leaks in error responses

### 8.4 Mobile

Verified via [`mobile/offer-approval.md`](../mobile/offer-approval.md):

- [ ] Sticky bottom Accept / Decline bar
- [ ] Hero summary tile with countdown visible
- [ ] Offer body collapse with "Show full offer ▼"
- [ ] Decline confirm as bottom sheet
- [ ] All 5 states render correctly

---

## 9. Verification

Aligned with [`docs/claude-code-workflow.md`](../../claude-code-workflow.md) Phase 5:

- [ ] All sub-tasks in §6 complete
- [ ] Tests in §8 pass
- [ ] Docs updated:
  - [ ] `docs/3-architecture/frontend.md` — confirm flow pattern
  - [ ] `docs/3-architecture/backend.md` — `respondToOffer` signature change
  - [ ] `docs/8-decisions.md` — Q-S5c-a through Q-S5c-f decisions
  - [ ] `docs/ui-texts.md` — new copy
- [ ] Ripple check — recruiter-side `OfferPanel` reads `decline_reason` and displays
- [ ] Ripple check — webhook payload includes `decline_reason` when present

---

## 10. What to do after reading

1. **Confirm Q-S5c-a through Q-S5c-f** (or override).
2. **Confirm "Ask a question" deferral** — quick decision; affects v1 scope.
3. **Next flow doc:** S7 Settings — the regrouped 4-category Settings layout. Larger doc (~4000 words), confirms the Notifications + Security sub-page contents per audit §4.10. Then S8 Reports (~3000 words). Then S10 AI/terminology (~2500 words). That closes the redesign corpus.

---

## Appendix — file inventory for this flow

**New files:**

| File | Purpose |
|---|---|
| `components/offer/offer-countdown.tsx` | New |
| `components/offer/accept-confirm-panel.tsx` | New |
| `components/offer/decline-confirm-panel.tsx` | New (with message textarea) |
| `components/offer/offer-state-tile.tsx` | New (variants: accepted / declined / expired / withdrawn) |

**Modified files:**

| File | Change |
|---|---|
| `app/offer/[token]/page.tsx` | Restyle with brand-accent bar + design palette; thread new components |
| `lib/actions/offers.ts::respondToOffer` | Accept optional `declineMessage` param + persist |
| `lib/webhooks/offer-payload.ts` (if exists, per G-030) | Include `decline_reason` in declined-offer payload |

**Docs touched:**
- `docs/3-architecture/frontend.md`
- `docs/3-architecture/backend.md`
- `docs/8-decisions.md`
- `docs/ui-texts.md`

**Tests added:**
- `tests/components/offer/offer-countdown.test.tsx` — granularity rules + amber thresholds
- `tests/components/offer/decline-confirm-panel.test.tsx`
- `tests/components/offer/offer-state-tile.test.tsx` — 4 variants
- `tests/lib/actions/offers-respond.test.ts` — message persistence + webhook payload
