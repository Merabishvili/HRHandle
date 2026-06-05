# Handoff: Candidate Details Page Redesign (V1 — Recruiter Workbench)

## Overview

A redesigned **Candidate Details page** for HRHandle. The current page surfaces low-value fields (DOB, derivable YoE, duplicate current position) at the top and buries the recruiter's most important question — _what vacancies has this candidate applied to?_ — near the bottom.

This redesign reorganizes the page around the recruiter's triage flow: **applied vacancies first**, then a compact factual summary, then experience/education, then a unified activity feed. The right rail is sticky and holds contact, documents, interviews, and metadata.

> **Scope note:** Sections and fields are reorganized. No new actions were added and no existing actions were removed — only their placement may shift to live in the section that owns them.

## About the Design Files

The files in this bundle are **design references** built in HTML/React for prototyping. They are not production code — do not copy the JSX verbatim. Recreate the design inside the existing HRHandle Next.js app, using its established conventions:

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS 4 + Radix UI primitives (shadcn/ui pattern)
- **Icons**: Lucide React (`lucide-react` package)
- **Fonts**: Geist Sans + Geist Mono (via `next/font`)
- **Data layer**: Supabase

The page route should live at `app/(dashboard)/candidates/[id]/page.tsx`.

## Fidelity

**High-fidelity.** All colors, spacing, typography, and component styles are intentional and match the HRHandle design system. Recreate pixel-faithfully using the codebase's shadcn/ui components (Card, Badge, Button, Avatar, Separator, Tabs, etc.) and Tailwind utility classes.

---

## Page Layout

The page lives inside the existing dashboard chrome (`<Sidebar />` + `<Header />`). The candidate page content is rendered in `<main>` with `p-8` padding.

### Top-level grid

```
┌────────────────────────────────────────────────────────────────┐
│  Page header (full width)                                       │
│  Summary strip (full width)                                     │
├────────────────────────────────────┬───────────────────────────┤
│  Left column (1fr)                 │  Right rail (400px, sticky)│
│  ─ Applied vacancies               │  ─ Contact                │
│  ─ Experience (timeline)           │  ─ Documents              │
│  ─ Education                       │  ─ Interviews             │
│  ─ Activity (unified feed)         │  ─ Metadata footer        │
└────────────────────────────────────┴───────────────────────────┘
```

- Outer container: `display: grid; grid-template-columns: 1fr 400px; gap: 20px; align-items: start;`
- Left column children: vertical stack, `gap: 16px`
- Right rail: `position: sticky; top: 24px;`
- Page header and summary strip span the full width above the grid

---

## 1. Page Header

A horizontal bar above the grid.

**Left cluster (flex, gap 14px):**
- **Back button** — 36×36 icon button (`ChevronLeft`), `border: 1px solid border-color`, `bg: white`, `rounded-md`
- **Avatar** — 52×52 circular avatar with initials. `bg: primary/10`, text color `primary`, `font-weight: 600`, `font-size: ~17px`
- **Name block**:
  - `<h1>` — full name. `font-size: 24px; font-weight: 700; letter-spacing: -0.01em`
  - **Status pill** next to name (see Status Pill spec below)
  - **Headline subtitle** — derived from latest experience. Format: `"<title> at <company>"`. `font-size: 13px; color: muted-foreground; margin-top: 4px`

**Right cluster (flex, gap 8px):**
- **Status dropdown** — 36px tall, white background, border. Shows a colored dot (success green) + "Active" + chevron-down. Click opens a dropdown of all statuses.
- **Edit button** — primary button, 36px tall, `<Pencil>` icon + "Edit" label

### Status pill (used in header and throughout)

Rounded full pill. Padding `3px 10px`, font-size `11.5px`, weight 600, no border.

