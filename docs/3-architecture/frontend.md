# HRHandle — Frontend Architecture

_Last updated: 2026-05-08_

## Changelog

- 🆕 `components/candidates/candidate-table-row.tsx` & `candidate-optional-cell.tsx` — the Candidates list page (`app/(dashboard)/candidates/page.tsx`) was split (A-002): row + optional-column rendering extracted into these server components, and the fit-score / stage / custom-field shaping moved to the pure `lib/candidates/list-derivation.ts` (unit-tested). The page keeps only the queries + orchestration.
- 🆕 `components/candidates/experience-section.tsx` & `education-section.tsx` — timeline-style editors on candidate detail page
- 🆕 `components/candidates/activity-feed.tsx` — reads the rebuilt `candidate_activity` view (kind/headline/body/meta/actor_name)
- 🆕 `components/vacancies/linkedin-post-job-button.tsx` — uses the saved LinkedIn page ID
- 🆕 `components/apply/apply-form.tsx` — public form now CV-parses on upload (silent failures shown as "could not auto-fill")
- 🔄 `components/vacancies/vacancy-form.tsx` has grown to ~40 KB — flagged for splitting (`A-large-files` in issues-found.md)

---

## Framework & Key Libraries

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | ^16.2.0 | App Router, Server Components, Server Actions |
| `react` | ^19.2.5 | UI rendering |
| `@supabase/ssr` | ^0.10.2 | SSR-safe Supabase client |
| `@supabase/supabase-js` | ^2.104.0 | Admin client |
| `tailwindcss` | ^4.2.0 | Utility-first styling |
| `@radix-ui/*` | various | Accessible component primitives |
| `shadcn/ui` | — | Pre-built components using Radix + Tailwind |
| `react-hook-form` | ^7.54.1 | Form state management |
| `@hookform/resolvers` | ^3.9.1 | Zod integration for react-hook-form |
| `zod` | ^3.24.1 | Schema validation |
| `@dnd-kit/core` | ^6.3.1 | Drag-and-drop (Kanban pipeline) |
| `@dnd-kit/sortable` | ^10.0.0 | Sortable DnD |
| `date-fns` | 4.1.0 | Date formatting |
| `lucide-react` | ^0.564.0 | Icon library |
| `sonner` | ^1.7.1 | Toast notifications |
| `next-themes` | ^0.4.6 | Dark/light mode support |
| `@marsidev/react-turnstile` | ^1.5.2 | Cloudflare Turnstile CAPTCHA |
| `resend` | ^6.12.2 | Email delivery SDK |
| `@sentry/nextjs` | ^10.49.0 | Error tracking |
| `@vercel/analytics` | 1.6.1 | Vercel Analytics |

## All Routes

### Public Routes
| Path | File | Description |
|------|------|-------------|
| `/` | `app/page.tsx` | Landing page / redirect to dashboard if signed in |
| `/auth/login` | `app/auth/login/page.tsx` | Login page with email + Google + Microsoft |
| `/auth/sign-up` | `app/auth/sign-up/page.tsx` | Registration page |
| `/auth/forgot-password` | `app/auth/forgot-password/page.tsx` | Password reset request |
| `/auth/reset-password` | `app/auth/reset-password/page.tsx` | Password reset form |
| `/auth/sign-up-success` | `app/auth/sign-up-success/page.tsx` | Post sign-up confirmation prompt |
| `/auth/reset-password-success` | `app/auth/reset-password-success/page.tsx` | Post reset success page |
| `/auth/error` | `app/auth/error/page.tsx` | Auth error display |
| `/auth/confirm` | `app/auth/confirm/route.ts` | Token verification route (GET) |
| `/auth/callback` | `app/auth/callback/route.ts` | OAuth PKCE code exchange (GET) |
| `/apply/[token]` | `app/apply/[token]/page.tsx` | Public candidate application form |
| `/jobs/[slug]` | `app/jobs/[slug]/page.tsx` | Public org job listings |
| `/join` | `app/join/page.tsx` | Team invitation acceptance |
| `/privacy` | `app/privacy/page.tsx` | Privacy policy |
| `/terms` | `app/terms/page.tsx` | Terms and conditions |
| `/refund` | `app/refund/page.tsx` | Refund policy |
| `/guide` | `app/guide/page.tsx` | Public guide index (categories + FAQ) |
| `/guide/[slug]` | `app/guide/[slug]/page.tsx` | Public guide article (MDX rendered) |

