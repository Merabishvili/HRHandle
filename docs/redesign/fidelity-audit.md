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

**Structural verdict:** the .dc.html for this surface is a text-only spec
(not a full visual mockup) — the founder authored it as prose locking the
design intent rather than rendering a pixel-accurate mock. My
implementation matches the spec near-perfectly. Two tiny gaps.

| Element | Design spec | Current | Severity |
|---|---|---|---|
| Centered welcome card | ✓ | ✓ | 🟢 ✓ |
| 72px rounded icon | 72×72 (`bg-primary/10`) | `h-[72px] w-[72px] rounded-2xl bg-primary/10` ✓ | 🟢 ✓ |
| Icon glyph | "bar-chart / pipeline glyph" | `BarChart3` lucide icon | 🟢 ✓ |
| Icon colour | "soft blue" | `text-primary` (theme primary) | 🟢 ✓ |
| H2 greeting | "Welcome to HRHandle 🌟" — emoji explicitly permitted | "Welcome to HRHandle ✨" using `Sparkles` lucide icon with amber-500 — deviates from spec's explicit emoji | 🟡 |
| Sub-copy | Exact wording: "This is your pipeline — every candidate across every role, in one place. To get started, create your first vacancy and your board comes to life." | Same wording | 🟢 ✓ |
| Primary CTA | "+ Create your first vacancy" brand-blue | `<Button size="lg">` with `Plus` icon + "Create your first vacancy" | 🟢 ✓ |
| Secondary CTA | "Import candidates" outline | `variant="outline" size="lg"` with `Upload` icon + "Import candidates" | 🟢 ✓ |
| 3-step orientation strip | (1) Create a vacancy / (2) Add candidates / (3) Work the pipeline with exact body copy | Same items, exact body copy | 🟢 ✓ |
| Ghost-board fade behind welcome card | Faint kanban behind a fade ("the earlier recommendation was a redirect; locked design is this welcome card with a faint ghost board") | Not present — clean white background only | 🟡 |

---

## Wave 2.1 · Cross-vacancy kanban (verification)

**Design file:** [`redesign/Pipeline Versions.dc.html`](../../redesign/Pipeline Versions.dc.html)
**Code:** [`app/(dashboard)/pipeline/page.tsx`](../../app/(dashboard)/pipeline/page.tsx) + `components/pipeline/**`

**Structural verdict:** the freshly-shipped fidelity pass (`7ff2e1a`) lands
Version B (colour-coded) properly. Tinted columns, coloured card spines,
amber stale state, granular time microcopy, density toggle, Board/List
toggle, bulk bar, terminal rail — all there. A few small Version C details
I still didn't build, listed below for completeness.

| Element | Design | Current | Severity |
|---|---|---|---|
| Outer rounded card wrapper | `border-radius: 14px` + `border 1px oklch(0.88 0.01 250)` + shadow `0 1px 3px oklch(0 0 0 / 0.08)` | `rounded-2xl border border-border shadow-sm` — close | 🟢 ✓ |
| Tinted column backgrounds | Per-stage `oklch` tints from the design | Per-stage tints from `lib/pipeline/stage-style.ts` reading the exact same oklch values | 🟢 ✓ |
| Card colour spine | 3px left-border in stage hue, switches to amber `oklch(0.7 0.15 70)` when stale | 3px left-border via `borderLeft: 3px solid ${spine}` with same `STALE_SPINE` constant | 🟢 ✓ |
| Stale threshold | "5d · stale" example shown | `STALE_DAYS = 5` in stage-style.ts | 🟢 ✓ |
| Granular time microcopy | "16h", "1d", "2d", "5d · stale" | `timeInStage()` helper returns matching labels | 🟢 ✓ |
| Filled brand-blue Review button | `oklch(0.55 0.18 250)` bg with white text | `bg-primary` Tailwind theme primary — likely close, depends on theme oklch | 🟢 |
| Board / List toggle | Segmented dark-active toggle in header chrome | `ViewModeToggle` component — match | 🟢 ✓ |
| Density toggle (Comfortable vs Compact) | Implicit — design says "offer density as a toggle" in the take section | `DensityToggle` with Comfortable / Compact labels | 🟢 ✓ |
| Fit score pill on Compact cards | 30×22 rounded rect, green for ≥7 / amber for ≥5 / gray for null | `fitScoreStyle()` in cross-vacancy-card.tsx with same thresholds | 🟢 ✓ |
| Compact mode `Sort: fit ▾` dropdown | Version C header shows a "Sort: fit ▾" trigger between Board/List toggle and Review button | Not present | 🟡 |
| Bulk bar | Multi-select model "all three keep the exact same toggle, review entry and **bulk model**" | `BulkBar` component with Move-to + Reject + Clear | 🟢 ✓ |
| Inner column header pill | Stage-colour pill (`pillBg` + `pillText`) with stage name + count beside it | `TintedKanbanColumn` header — match | 🟢 ✓ |
| Avatar tint per candidate | Design varies hues between candidates (warm/cool) for scan-ability | `avatarStyle(seed)` deterministically picks from 5 hues | 🟢 ✓ |
| Source line on card | "1d · LinkedIn", "2d · Apply link" | `timeLabel = ${time.label} · ${data.source}` | 🟢 ✓ |
| Outer panel width | `1320px` fixed in design | Fluid (`overflow-x-auto`) — mine adapts to viewport, design is fixed; design choice not strict layout | 🟢 |
| Page background behind the card | The design site uses `oklch(0.94 0.008 250)` body background | Default dashboard bg | 🟢 |