| Status | bg | text |
|---|---|---|
| active | `oklch(0.65 0.17 145 / 0.15)` | `oklch(0.35 0.13 145)` |
| applied | `oklch(0.55 0.18 250 / 0.15)` | `oklch(0.35 0.15 250)` |
| incomplete | `oklch(0.75 0.15 70 / 0.2)` | `oklch(0.38 0.1 70)` |
| in_process | `oklch(0.75 0.15 70 / 0.2)` | `oklch(0.38 0.1 70)` |
| new | `oklch(0.7 0.15 165 / 0.15)` | `oklch(0.35 0.12 165)` |
| hired | `oklch(0.65 0.17 145 / 0.15)` | `oklch(0.35 0.13 145)` |
| rejected | `oklch(0.577 0.245 27 / 0.12)` | `oklch(0.45 0.2 27)` |

---

## 2. Summary Strip

A single horizontal card under the header. Replaces the old "Candidate Profile" card.

- White card, `border: 1px solid border-color`, `rounded-xl (12px)`, padding `14px 20px`, `margin-bottom: 20px`
- Children: flex row, `gap: 28px`, wraps on overflow

**5 items**, each rendered as `<icon> <label>`:

| Icon (Lucide) | Field | Source |
|---|---|---|
| `MapPin` | Location · timezone | new field |
| `Briefcase` | `"<N>+ years experience"` | derived from experience entries (not a stored field) |
| `DollarSign` | Salary expectations | new field |
| `Clock` | `"<N> month notice"` | new field (`noticePeriod`) |
| `Globe` | Languages, comma-joined | new field |

Item style: `display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: foreground; font-weight: 500.` Icon size 15px, color `muted-foreground`.

### Fields REMOVED from this section
- Date of Birth (legally risky)
- Years of Experience (still derivable, but no longer a stored field — compute from `experience[]`)
- Current Position / Current Company (duplicates the latest experience entry — show in the headline instead)

### Fields MOVED to metadata footer (right rail)
- Source
- Added (relative time)
- Last Updated

---

## 3. Applied Vacancies (top of left column)

**The most prominent section on the page.** White card, `rounded-xl`, padding 20px.

**Section header:**
- Title: "Applied vacancies" (`font-size: 15px; font-weight: 700`)
- Subtitle: e.g. `"2 of 5 slots active"` — `font-size: 12px; color: muted-foreground`, separator `·`
- Right action: secondary button, sm size, `<Plus>` icon + "Add to vacancy"

**Vacancy rows (gap 10px):**

Each vacancy = a sub-card: `border: 1px solid border-color; rounded-lg (10px); padding: 16px; background: white`.

Row layout:
1. **Top row** — flex space-between:
   - Left: 36×36 rounded icon container with `bg: primary/10`, `text: primary`, `<Briefcase>` inside
   - Next to icon: vacancy title (14px bold) + status pill (e.g. "Incomplete") on the same line. Below: department · "Applied <relative time>" (12px muted)
   - Right: ellipsis menu button (`MoreHorizontal`)
2. **Pipeline mini bar** — see spec below

### Pipeline mini bar

A horizontal sequence of 5 stage chips with connector lines.

Stages: `Applied → Screening → Interview → Offer → Hired`.

Each chip:
- Pill, padding `3px 9px`, `rounded-full`, font-size `10.5px`, weight 500
- States:
  - **Current**: `bg: primary/15`, text `primary-fg`, `border: 1px solid primary`
  - **Done** (i < currentStageIdx): `bg: success/15`, text `success-fg`, no border
  - **Future**: `bg: muted`, text `muted-foreground`, no border
- Connector line between chips: 8×1px, `bg: success` if previous was done, else `border-color`

---

## 4. Experience (timeline)

White card with section header (`Briefcase` icon + "Experience" + count + ghost "Add" button).

**Layout: vertical timeline** with rail and dots.

- Outer: `position: relative; padding-left: 18px`
- Rail: `position: absolute; left: 5px; top: 6px; bottom: 6px; width: 1px; background: border-color`
- Each row:
  - **Dot** — 11×11 circle on the rail, `position: absolute; left: -18px; top: 13px`. The most recent (top) entry uses filled `primary` background with `primary` border. Others use white bg with `border-color` border.
  - **Row body** — collapsible. Default collapsed = show only title/company/dates. Expanded = show project bullets.
  - Collapsed style: `padding: 10px 12px`, no background
  - Expanded style: same padding, `background: muted`, `border: 1px solid border-color`, `rounded-lg`
  - Right chevron icon rotates 180° on expand