### Authenticated Dashboard Routes
| Path | File | Description |
|------|------|-------------|
| `/dashboard` | `app/(dashboard)/dashboard/page.tsx` | Stats, recent candidates, vacancies, interviews |
| `/vacancies` | `app/(dashboard)/vacancies/page.tsx` | Vacancy list |
| `/vacancies/new` | `app/(dashboard)/vacancies/new/page.tsx` | New vacancy form |
| `/vacancies/[id]` | `app/(dashboard)/vacancies/[id]/page.tsx` | Vacancy detail + applications |
| `/vacancies/[id]/edit` | `app/(dashboard)/vacancies/[id]/edit/page.tsx` | Edit vacancy |
| `/vacancies/[id]/pipeline` | `app/(dashboard)/vacancies/[id]/pipeline/page.tsx` | Kanban pipeline |
| `/candidates` | `app/(dashboard)/candidates/page.tsx` | Candidate list |
| `/candidates/new` | `app/(dashboard)/candidates/new/page.tsx` | New candidate form |
| `/candidates/[id]` | `app/(dashboard)/candidates/[id]/page.tsx` | Candidate detail |
| `/candidates/[id]/edit` | `app/(dashboard)/candidates/[id]/edit/page.tsx` | Edit candidate |
| `/interviews` | `app/(dashboard)/interviews/page.tsx` | Interview list |
| `/interviews/new` | `app/(dashboard)/interviews/new/page.tsx` | Schedule interview |
| `/settings` | `app/(dashboard)/settings/page.tsx` | Redirects to `/settings/profile` |
| `/settings/profile` | `app/(dashboard)/settings/profile/page.tsx` | Profile + password |
| `/settings/organization` | `app/(dashboard)/settings/organization/page.tsx` | Org name + logo |
| `/settings/team` | `app/(dashboard)/settings/team/page.tsx` | Team members + invitations |
| `/settings/rejection-reasons` | `app/(dashboard)/settings/rejection-reasons/page.tsx` | Rejection reasons + templates |
| `/settings/email-templates` | `app/(dashboard)/settings/email-templates/page.tsx` | Email template editor |
| `/settings/custom-fields` | `app/(dashboard)/settings/custom-fields/page.tsx` | Custom field builder |
| `/settings/integrations` | `app/(dashboard)/settings/integrations/page.tsx` | Google/Zoom/Microsoft connections |
| `/settings/billing` | `app/(dashboard)/settings/billing/page.tsx` | Redirects to `/subscription` |
| `/subscription` | `app/(dashboard)/subscription/page.tsx` | Plan selection |

### API Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/onboarding` | Trigger onboarding (external use) |
| GET | `/api/auth/google` | Start Google OAuth |
| GET | `/api/auth/google/callback` | Google OAuth callback |
| POST | `/api/auth/google/disconnect` | Disconnect Google |
| GET | `/api/auth/zoom` | Start Zoom OAuth |
| GET | `/api/auth/zoom/callback` | Zoom OAuth callback |
| POST | `/api/auth/zoom/disconnect` | Disconnect Zoom |
| GET | `/api/auth/microsoft` | Start Microsoft OAuth |
| GET | `/api/auth/microsoft/callback` | Microsoft OAuth callback |
| POST | `/api/auth/microsoft/disconnect` | Disconnect Microsoft |
| GET | `/api/cron/expire-vacancies` | Cron: expire past vacancies |
| GET | `/api/export/candidates` | Download candidates CSV |
| GET | `/api/export/applications?vacancy_id=` | Download applications CSV |

## State Management

HRHandle does not use a global client-side state manager (no Redux, Zustand, etc.).

- **Server state**: fetched in Server Components and passed as props.
- **Form state**: `react-hook-form` with Zod resolvers in client components.
- **Mutations**: Next.js Server Actions return `ActionResult<T>`; components handle success/error locally.
- **Cache invalidation**: `revalidatePath()` called after mutations to refresh Server Component data.
- **Toast notifications**: `sonner` via `components/ui/sonner.tsx`.
- **UI state** (modals, tabs, etc.): local `useState` in individual components.
- **Lookup tables** (statuses, sectors): fetched with `unstable_cache` from `lib/cache/lookups.ts`, 1-hour TTL.

## Component Conventions

- **Server Components**: default in `app/` directory; fetch their own data.
- **Client Components**: declared with `'use client'`; used for interactivity, forms.
- **Server Actions**: files start with `'use server'`; always return `ActionResult<T>`.
- **UI primitives**: `components/ui/` — shadcn/ui components (accordion, button, card, dialog, etc.).
- **Feature components**: `components/[domain]/` — compose UI primitives, call server actions.
- **cn() utility**: `lib/utils.ts` — combines `clsx` + `tailwind-merge` for conditional class names.