---

## Wave 1.6 · AI calm tag + AI features

**Design file:** [`redesign/AI and Terminology System.dc.html`](../../redesign/AI and Terminology System.dc.html)
**Code:** [`components/ui/ai-draft-tag.tsx`](../../components/ui/ai-draft-tag.tsx), [`components/ui/ai-draft-panel.tsx`](../../components/ui/ai-draft-panel.tsx), the AI feature components in `components/candidates/ai-*` and `components/vacancies/ai-*`

**Structural verdict:** the calm-blue `AiDraftTag` component matches the design's `.aitag` styling closely and the four-step `invoke → draft → review → confirm` pattern is encoded in `AiDraftPanel`. The headline gap: only **2 of the 6** AI feature components actually use `AiDraftTag` today. The design rule is explicit — _"every one uses the same calm tag"_ — so the 4 unwired features are still shipping without the calm-blue provenance affordance.

### Calm-tag styling

| Element | Design `.aitag` | Current `AiDraftTag` | Severity |
|---|---|---|---|
| Background | `oklch(0.96 0.03 250)` | `bg-primary/5` | 🟢 (close hue via theme) |
| Border | `1px solid oklch(0.88 0.05 250)` | `border border-primary/20` | 🟢 |
| Text colour | `oklch(0.45 0.16 250)` (brand-blue) | `text-primary` | 🟢 |
| Border-radius | 6px | `rounded-md` = 6px | 🟢 ✓ |
| Padding | `2px 8px` | `px-2 py-0.5` ≈ `8px 2px` | 🟢 ✓ |
| Font-size | `10.5px` | `text-[11px]` | 🟢 |
| Font-weight | 600 | `font-medium` = 500 | 🟢 |
| Icon | Sparkle SVG inline | `Sparkles` lucide icon | 🟢 ✓ |

### Calm-button styling (`.aibtn` invoke step)

| Element | Design `.aibtn` | Current | Severity |
|---|---|---|---|
| Background | `oklch(0.98 0.03 250)` — very pale brand-blue | `AiDraftPanel` invoke button uses `<Button>` theme variant, no dedicated `aibtn` style | 🟡 |
| Border | `1px solid oklch(0.86 0.06 250)` | n/a | 🟡 |
| Text colour | `oklch(0.42 0.16 250)` (brand-blue) | depends on theme | 🟡 |
| Padding | `7px 13px` | default button padding | 🟢 |

### Per-feature calm-tag adoption (the headline gap)

Design rule: every AI surface uses `AiDraftTag` with the per-feature label from the §3 table.

| Feature | Design label | Current component | Uses AiDraftTag? | Severity |
|---|---|---|---|---|
| CV parse (Add candidate flow) | "AI-filled · review" | Auto-fill in `apply-form.tsx` + `candidate-form.tsx` | ❌ No — parse fills fields silently, no provenance shown | 🟡 |
| JD generation | "AI draft" | `components/vacancies/ai-jd-suggest.tsx` | ❌ No — has own UI | 🟡 |
| Bias / inclusive-language check | "AI suggestion" | `components/vacancies/ai-bias-check.tsx` | ❌ No | 🟡 |
| Candidate summary | "AI draft" | `components/candidates/ai-summary-panel.tsx` | ✅ Yes — `<AiDraftTag label="AI draft" />` | 🟢 ✓ |
| Scorecard from notes | "AI draft" | `components/candidates/ai-notes-extractor.tsx` | ✅ Yes | 🟢 ✓ |
| AI interview questions | (not explicitly in the §3 table — implied "AI draft") | `components/vacancies/ai-interview-questions.tsx` | ❌ No | 🟡 |
| AI assessment suggester | (not in §3 table — implied "AI suggestion") | `components/vacancies/ai-assessment-suggester.tsx` | ❌ No | 🟡 |