Row contents (collapsed):
- Title (13.5px bold) + `·` + company (12.5px muted) on one line, wraps as needed
- Dates: `"<start> — <end> · <duration>"` (11.5px, muted)

Row contents (expanded — appended below header):
- Top border separator
- Bullet list of project highlights, `font-size: 12.5px`, `color: muted-foreground`, `line-height: 1.55`

The most recent role should be expanded by default; others collapsed.

---

## 5. Education

White card, section header (`GraduationCap` icon + "Education" + count + ghost "Add").

Rows, gap 8px:
- Each row: flex space-between, `padding: 10px 12px`, `rounded-lg`, `border: 1px solid border-color-light`
- Left: school name (13.5px bold) + below it `"<degree>, <field>"` (12px muted)
- Right: `"<startYear> — <endYear>"` (12px muted, weight 500)

---

## 6. Activity (unified feed)

This **merges** what is currently "Notes", "Interviews" status changes, document uploads, and stage changes into a single chronological feed.

White card. Section header: `MessageSquare` icon + "Activity" + count + ghost "Add note" button.

### Filter chips
Row of pill toggles, `margin-bottom: 16px`, gap 6px:
- Options: `All`, `Notes`, `Interviews`, `Stage changes`, `Documents`
- Inactive: `border: 1px solid border-color`, `bg: white`, text `muted-foreground`
- Active: `border: 1px solid primary`, `bg: primary/10`, text `primary-fg`
- All pills: `padding: 5px 12px`, `rounded-full`, `font-size: 11.5px`, weight 500

### Feed items

Vertical list, items connected by a thin line on the left.

Each item:
- **Icon column** (30px wide): 30×30 circular icon container with kind-specific bg/color (see table). Below the icon, a 1px vertical line `bg: border-color` runs down to the next item (except the last).
- **Body column** (flex 1):
  - Headline text (13px, weight 500, foreground)
  - If item is a note: a muted card below with the note text (`bg: muted`, `rounded-lg`, `padding: 10px 12px`, `font-size: 12.5px`)
  - If item has meta: a 12px muted line
  - Footer: `"<actor> · <relative time>"` (11.5px muted)

### Activity kinds

| kind | Icon (Lucide) | icon color | bg |
|---|---|---|---|
| application | `Briefcase` | `primary` | `primary/10` |
| document | `FileText` | `accent` (teal) | `accent/15` |
| stage | `ArrowRight` | `warning-fg` | `warning/20` |
| note | `MessageSquare` | `muted-foreground` | `muted` |
| interview | `Calendar` | `success-fg` | `success/15` |

### Inline note composer (at bottom)

Below the feed, a `1px solid border-light` top separator (margin-top 14, padding-top 14), then a horizontal composer:

`border: 1px solid border-color; rounded-lg; padding: 10px 12px; gap: 10px` containing:
- 28×28 avatar of the current user (initials)
- `<input>` placeholder: "Add a note about this candidate…"
- Primary "Post" button (sm)

---

## Right Rail (400px, sticky)

Vertical stack, `gap: 16px`, sticky `top: 24px`.

### A. Contact

White card, padding 20px. Header: "Contact" (14px bold, no icon).

3 rows, each: 32×32 muted-bg square icon (`Mail` / `Phone` / `Linkedin`) → label/value column → 26×26 copy icon button on the right.