### Forms — react-hook-form + zod (A-005)

Larger edit forms use **react-hook-form** with a **zodResolver**, not hand-rolled `useState` + manual `validateForm`. Adopted on the vacancy and candidate forms:

- `components/vacancies/vacancy-form.tsx` — owns `useForm`, the submit/`onInvalid` handlers, and the server-action call. Splits its cards into section components under `components/vacancies/form/` (`basic-info-section`, `dates-compensation-section`, `details-section`), each receiving the `UseFormReturn` and rendering fields via `register` (native inputs/textareas) or `Controller` (Select / DatePicker / Switch / numeric inputs that need `null`-vs-number semantics).
- `components/candidates/candidate-form.tsx` — RHF owns the ~11 core profile fields (`CandidateFormSchema`); the rest stays local `useState` because it's orchestration, not form data: CV-parse state, the two-path entry mode, pending experience/education, queued documents, the initial note, custom fields. Split into `components/candidates/form/` — `personal-info-section` + `recruitment-details-section` (RHF), and `pending-experience-card` + `pending-education-card` (create-only editors that own their own draft state and commit entries via `onAdd`/`onRemove`).
- **Two schemas per form.** The server-payload schema (e.g. `VacancySchema`) is nullable; the form-facing schema (`VacancyFormSchema`) is `''`/sentinel-based to match what the controls emit, and additionally requires fields the UI enforces (sector + status). The submit handler converts the form values (`''` / `WORK_MODE_NONE` → `null`) into the server payload. This split is intentional — the live form and the DB payload genuinely have different shapes.
- Scroll-to-first-error on submit is preserved via an `onInvalid` handler that maps the first error field (by a fixed priority) to a DOM id and scrolls + focuses it.
- Non-form orchestration state (custom-field values, loading, server error) stays in `useState` alongside the form.

## Guide pattern (`content/guides/*.mdx` + `lib/guides/`)

Guides are static MDX files in `content/guides/`, registered in `lib/guides/registry.ts` (slug, title, summary, category, order). The `[slug]` route uses `next-mdx-remote/rsc` to compile MDX server-side at request time and `generateStaticParams` to prerender every guide that has an MDX file. `remark-gfm` is passed in `MDXRemote` options so GitHub-flavored markdown tables render. Custom `<Screenshot>` is the only authoring component required; styled defaults for headings, lists, links, and GFM tables live in `components/guide/mdx-components.tsx`.

Annotated screenshots are produced by `scripts/capture-screenshots.ts` (Playwright). Each shot in `scripts/screenshot-config.ts` declares a URL, optional pre-actions, and CSS-selector-based annotations. The script logs into a seeded demo org on staging, navigates, injects DOM overlays (red arrows + numbered boxes), and saves PNGs to `public/guide/screenshots/`.

## Candidate Components (`components/candidates/`)

| File | Type | Purpose |
|---|---|---|
| `status-pill.tsx` | Server | Coloured pill badge for any entity status; `PILL_STYLES` map keys on status `code` |
| `summary-strip.tsx` | Server | Horizontal card showing: location/timezone, years experience (computed from `candidate_experience`), salary expectation, notice period, languages. Returns null when all fields are empty. |
| `pipeline-mini-bar.tsx` | Server | Read-only 5-stage progress bar (Applied → Screening → Interview → Offer → Hired). Accepts `currentStageCode`; done stages green, active highlighted, future muted. Used inside `application-evaluation.tsx`. |
| `contact-card.tsx` | Client | Email, phone, LinkedIn rows with copy-to-clipboard buttons. Checkmark shown for 1.2 s after copy. |
| `metadata-footer.tsx` | Server | 2-col grid: Source, Added (relative), Last Updated, Candidate ID (short, monospace). |
| `activity-feed.tsx` | Client | Unified activity feed consuming `candidate_activity` view rows. Filter chips (All / Notes / Interviews / Stage changes / Documents). Inline note composer (Enter to post). Delete on note items. |
| `experience-section.tsx` | Client | Timeline with absolute left rail + dots. First entry expanded by default; others collapsed. Each entry expandable/collapsible. Edit/Delete buttons in expanded body. |
| `candidate-table-row.tsx` | Server | One row of the `/candidates` list — fixed columns (name / status / linked vacancy) + active optional columns (via `candidate-optional-cell.tsx`) + row actions menu. |
| `candidate-optional-cell.tsx` | Server | Renders the correct `<TableCell>` for one optional/custom column key (position, email, stage badge, fit %, custom fields, …). |

