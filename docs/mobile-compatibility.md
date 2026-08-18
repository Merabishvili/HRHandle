# Mobile & Responsive Compatibility

_Last updated: 2026-07-20_

**Method (read this first).** This audit is **static** — the audit environment has no browser renderer, so findings are derived from reading Tailwind classes + markup, not from pixel-rendering pages at real breakpoints. Treat "Mobile OK?" as *"no code-level red flags found"*, not *"visually verified"*. Breakpoints referenced follow Tailwind defaults: `sm` 640px, `md` 768px, `lg` 1024px. Target checks: ~375px (mobile), ~768px (tablet), ~1280px+ (desktop).

**What was checked per page/component:** fixed pixel widths vs `max-w-`/responsive units; tables wrapped for horizontal scroll; grids with responsive column prefixes; horizontal-overflow risks; touch-target sizing; modal/table/nav adaptation.

## Cross-cutting findings

- ✅ **Viewport:** Next.js App Router injects the responsive viewport meta by default (no custom `viewport` override removes it). No issue.
- ✅ **Large fixed widths are safe:** every large `w-[1360px]/[1000px]/[920px]/[860px]` occurrence is actually `mx-auto max-w-[…]` or `w-full max-w-[…]` — content caps at that width and shrinks below it. Not a mobile bug.
- ✅ **Dashboard shell** (`components/ui/sidebar.tsx`) uses the shadcn sidebar with a mobile `Sheet` drawer — nav adapts to small screens.
- ✅ **Most list/detail grids** use `sm:grid-cols-2` / `sm:grid-cols-3` (single column on mobile) — the vacancy + candidate forms, settings, and detail pages reflow.
- ⚠️ **Tables are the main risk.** Several data tables are **not** wrapped for horizontal scroll (see MO-201/202/203 in `issues-found.md`). Wide tables overflow or clip on mobile rather than scrolling.
- ℹ️ **Touch targets:** ~25 `size="icon"` buttons render at shadcn's `h-9 w-9` (~36px) — under the 44px WCAG target-size ideal but acceptable; a handful of `h-7 w-7` row-action buttons (delete/remove in lists) are small (~28px) and close together on mobile. Low priority.

## Page-by-page status

Grouped by area. "Issues" references the MO-2xx IDs in `issues-found.md`.

| Page / Route | Mobile OK? | Issues | Notes |
|---|---|---|---|
| `/` (marketing landing) | ✅ | — | `max-w` container, responsive sections. |
| `/apply/[token]` (public apply) | ✅ | — | `apply-form.tsx` uses single-column stacking; the public candidate-facing flow is a designed must-work-on-phone surface. |
| `/status/[token]` (candidate status) | ✅ | — | Single-column, mobile-first. |
| `/offer/[token]` (offer accept/decline) | ✅ | — | Single-column, mobile-first. |
| `/jobs`, `/jobs/[slug]` (public jobs) | ✅ | — | Responsive cards. |
| `/auth/*` (login/sign-up/reset/MFA) | ✅ | AC-201 | Centered card. MFA QR container missing an aria-label (AC-201). |
| `/pipeline` (home / cross-vacancy board) | ⚠️ | — | Kanban is horizontally scrollable by design; `cross-vacancy-board.tsx` (698 LOC) — columns scroll on mobile (acceptable for a kanban). List-view variant → MO-202. |
| `/pipeline` list view | ⚠️ | MO-202 | `list-view.tsx` table inside `overflow-hidden` → clips wide rows on mobile instead of scrolling. |
| `/candidates` (list) | ✅ | — | `<Table>` is wrapped in `overflow-x-auto` (verified) — scrolls on mobile. Optional columns can make it wide but scroll works. |
| `/candidates/new`, `/candidates/[id]/edit` | ✅ | — | `candidate-form.tsx` + section components use `sm:grid-cols-2`; single column on mobile. |
| `/candidates/[id]` (profile) | ✅ | — | `profile-shell.tsx` `max-w-[1360px]`, responsive rail. |
| `/candidates/import` (wizard) | ⚠️ | MO-203 | CSV preview table lacks a horizontal-scroll wrapper. |
| `/vacancies` (list) | ✅ | — | Table wrapped for scroll. |
| `/vacancies/new`, `/vacancies/[id]/edit` | ✅ | — | RHF form + section components, `sm:grid-cols-*`. |
| `/vacancies/[id]` (detail) | ✅ | — | `max-w-[1360px]`, responsive. |
| `/vacancies/[id]/pipeline` | ⚠️ | — | Per-vacancy board — same kanban-scroll model as `/pipeline`. |
| `/interviews`, `/interviews/new` | ✅ | — | `interview-form.tsx` capped at `max-w-[920px]`, mobile single-column + sticky footer recap (designed for phone). |
| `/reports/pipeline` | ⚠️ | MO-201 | Funnel + table; table not wrapped for horizontal scroll. |
| `/reports/sources` | ⚠️ | MO-201 | Source-effectiveness table not wrapped for scroll. |
| `/reports/time-to-hire` | ⚠️ | MO-201 | Per-vacancy breakdown table not wrapped for scroll. |
| `/settings/profile` | ✅ | — | Single-column form + avatar. |
| `/settings/organization` | ✅ | — | Responsive. |
| `/settings/team` | ✅ | — | Member list; rows use small ⋯ menus (touch-target note). |
| `/settings/integrations/*` | ✅ | — | Cards stack. |
| `/settings/pipeline-stages`, `/settings/custom-fields` | ⚠️ | — | Drag-and-drop managers (`pipeline-stages-manager.tsx` 594 / `custom-fields-manager.tsx` 592) — DnD is awkward on touch but functional; no layout break found. |
| `/settings/audit-log` | ✅ | — | Filters + table wrapped for scroll. |
| `/settings/security` | ✅ | — | Session list. |
| `/settings/trash`, `/settings/rejection-reasons`, `/settings/notifications`, `/settings/email-templates` | ✅ | — | Responsive lists/forms. |
| `/subscription` | ✅ | — | Plan cards stack. |
| `/onboarding/*` | ✅ | — | Centered single-column. |

## Recommended remediation order

1. **MO-201 / MO-202 / MO-203** — wrap the 5 unwrapped tables in `overflow-x-auto`. Small, mechanical, removes the only genuine layout-break risk.
2. Touch-target pass — bump `h-7 w-7` row-action buttons to `h-8 w-8` (or add spacing) on list rows.
3. Visual verification — when a browser-capable tool is available, render `/pipeline` (both views), `/reports/*`, and `/candidates/import` at 375px to confirm the table fixes and check the kanban/DnD ergonomics.