- Label: 10.5px uppercase, weight 500, muted, letter-spacing `0.04em`
- Value: 12.5px foreground (or `primary` if it's a link like LinkedIn)
- Separator between rows: `1px solid border-color-light`

### B. Documents

White card, padding 20px. Header row: "Documents" (14px bold) + secondary sm button with `Upload` icon + "Upload".

Document rows (gap 8px):
- `bg: muted`, `border: 1px solid border-light`, `rounded-md`, `padding: 10px 12px`, flex gap 10
- Left: 28×28 white square with red `FileText` icon, `border: 1px solid border-light`
- Middle: filename (12.5px bold, ellipsis) + meta line `"<size> · <relative time>"` (10.5px muted)
- Right: 26×26 ghost icon button (`ExternalLink`)

### C. Interviews

White card, padding 20px. Header: "Interviews" (14px bold) + secondary sm button with `CalendarPlus` + "Schedule".

Empty state: centered column, padding `24px 0`, gap 8, color `muted-foreground`, 28px `Calendar` icon + caption "No interviews scheduled" (12.5px).

When populated: list of interview rows showing date/time, type, interviewer.

### D. Metadata footer

`background: muted`, `border: 1px solid border-light`, `rounded-lg`, padding `14px 20px`. CSS grid 2 columns, gap `10px 16px`.

4 fields:
- Source — `Public Form`
- Added — relative time (e.g. "9 minutes ago")
- Last updated — date
- Candidate ID — short code, `font-family: mono`

Each field: tiny uppercase label (10px, muted, weight 500, letter-spacing `0.04em`) above a 11.5px bold value.

---

## Interactions & Behavior

- **Status pill in header** is a dropdown — opens a list of statuses; selecting one updates `candidate.status` via Supabase mutation, optimistic UI.
- **Edit button** opens an edit drawer/dialog (existing pattern).
- **Pipeline chip click** (in a vacancy row): opens a stage-change menu for that vacancy.
- **Experience row** click toggles expand/collapse. Smooth height transition 150ms ease.
- **Chevron rotates** 180° on expand (`transform: rotate(180deg); transition: transform 0.15s`).
- **Activity filter chips** — single-select. `All` shows everything; others filter by `kind`.
- **Add note composer** — Enter submits, button posts. Optimistic insert at top of feed.
- **Copy buttons** in Contact — copy value to clipboard, briefly swap icon to a checkmark for ~1.2s.
- **All hover states** follow HRHandle convention: `transition-colors`, `hover:bg-accent` for ghost buttons, `hover:bg-primary/90` for primary.

---

## State Management

Use the existing Supabase + React Server Components pattern. Suggested shape:

```ts
type Candidate = {
  id: string;
  firstName: string;
  lastName: string;
  status: CandidateStatus;
  addedAt: string;
  updatedAt: string;
  source: string;
  // Summary strip
  location: string | null;
  timezone: string | null;
  languages: string[];
  salaryExpectation: string | null;
  noticePeriod: string | null;
  // Contact
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  // Relations
  experience: Experience[];
  education: Education[];
  vacancies: AppliedVacancy[];
  documents: Document[];
  activity: ActivityItem[]; // unified feed
};
```

### New columns to add to the `candidates` table

| column | type | nullable |
|---|---|---|
| `location` | text | yes |
| `timezone` | text | yes |
| `languages` | text[] | yes (default `'{}'`) |
| `salary_expectation` | text | yes |
| `notice_period` | text | yes |

### Activity feed view

The unified `activity` array should come from a Postgres VIEW that UNIONs:
- Vacancy applications (`candidate_vacancies` insert events)
- Stage changes (history table)
- Document uploads
- Notes
- Interview events

Order DESC by created_at.

### Fields to DEPRECATE (do not surface)
- `current_position`, `current_company` — duplicate latest experience
- `years_experience` — compute on the fly (`Date.now() - earliestExperience.start`)
- `date_of_birth` — remove from UI; keep column nullable if needed for legacy data

---

## Design Tokens

Tokens from HRHandle's `colors_and_type.css` (included in this bundle). All values are `oklch()` — Tailwind 4 supports `oklch` natively in arbitrary values.

### Colors

| Token | Light value | Use |
|---|---|---|
| `--color-background` | `oklch(0.985 0.002 247)` | page bg |
| `--color-card` | `oklch(1 0 0)` | card surface |
| `--color-foreground` | `oklch(0.15 0.02 250)` | primary text |
| `--color-muted-foreground` | `oklch(0.5 0.02 250)` | secondary text |
| `--color-border` | `oklch(0.9 0.01 250)` | card/input borders |
| `--color-primary` | `oklch(0.55 0.18 250)` | brand blue |
| `--color-accent` | `oklch(0.7 0.15 165)` | teal |
| `--color-success` | `oklch(0.65 0.17 145)` | green pills |
| `--color-warning` | `oklch(0.75 0.15 70)` | amber pills |
| `--color-destructive` | `oklch(0.577 0.245 27)` | red |
| `--color-muted` | `oklch(0.95 0.01 250)` | subtle bg fills |

Also see `design-system/colors_and_type.css` for the full system.

### Spacing
4px base grid. Card padding `20px`, card gap `16px`, section gap `20px` for the outer grid.

### Radius
- Cards: `12px` (`--radius-xl` equivalent)
- Buttons / sub-cards: `8px` (`--radius-md`)
- Pills / dots: `9999px`

### Typography
- `h1` (name): 24px / 700 / `-0.01em`
- Section title: 15px / 700
- Body: 13px / 500
- Small/meta: 11.5px / 500, muted
- Mono (IDs, dates): DM Mono / Geist Mono

### Shadows
Minimal — borders carry the weight. Cards have no shadow by default. Only the modal/dropdown gets `shadow-lg`.

---

## Assets

- **Icons**: Lucide React (already installed). Specific icons used:
  `ChevronLeft, ChevronDown, ChevronRight, Pencil, Trash2, Mail, Phone, Linkedin, Briefcase, GraduationCap, Calendar, Clock, MapPin, Globe, DollarSign, Plus, Upload, ExternalLink, Copy, FileText, MessageSquare, ArrowRight, Bell, Check, Filter, MoreHorizontal, UserCheck, Sparkles, Search, CalendarPlus`
- **Avatars**: initials-only fallback (current behavior); if/when avatar URLs are added, swap to `<Avatar>` shadcn component with `<AvatarImage>` + `<AvatarFallback>`.
- **No new images or illustrations.**

---

## Files in this bundle

| File | Purpose |
|---|---|
| `Candidate Details.html` | Open in a browser to view the design at full resolution. This is the reference. |
| `v1-recruiter-workbench.jsx` | The page composition — section order, layout grid, what renders where |
| `shared.jsx` | Primitives: `Card`, `Button`, `StatusPill`, `Avatar`, `ContactCard`, `DocumentRow`, `ActivityIcon`, `PipelineMini`, `CandidatePageHeader`, `SummaryStrip`, sidebar/header chrome, color token map `T` |
| `icons.jsx` | Lucide-style stroke SVG icons — implement these using `lucide-react` instead |
| `data.jsx` | Sample candidate data — schema reference; do not ship |
| `design-system/colors_and_type.css` | HRHandle design tokens (color, type, spacing, radius, shadow). Already in the main app |

---

## Implementation checklist

1. [ ] Add new candidate columns: `location`, `timezone`, `languages`, `salary_expectation`, `notice_period`. Generate migration.
2. [ ] Create a Postgres view `candidate_activity` that UNIONs application / stage / document / note / interview events.
3. [ ] Update `candidates` API/RSC to fetch the unified shape.
4. [ ] Build the page at `app/(dashboard)/candidates/[id]/page.tsx`.
5. [ ] Extract reusable components:
   - `<CandidateHeader />`, `<SummaryStrip />`, `<AppliedVacancies />`, `<ExperienceTimeline />`, `<EducationList />`, `<ActivityFeed />`, `<ContactCard />`, `<DocumentsCard />`, `<InterviewsCard />`, `<MetadataFooter />`, `<PipelineMiniBar />`, `<StatusPill />`, `<ActivityIcon />`
6. [ ] Wire interactions: status dropdown mutation, stage change, expand/collapse, filter chips, copy-to-clipboard, inline note composer.
7. [ ] Loading skeletons for each card.
8. [ ] Confirm dark mode renders correctly (all colors are token-driven so it should "just work" through `:root.dark`).
9. [ ] Update the candidates list row's "click → drawer" pattern to navigate to this page instead (or keep both — drawer for triage, page for deep review).
10. [ ] Remove or hide DOB / current position / current company / years-of-experience inputs in the edit form.