`lib/candidates/list-derivation.ts` holds the page's pure shaping helpers (`groupApplicationsByCandidate`, `aggregateFitScores`, `deriveStageAndFit`, `formatCustomFieldValue`, `buildCustomFieldValueMap`) plus the shared row types — unit-tested in `lib/candidates/__tests__/`.

## `components/ui/status-pill.tsx`

Shared status pill used across candidates and applications. `PILL_STYLES` maps status codes to `oklch()`-based Tailwind background + text colour pairs.

## Recent additions (2026-06-18 redesign session)

Shipped as Wave 1 / Wave 2 partials of the [redesign](../redesign/) corpus.

### New components

| File | Type | Purpose |
|---|---|---|
| `components/ui/ai-draft-tag.tsx` | Server | Calm-blue Sparkles + label pill on AI-generated output. Replaces the pre-S10 alarm-orange "AI-GENERATED — RECRUITER HAS NOT REVIEWED OR EDITED" stamp. Default label "AI draft"; alternatives "AI suggestion" (bias-check, assessment-suggester), "AI-filled · review" (CV parse), "AI-assisted" (persisted provenance). |
| `components/ui/ai-draft-panel.tsx` | Client | Shared shell for the invoke → draft → review → confirm pattern (S10 §2.3). 4-state status prop (`idle` / `generating` / `ready` / `error`). Forward-looking for new AI surfaces (AI Fit Analysis, future scorecard-from-notes UIs). |
| `components/dashboard/trial-pill.tsx` | Server | Compact amber pill in the header right cluster, replacing the deleted full-width `TrialBanner`. Renders only when `subscription.status === 'trial'` and `trial_end_at` is set. `daysRemaining()` helper exported for unit tests. |
| `components/vacancies/copy-apply-link-button.tsx` | Client | Header-level "Copy apply link" — clipboard write + sonner toast + brief Check icon swap + graceful error if blocked. Renders only when `vacancy.application_form_token` is set. |
| `components/settings/notification-preferences-form.tsx` | Client | Switch-based form for `profiles.notification_preferences` JSONB. 6 email events + 2 in-product toggles; whole-object replace on save. |

### Settings nav restructure

`components/settings/settings-nav.tsx` rewritten from a flat 10-item array to a grouped `NAV_SECTIONS` array of 4 sections: **Personal** (Profile / Notifications / Security) · **Organization** (Organization / Team / Billing) · **Hiring workflow** (Custom fields / Email templates / Rejection reasons / Integrations) · **Data** (Audit log / Trash). Section labels in small-caps muted text; section hidden if every item filters out by role. See [`docs/redesign/flows/S07-settings.md`](../redesign/flows/S07-settings.md) §2.1.

### Removed components

| File | Replacement |
|---|---|
| `components/dashboard/trial-banner.tsx` | `components/dashboard/trial-pill.tsx`. The expired-trial branch was unreachable dead code (the layout redirects to `/settings/billing` before render). |
| `components/candidates/candidate-status-select.tsx` | None — candidate status is derived from applications via the Migration 022 sync trigger (fixed in 044). The `general_status_id` column stays as the trigger's cache; the editable dropdown is gone per Q1. |

### New routes

| Route | Notes |
|---|---|
| `/pipeline` | Wave 2.1 scaffolding. Has vacancy → redirect to most-recently-created open (then draft, then any) vacancy's `/vacancies/[id]/pipeline`. Zero vacancies → welcome card with "Create your first vacancy" + "Import candidates" + 3-step orientation strip (locked Q-S01-e). Replaced by the real cross-vacancy kanban in Wave 2.1 full. |
| `/settings/notifications` | Personal → Notifications. Renders `NotificationPreferencesForm`. |
| `/settings/security` | Personal → Security. Composes `ChangePasswordForm` + `TwoFactorSection` lifted out of `/settings/profile`. Per-user MFA only — org-wide MFA policy stays on `/settings/organization` per locked Q8. |
| `/settings/billing` | Was a 5-line redirect to `/subscription`; now hosts the 277-LOC billing UI. The legacy `/subscription` route is the redirect (kept ~6 months per Q-S7-g). |

### Sidebar nav

`components/dashboard/sidebar.tsx`: removed the standalone "Subscription" entry (under Settings → Organization → Billing now); added "Pipeline" (KanbanSquare icon) between Dashboard and Vacancies. Dashboard stays until the full Wave 2.1 kanban replaces it as the post-login landing.
