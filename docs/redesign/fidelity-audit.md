# Design fidelity audit — 2026-06-18

> **Why this doc exists.** Through the corpus I was building from prose
> (the audit doc, the per-flow specs, the roadmap) rather than the
> `.dc.html` design files. That worked for structure but missed the
> visual contract — colour decisions, spacing, exact copy, modal
> shapes. After fixing Wave 2.1 against `Pipeline Versions.dc.html` the
> obvious next step was a systematic gap audit of every surface I'd
> already shipped.
>
> This doc is that audit. One section per built surface, each ending in
> a concise gap table with severity ratings. Surfaces that aren't built
> yet (Wave 2.3 profile rebuild, 2.4 vacancy detail, 2.7 wizards, 3.1
> AI Fit, 3.4 landing) are excluded — those design files become forward
> specs for their respective waves, not retroactive remediation targets.
>
> **Process going forward:** before every wave build I read the matching
> `.dc.html` file, write a design-vs-current delta as the first step,
> then code to that delta. The drift you caught with Wave 2.1 was real
> and unforced; this audit + the new process stops the repeat.

## Severity legend

- 🔴 **Wrong colour on a brand moment, or structurally off** — the kind
  of gap a candidate or recruiter would notice on first look.
- 🟡 **Visible but livable** — wrong size by 1–2px, copy that doesn't
  match exactly, secondary element styling.
- 🟢 **Nitpick** — invisible without a side-by-side comparison.

## Surfaces covered