### Terminology rules (§4 of the design)

| Rule | Status across the codebase |
|---|---|
| Sentence case everywhere — no Title Case | ✅ swept multiple times this session — clean across dashboard, public pages, settings |
| Second person ("Your pipeline", "Review before saving") | 🟢 mostly — most copy is already second-person; some sub-pages still use product-name framings |
| Plain CTA verbs (Add candidate, Create vacancy, Advance, Schedule) | ✅ matches across the app |
| No emoji in product UI | 🟡 mostly — `Sparkles` icons are not emoji and explicitly OK; one exception is the `✨` icon I used inside the pipeline empty-state h2 next to "Welcome to HRHandle" (the empty-state spec explicitly permits 🌟 emoji here, so technically allowed by exception) |
| Warm empty states ("No candidates yet" + a direct action) | ✅ pipeline empty state matches; other empty states ("No applicants yet", "No interviews scheduled", "No matches.") follow the pattern |
| Badges 8px radius, consistent stage palette | 🟡 stage palette lands cleanly in Wave 2.1 (`stage-style.ts`); badges across the app use a mix of `rounded-md` (6px), `rounded-lg` (8px), `rounded-full` — not consistent |

### Naming decisions (§4 left column)

| Concept | Design rule | Current status |
|---|---|---|
| Vacancy vs Job | Keep "Vacancy" consistently | ✅ "vacancy" used app-wide |
| Status | Derived from stage; words: Active / Hired / Archived | 🟡 partial — `CandidateStatusSelect` dropped in Wave 1.1, but vacancy `status_id` is still a manual field |
| Stage | Applied · Screening · Interview · Offer · Hired (custom allowed, typed) | ✅ matches |
| "Incomplete" | RETIRE — say what's missing ("No CV", "Needs review") | 🟢 swapped to "Not assessed" earlier — closer to design than "Incomplete" but design specifically suggests "Needs review" |
| Scorecard / Screening questions / Fit score | Separate concepts, named distinctly | 🟡 partially — codebase mixes `vacancy_questions` (scorecard prompts) with the design's "screening questions" concept; Wave 2.5 cleanup pending |
| "Trial · Trial" duplicate | Fix to single "Trial · N days left" pill | ✅ shipped in Wave 1.3 |

---

## Unchanged surfaces

These surfaces have design files but I didn't touch the implementation in
this corpus. They're listed here so they don't fall off the radar — each
needs a forward Wave build, not a retroactive patch.

| Design file | Current implementation | Status |
|---|---|---|
| `redesign/Vacancies.dc.html` (3 designs: enhanced table, card grid, vacancy detail) | `app/(dashboard)/vacancies/page.tsx` (current table) + `app/(dashboard)/vacancies/[id]/page.tsx` | Wave 2.4 in roadmap. Sentence-case sweep + Title-Case fix already applied; visual rebuild pending. Design proposes a card-grid view + per-row mini-funnel that don't exist today. |
| `redesign/Interview Scheduling.dc.html` (2 designs: candidate-launched, standalone) | `app/(dashboard)/interviews/new/page.tsx` | No Wave assigned (was Wave 1.7, dropped after the audit found the existing form already supports both pre-fill paths). Form structure passes audit; visual treatment unchanged. |
| `redesign/Reports and Interviews.dc.html` (3 sections: Pipeline / Time to hire & Sources / Interviews) | `app/(dashboard)/reports/**` + `app/(dashboard)/interviews/page.tsx` | Reports were rebuilt for G-029 (pre-redesign); design proposes lighter cosmetic polish. Interviews list got sentence-case fixes earlier this session. Full Wave not assigned. |
| `redesign/Candidate Profile A Refined.dc.html` | `app/(dashboard)/candidates/[id]/page.tsx` | Wave 2.3 in roadmap. Not rebuilt. Partial polish via sentence-case + Hired+Incomplete badge fix. |
| `redesign/Vacancy Detail.dc.html` | `app/(dashboard)/vacancies/[id]/page.tsx` | Wave 2.4 in roadmap. Not rebuilt. Partial polish via sentence-case. |
| `redesign/Create Vacancy Steps.dc.html` | `app/(dashboard)/vacancies/new/page.tsx` | Wave 2.7 in roadmap. Not rebuilt. |
| `redesign/Create Candidate Steps.dc.html` | `app/(dashboard)/candidates/new/page.tsx` | Wave 2.7 in roadmap. Not rebuilt. |
| `redesign/Custom Stages.dc.html` | No UI yet | Wave 2.6 — Migration 046 applied (`pipeline_stages` table), but the stage-manager UI is unbuilt. |
| `redesign/Landing and Guide.dc.html` | `app/page.tsx`, `app/guide/**` | Wave 3.4 in roadmap. Not rebuilt. |
| `redesign/AI Fit Analysis.dc.html` | No UI yet | Wave 3.1 blocked on Phase 0.8 legal consult. |

