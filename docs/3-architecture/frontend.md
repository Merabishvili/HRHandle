# HRHandle — Frontend Architecture

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

## `components/ui/status-pill.tsx`

Shared status pill used across candidates and applications. `PILL_STYLES` maps status codes to `oklch()`-based Tailwind background + text colour pairs.