1. [Wave 1.2 · Settings (4-group reorg)](#wave-12--settings)
2. [Wave 3.2 · Public Pages — jobs + apply](#wave-32--public-pages)
3. [Wave 3.3 · Public Offer countdown + modals](#wave-33--public-offer)
4. [Wave 0.9 · Pipeline empty state](#wave-09--pipeline-empty-state)
5. [Wave 2.1 · Cross-vacancy kanban (already fidelity-fixed)](#wave-21--cross-vacancy-kanban-verification)
6. [Wave 1.6 · AI calm tag + AI feature panels](#wave-16--ai-calm-tag--ai-features)
7. [Unchanged-but-redesigned-by-spec surfaces](#unchanged-surfaces)

---

## Wave 1.2 · Settings

**Design file:** [`redesign/Settings.dc.html`](../../redesign/Settings.dc.html)
**Code:** [`components/settings/settings-nav.tsx`](../../components/settings/settings-nav.tsx), `app/(dashboard)/settings/**`

**Structural verdict:** the 4-group nav structure and the items inside each
group match the design. The breakage is purely visual — the active-item
treatment, the sidebar chrome, and the brand-blue primary action colour.

### Sidebar nav

| Element | Design | Current | Severity |
|---|---|---|---|
| Active item background | `oklch(0.93 0.05 250)` — pale brand-blue tint | `bg-accent` — resolves to **green/teal** in the user's screenshot | 🔴 |
| Active item text | `oklch(0.25 0.14 250)` — darker brand-blue | `text-foreground` — neutral | 🔴 |
| Sidebar background | `oklch(0.985 0.002 247)` — very faintly tinted | None — transparent | 🟡 |
| Right border (separator from main panel) | `1px solid oklch(0.92 0.01 250)` | None | 🟡 |
| Sidebar width | `232px` | `w-52` = `208px` | 🟢 |
| Group label letter-spacing | `0.07em` | `tracking-wider` ≈ `0.05em` | 🟢 |
| Item padding | `8px 11px` | `px-3 py-2` = `12px 8px` | 🟢 |
| Group label spacing above | `margin: 14px 0 6px` | `space-y-5` between sections | 🟢 |

### Page chrome (applies to every settings sub-page)

| Element | Design | Current | Severity |
|---|---|---|---|
| Top breadcrumb bar | `50px` height, `"Settings › Profile"` with right chevron, `border-bottom: 1px solid oklch(0.93 0.01 250)` | Page title h1 only, no breadcrumb bar | 🟡 |
| Main panel background | `oklch(0.985 0.002 247)` — slightly tinted | Default page bg | 🟢 |
| Outer frame | `1px solid oklch(0.88 0.01 250)`, `border-radius: 14px`, soft shadow | No outer card wrapper | 🟡 |

### Profile panel specifically

| Element | Design | Current | Severity |
|---|---|---|---|
| Avatar size | 60×60 round | Not currently rendered on the Profile page (only `/settings/organization` has logo) | 🟡 |
| Avatar background | `oklch(0.93 0.04 250)` — brand-blue tint | n/a | — |
| Avatar text colour | `oklch(0.45 0.16 250)` — brand-blue | n/a | — |
| "Save changes" button | Brand-blue `oklch(0.55 0.18 250)`, white text, `padding: 9px 18px` | Standard `Button` (primary) — colour depends on theme, may or may not be brand-blue | 🟡 (likely correct via theme, worth verifying) |
| "Change photo" button | Outline, `border: 1px solid oklch(0.88 0.01 250)`, gray text | n/a (no avatar control on Profile) | 🟡 |

### Field treatment (consistent across settings panels)

| Element | Design | Current | Severity |
|---|---|---|---|
| Input border | `1px solid oklch(0.9 0.01 250)` | Default `Input` component | 🟢 (likely close via theme) |
| Input border-radius | `8px` | Default `Input` radius | 🟢 |
| Input padding | `9px 12px` | Default `Input` padding | 🟢 |
| Prefix-segmented field (e.g. `hrhandle.co/jobs/` + slug) | Two-cell input with `oklch(0.97 0.005 250)` prefix bg + `border-right` divider | Not present — `/settings/organization` shows plain text input for the slug | 🟡 |

---

## Wave 3.2 · Public Pages

**Design file:** [`redesign/Public Pages.dc.html`](../../redesign/Public Pages.dc.html)
**Code:** [`app/jobs/[slug]/page.tsx`](../../app/jobs/[slug]/page.tsx), [`app/apply/[token]/page.tsx`](../../app/apply/[token]/page.tsx), [`components/apply/apply-form.tsx`](../../components/apply/apply-form.tsx)

**Structural verdict:** the jobs listing structure (header card → job-card list → "Powered by") matches. The apply page structure (job header card + form card) was collapsed into a single card in my implementation. Confirmation card is mostly correct. Most gaps are colour treatment — brand-blue vs gray placeholders.

### Public job listing — `/jobs/[slug]`

| Element | Design | Current | Severity |
|---|---|---|---|
| Page background | `oklch(0.985 0.002 247)` — slightly tinted | `bg-gray-50` — Tailwind neutral | 🟡 |
| Outer container max-width | `620px` | `max-w-2xl` ≈ 672px | 🟢 |
| Header card brand bar | `height: 8px; background: oklch(0.55 0.18 250)` | `h-2 bg-blue-600` (8px brand-blue) | 🟢 ✓ |
| Logo placeholder bg | `oklch(0.93 0.05 250)` — pale brand-blue tint | `bg-gray-100` — neutral | 🔴 |
| Logo placeholder text | `oklch(0.42 0.16 250)` — brand-blue | `text-gray-500` | 🔴 |
| Logo placeholder size | 56×56, `border-radius: 12px` | 56×56 (`h-14 w-14`), `rounded-lg` ≈ 8px | 🟢 |
| Header subtitle | "Open Positions · 3 roles" (Title case) | "Open positions · 3 roles" (sentence case I changed earlier) | 🟢 (consistent with rest of app — keep sentence case) |
| Job card border-radius | `12px` | `rounded-xl` = 12px | 🟢 ✓ |
| Job card padding | `18px 20px` | `p-6` = 24px | 🟢 |
| Job card shadow | `0 1px 3px oklch(0 0 0 / 0.04)` | `shadow-sm` | 🟢 |
| "Apply →" colour | `oklch(0.45 0.16 250)` — brand-blue | `text-blue-600` — Tailwind blue | 🟢 (close hue) |

### Public apply page — `/apply/[token]`

| Element | Design | Current | Severity |
|---|---|---|---|
| Page background | `oklch(0.985 0.002 247)` | `bg-gray-50` | 🟡 |
| Container max-width | `640px` | `max-w-2xl` ≈ 672px | 🟢 |
| Job header card vs form card | **Two separate** rounded 14px cards with padding 26px each, soft shadow | Job details are in the header card, but the rest is one big card with inline sections — design specifies two | 🟡 |
| Job header logo | 48×48 brand-blue tint + brand-blue letter, with "Acme Corp" small caption above title | Plain logo with org name as small caption below | 🟡 (logo placeholder colour again) |
| Job title display | `font-size: 21px; font-weight: 700`, meta line "Tbilisi · Analytics · Full-time · $4–5k/mo" | Implementation has separate vacancy.title h1, similar meta but salary not surfaced inline | 🟡 |
| "ABOUT THE JOB" header | Uppercase with `letter-spacing: 0.05em`, gray secondary `oklch(0.5 0.02 250)` | I sentence-cased it to "About the job" in the earlier sweep — but `text-transform: uppercase` is still in the className so it renders ALL CAPS | 🟢 (CSS still renders uppercase regardless of source case) |
| "Read more" inline link | Brand-blue `oklch(0.55 0.18 250)` inline at end of description | Not present — full description shown | 🟡 |
| "Apply for this position" form heading | `font-size: 17px; font-weight: 700` | h2 styled close | 🟢 |
| CV upload styling | Dashed `1.5px oklch(0.8 0.04 250)` (pale brand-blue), bg `oklch(0.985 0.012 250)`, text `oklch(0.45 0.16 250)` (brand-blue), icon brand-blue | Plain dashed gray border + gray text | 🔴 |
| CV upload copy | "Upload PDF or Word (max 10 MB)" | "Upload PDF or Word document (max 10 MB)" | 🟢 |
| Field input border-radius | `9px` | Default `Input` | 🟢 |
| GDPR notice background | `oklch(0.985 0.002 247)` separate tile | Inline section, same wording, no separate tile bg | 🟡 |
| GDPR "Privacy Policy" link | Brand-blue `oklch(0.55 0.18 250)` | `underline hover:text-foreground` — different colour | 🟡 |
| Submit button | Brand-blue `oklch(0.55 0.18 250)` full-width `padding: 13px` | `bg-blue-600` — close Tailwind blue | 🟢 |
| Submit button copy | "Apply now" | "Apply now" ✓ | 🟢 |
| Bottom helper text | "Protected by an invisible security check · Powered by HRHandle" | Different copy / placement | 🟡 |

### Apply confirmation card

| Element | Design | Current | Severity |
|---|---|---|---|
| Check icon | Brand-green `oklch(0.42 0.14 150)` stroke inside `oklch(0.93 0.07 155)` (pale green) circle, 56×56 outer | `CheckCircle2` `text-green-500` — solid colour, no surrounding circle | 🟡 |
| "Thanks for applying!" | h2 `font-size: 20px; font-weight: 700` | h2 `text-xl font-bold` — match | 🟢 |
| Email confirmation text | "We've sent a confirmation to **email**. Acme Corp will review your application and be in touch." | "We've sent a confirmation to **email**. We will review your details and be in touch." — design uses org name | 🟡 |
| Tracker link copy | "Check your application status →" | "Track your application →" | 🟡 |
| Tracker link styling | Outline rounded button (`border: 1px solid oklch(0.88 0.01 250)`, gray text) | Inline-flex with blue tint bg + brand-blue text | 🟡 (design is more neutral) |

### Public status page — `/status/[token]`

| Element | Design | Current | Severity |
|---|---|---|---|
| Header label | "YOUR APPLICATION" small caps | "Application status" small caps via indigo-600 colour | 🟢 |
| Greeting | None — design just shows role + employer | "Hi {first_name}, here's where things stand" h1 | 🟢 (mine is friendlier, design is more compact — both reasonable) |
| Bucket label "Applied" | "Received" (more candidate-friendly) | "Applied" (from `BUCKET_LABELS.applied`) | 🟡 |
| Bucket label "In review" | "Under review" | "In review" (from `BUCKET_LABELS.in_review`) | 🟡 |
| Stepper visual | Each stage as a tinted pill with connector line between, active stage gets ring `box-shadow: 0 0 0 3px oklch(0.55 0.18 250 / 0.12)` | Existing `StatusStepper` component — different visual | 🟡 |
| Current-state explainer | "Your application is currently **under review**. We'll email you when there's an update." in tinted box | "{view.subtitle}" — copy differs per bucket | 🟢 (substantively same intent) |
| Footer disclaimer about simplified stages | "Stages shown are simplified for candidates — they map to your internal pipeline..." | Different copy with the same intent | 🟢 |
| Pending offer tile | Not shown in this design (offer flow is the separate Public Offer doc) | Emerald tile linking to `/offer/[token]` — new addition I made, no conflict | 🟢 ✓ (additive) |

---

## Wave 3.3 · Public Offer

**Design file:** [`redesign/Public Offer.dc.html`](../../redesign/Public Offer.dc.html)
**Code:** [`app/offer/[token]/page.tsx`](../../app/offer/[token]/page.tsx), [`components/offers/offer-respond-form.tsx`](../../components/offers/offer-respond-form.tsx)

**Structural verdict:** content model and state machine match perfectly. The visual gap is real on the highest-stakes element (Accept button colour) — that's the candidate's "I'm taking the job" moment and I shipped it green instead of brand-blue. Confirm-decline modal is functionally right but copy + colour treatment doesn't match.

### Live offer page (status: sent)

| Element | Design | Current | Severity |
|---|---|---|---|
| **6px brand-blue bar at top of offer card** | `height: 6px; background: oklch(0.55 0.18 250)` | Not present | 🔴 |
| Outer offer card border-radius | `16px` | `rounded-2xl` = 16px | 🟢 ✓ |
| Outer offer card shadow | `0 2px 8px oklch(0 0 0 / 0.06)` | `shadow-sm` (lighter) | 🟢 |
| "Offer from {org}" header colour | Brand-blue `oklch(0.55 0.18 250)` uppercase tracking-wide | `text-indigo-600` uppercase tracking-wide — close to brand-blue but Tailwind indigo, not exact | 🟢 |
| h1 greeting | "Hi {name}, here's your offer" `font-size: 27px` | "Hi {name}, here's your offer" `text-2xl sm:text-3xl` | 🟢 |
| Summary tile row layout | icon + label (`width: 120px`) + value | icon + label as `<dt class="sr-only">` (hidden) + value — visible label is missing | 🟡 (different read: design shows visible "Role / Employer / Compensation" labels, I hide them) |
| **"Respond by" row colour treatment** | Clock icon amber `oklch(0.55 0.12 70)`, label muted amber `oklch(0.5 0.1 65)`, value inline as `"June 26, 2026 · 5 days left"` in amber `oklch(0.45 0.12 60)` | Clock icon gray, label gray, value gray with **separate pill chip** to the right for countdown | 🔴 (whole row should read amber when countdown is amber) |
| Section dividers | `1px height oklch(0.93 0.01 250)` between each block | `<hr>` between blocks | 🟢 |
| "OFFER DETAILS" / "A NOTE FROM THE RECRUITER" headers | Uppercase `letter-spacing: 0.05em` muted gray | `text-xs font-semibold uppercase tracking-wide text-gray-500` — match | 🟢 ✓ |
| Recruiter note styling | Italic with implicit quotes around content (`"It was a pleasure..."`) | `whitespace-pre-wrap` plain text, no italic | 🟡 |
| Action intro copy | "When you're ready, accept or decline below. You'll see a confirmation straight away." | Same copy — match | 🟢 ✓ |
| **Accept button colour** | Brand-blue `oklch(0.55 0.18 250)` white text, `border-radius: 10px`, `padding: 13px`, `font-weight: 700` | `bg-emerald-600 text-white` — **WRONG COLOUR**, should be brand-blue | 🔴 |
| Decline button | Outline `1px solid oklch(0.88 0.01 250)`, gray text, same padding | `variant="outline"` — close | 🟢 |
| Privacy footer | "Sent June 21, 2026. Keep this link private — it's the only way to view or respond to this offer." | Same with date conditional — match | 🟢 ✓ |

### Decline-confirm modal

| Element | Design | Current | Severity |
|---|---|---|---|
| Modal title | "Decline this offer?" | "Decline this offer?" | 🟢 ✓ |
| Description copy | "This lets Acme Corp know you won't be joining. You can add an optional note for the recruiter." | "The recruiter will be notified. You can leave a short reason if you'd like — only they will see it." | 🟡 |
| Textarea placeholder | "Optional message…" | "e.g. Took a different offer. Compensation was lower than expected. Timing isn't right." | 🟢 (mine is more helpful — leave it) |
| Cancel button copy | **"Go back"** | "Cancel" | 🟡 |
| Confirm button copy | "Confirm decline" | "Confirm decline" | 🟢 ✓ |
| Confirm button colour | Red `oklch(0.5 0.19 27)` | `bg-destructive` (theme red) | 🟢 |
| Confirm button weight | `font-weight: 700` | Default button weight | 🟢 |

### Accept-confirm modal

| Element | Design | Current | Severity |
|---|---|---|---|
| Modal title | (no explicit accept-confirm modal shown in design — implied by "added a confirm step on Accept/Decline") | "Accept this offer?" | 🟢 ✓ (implied by design intent) |
| Confirm button colour | Should match Accept-button design = brand-blue | `bg-emerald-600` — same wrong colour as the trigger button | 🔴 |

### Accepted state

| Element | Design | Current | Severity |
|---|---|---|---|
| Check badge | 56×56 round, `oklch(0.93 0.07 155)` pale-green bg, `oklch(0.42 0.14 150)` darker-green check stroke, stroke-width 2.5 | No badge container — just text emerald-900 inline | 🟡 |
| Title | **"You accepted this offer 🎉"** (with emoji) | "You accepted this offer." (no emoji) | 🟡 |
| Subtitle copy | "The recruiter at Acme Corp has been notified and will be in touch with the next steps. **Welcome aboard!**" | "The recruiter has been notified and will be in touch with the next steps." | 🟡 |
| Acceptance date | "Accepted June 22, 2026" footer | Not shown | 🟡 |

### Declined / Expired / Withdrawn states

| State | Design | Current | Severity |
|---|---|---|---|
| Declined inner tile | Gray bg `oklch(0.96 0.005 250)`, rounded 11px, content inside | `bg-gray-100 rounded-xl p-4` — close | 🟢 |
| Declined title | "You declined this offer." | "You declined this offer." | 🟢 ✓ |
| Expired inner tile | Amber bg `oklch(0.97 0.04 75)`, amber text `oklch(0.42 0.1 60)` | `bg-amber-50` + amber text — close | 🟢 |
| Expired title | "This offer has expired." | "This offer has expired." | 🟢 ✓ |
| Withdrawn inner tile | Same as declined (gray) | `bg-gray-100` — match | 🟢 ✓ |

---

## Wave 0.9 · Pipeline empty state

**Design file:** [`redesign/Pipeline Empty State.dc.html`](../../redesign/Pipeline Empty State.dc.html)
**Code:** the welcome card branch in [`app/(dashboard)/pipeline/page.tsx`](../../app/(dashboard)/pipeline/page.tsx)

_Audit in progress — placeholder._

---

## Wave 2.1 · Cross-vacancy kanban (verification)

**Design file:** [`redesign/Pipeline Versions.dc.html`](../../redesign/Pipeline Versions.dc.html)
**Code:** [`app/(dashboard)/pipeline/page.tsx`](../../app/(dashboard)/pipeline/page.tsx) + `components/pipeline/**`

_Audit in progress — placeholder. Wave 2.1 just shipped a fidelity pass
against this design (commit `7ff2e1a`); this section verifies nothing
slipped through._

---

## Wave 1.6 · AI calm tag + AI features

**Design file:** [`redesign/AI and Terminology System.dc.html`](../../redesign/AI and Terminology System.dc.html)
**Code:** [`components/ui/ai-draft-tag.tsx`](../../components/ui/ai-draft-tag.tsx), [`components/ui/ai-draft-panel.tsx`](../../components/ui/ai-draft-panel.tsx), the five AI feature panels

_Audit in progress — placeholder._

---

## Unchanged surfaces

These surfaces have design files but I didn't touch the implementation in
this corpus. Audit anyway — to see what should be remediated as a forward
ship instead of as a retroactive fix.

- `redesign/Vacancies.dc.html` vs `app/(dashboard)/vacancies/page.tsx`
- `redesign/Interview Scheduling.dc.html` vs `app/(dashboard)/interviews/**`
- `redesign/Reports and Interviews.dc.html` vs `app/(dashboard)/reports/**`

_Audit in progress — placeholder._