---

## Remediation priorities

Ordered by **visible candidate impact** × **fix-effort ratio** — what
will move the needle most per hour of work.

### Tier 1 — fix immediately (🔴 wrong-colour on brand moments)

1. **Wave 3.3 Accept-offer button colour** — change `bg-emerald-600` → brand-blue. ~10 minutes. Highest-stakes single fix in the audit: candidate's "I'm taking the job" moment currently renders in the wrong brand colour.
2. **Wave 3.3 Accept-confirm dialog button colour** — same change in the modal action.
3. **Wave 1.2 Settings active-nav colour** — change `bg-accent` (green) → pale brand-blue `oklch(0.93 0.05 250)` per design. Affects every signed-in user navigating settings. ~15 minutes.
4. **Wave 3.2 logo-placeholder colours** on `/jobs/[slug]` + apply-page job-header card — change `bg-gray-100` → brand-blue tint + text. ~15 minutes.

### Tier 2 — same surface, easy follow-on (🔴 / 🟡 visible but smaller)

5. **Wave 3.3 6px brand bar** at top of the offer card — single `<div>`, ~5 minutes.
6. **Wave 3.3 inline countdown layout** in the "Respond by" row — currently a separate pill chip after the date; design wants the date + countdown rendered inline in amber when countdown is `soon` / `urgent`.
7. **Wave 3.3 confirm-decline "Cancel" → "Go back"** + the "🎉" emoji on the accepted state title + the "Accepted {date}" footer.
8. **Wave 1.2 sidebar chrome** — add the subtle `oklch(0.985 0.002 247)` background tint + right border separator.

### Tier 3 — moderate work, real polish wins (🟡)

9. **Wave 1.6 wire `AiDraftTag` into the remaining 4 AI components** (ai-jd-suggest, ai-bias-check, ai-interview-questions, ai-assessment-suggester). Each is a small targeted edit — header gets the tag.
10. **Wave 3.2 CV-upload styling** — dashed brand-blue border on the apply form upload zone.
11. **Wave 3.2 split the apply page** into two cards (job header + form) instead of one big card.
12. **Wave 3.3 Recruiter-note italic styling** + visible-label rows on the offer summary.

### Tier 4 — defer to the forward wave that owns the surface (the wave will rewrite the visual anyway)

- `Candidate Profile A Refined.dc.html` gaps → Wave 2.3 rebuild
- `Vacancy Detail.dc.html` gaps → Wave 2.4 rebuild
- `Create Vacancy / Candidate Steps.dc.html` → Wave 2.7
- `Custom Stages.dc.html` UI → Wave 2.6 stage-manager
- `Vacancies.dc.html` card-grid view → Wave 2.4 (or its own slice)
- `Landing and Guide.dc.html` → Wave 3.4
- `AI Fit Analysis.dc.html` → Wave 3.1 (blocked on legal consult)

---

## Process change (committed to going forward)

Before every wave build:

1. Open the matching `.dc.html` end-to-end.
2. Write a short "design specifies X / current code does Y / gap is Z"
   delta as the first thing in the session.
3. Code to that delta.

This audit document is updated when a remediation lands — strike through
the fixed row, move it to the changelog at the bottom (when there is one).

---

## Changelog

_Empty so far — entries added as remediations land._

