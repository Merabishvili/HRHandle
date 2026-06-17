# Architecture Decisions

## Auth

### token_hash Flow for Email Confirmation

**Decision:** Email confirmation uses `token_hash` via `/auth/confirm` route instead of Supabase's default `{{ .ConfirmationURL }}`.

**Reason:** The default confirmation URL includes a PKCE verifier bound to the browser that initiated the sign-up. If the user opens the confirmation link in a different browser or a mobile app, the verifier is not available and verification fails. The `token_hash` approach calls `supabase.auth.verifyOtp({ token_hash, type })` server-side using the server client, which has no dependency on browser state.

**Files:** `app/auth/confirm/route.ts`, Supabase email template for Confirm signup.

---

### Implicit Flow for Password Reset

**Decision:** The forgot-password page uses `createBrowserClient` with `flowType: 'implicit'` instead of the default PKCE flow.

**Reason:** PKCE generates a code verifier that is stored in `localStorage` on the browser that initiated the reset request. If the reset email is opened in a different browser (e.g. mobile app opens in default browser vs. the browser where the request was made), the server-side `verifyOtp` cannot access the localStorage verifier and fails. The implicit flow generates a plain OTP (token_hash) that the server can verify without browser state.

**Files:** `app/auth/forgot-password/page.tsx`.

---

### OAuth Uses PKCE via `/auth/callback`

**Decision:** Google and Microsoft OAuth sign-in use PKCE via `supabase.auth.signInWithOAuth()` and `app/auth/callback/route.ts`.

**Reason:** OAuth flows stay in the same browser session from start to finish, so the PKCE verifier in localStorage is always accessible when the callback is processed.

**Files:** `app/auth/login/page.tsx`, `components/auth/sign-up-form.tsx`, `app/auth/callback/route.ts`.

---

## Onboarding

### Onboarding Runs Directly in Layout, Not via HTTP Self-fetch

**Decision:** `app/(dashboard)/layout.tsx` calls `runOnboarding(user)` directly instead of calling `POST /api/onboarding` via `fetch()`.

**Reason:** The old approach called `/api/onboarding` via `fetch()` and forwarded cookies. Supabase SSR does not recognise the session from a self-fetch — the cookie forwarding mechanism differs from a real browser request, and `getUser()` returns 401. Calling `runOnboarding()` directly (which uses the admin client) avoids this entirely.

**Files:** `app/(dashboard)/layout.tsx`, `lib/onboarding.ts`.

---

### Admin Client for Post-Onboarding Profile Refetch

**Decision:** After `runOnboarding()` completes, the dashboard layout uses `createAdminClient()` to refetch the profile rather than `createClient()`.

**Reason:** Supabase JWTs are issued at sign-in time and include the user's `organization_id` claim at that point. A newly-onboarded user's JWT does not yet include the `organization_id`, so RLS-scoped queries via the user's own token cannot read the profile row. The admin client bypasses RLS and can read the row immediately.

**Files:** `app/(dashboard)/layout.tsx`.

---

### Admin Client for Storage Signed URLs

**Decision:** `getDocumentSignedUrl()` uses `createAdminClient().storage` to generate signed URLs.

**Reason:** Supabase Storage RLS policies may not allow the user's JWT to create signed URLs for documents in their organization's folder. Using the admin client bypasses storage RLS while the ownership check is enforced in application code (verifying `organization_id` before generating the URL).

**Files:** `lib/actions/documents.ts`.

---

## Data Integrity

### Upsert Instead of Update for Profiles in `acceptInvitation`

**Decision:** `acceptInvitation()` uses `admin.from('profiles').upsert()` rather than `.update()`.

**Reason:** When a user accepts an invitation, they may have just signed up and their profile row may not exist yet in the `profiles` table (Supabase creates the `auth.users` row but the `profiles` row is created by a trigger or onboarding — if the invited user bypassed normal onboarding, the row may be absent). Using `upsert` handles both the "update existing profile" and "create new profile" cases.

**Files:** `lib/actions/invitations.ts`.

---

### Candidate Status Sync on Application Status Change

**Decision:** When an application moves to `hired`, the candidate's `general_status_id` is automatically set to `hired`. When it moves away from `hired` (and no other application is also `hired`), the candidate is reverted to `active`.

**Reason:** The candidate's general status should reflect their overall state across all applications. A candidate with any active `hired` application should show as hired; removing that application should restore them to active unless another hired application exists.

**Files:** `lib/actions/applications.ts`.

---

## Public Apply

### In-Memory Rate Limiting

**Decision:** The public apply action (`lib/actions/public-apply.ts`) limits submissions to 5 per IP per hour using the `applications` table (queries `ip_address` and `created_at`).

**Reason:** This is a database-backed rate limit — not in-memory — and survives server restarts. The API onboarding route (`app/api/onboarding/route.ts`) uses an in-memory `Map` for rate limiting which does reset on server restart.

**Note:** The `/api/onboarding` in-memory rate limiting is documented in `docs/issues-found.md` as a known issue.

---

## Session Management

### `persistSession` Kept at Default (True)

**Decision:** No custom session persistence setting is applied to the Supabase clients. The default behavior (sessions persist across page loads via cookies) is used.

**Reason:** An application-level "remember me" check is implemented in `lib/session.ts` using `localStorage`. The `SessionGuard` component reads `hrhandle_last_active` and can sign the user out if the tab has been inactive, but this is handled at the UI level rather than by Supabase memory-only sessions (which would break SSR).

**Files:** `lib/session.ts`, `components/auth/session-guard.tsx`.

---

## Guides

### Single `/guide` URL serves both in-app help and public marketing

**Decision:** All feature walkthroughs live at public, indexable URLs under `/guide`. The dashboard "Help" link opens `/guide` in a new tab; the same URL is shared with prospects in offers and from the landing page footer. No separate `/help` or behind-auth content.

**Reason:** Both audiences need the same content (annotated screenshots of feature workflows). A shared URL avoids duplicate maintenance, gives SEO benefit, and lets the same link work in marketing emails and in-app help. If audiences diverge later (e.g. need an interactive product tour in-app), the in-app surface can be built on top without breaking shareable links.

**Files:** `app/guide/`, `components/guide/`, `lib/guides/`, `content/guides/*.mdx`, `components/dashboard/help-link.tsx`.

---

### MDX in `content/guides/` for guide content

**Decision:** Guide pages are written as MDX files in `content/guides/` and rendered via `next-mdx-remote/rsc`. A `lib/guides/registry.ts` file is the single source of truth for slug, title, summary, category, and order.

**Reason:** MDX lets each guide embed a `<Screenshot>` component and keeps content version-controlled in the repo (no extra CMS or DB). `next-mdx-remote/rsc` compiles MDX inside a Server Component at request time, sidestepping Turbopack/webpack MDX loader configuration. The registry file decouples ordering and navigation from filesystem state — guides can be planned (in the registry) before their MDX file exists, and the index page shows "Coming soon" for unwritten ones.

**Files:** `lib/guides/registry.ts`, `lib/guides/loader.ts`, `app/guide/[slug]/page.tsx`, `content/guides/*.mdx`.

---

### Playwright auto-captures annotated screenshots from staging

**Decision:** Guide screenshots are generated by `scripts/capture-screenshots.ts` (Playwright) running against `staging.hrhandle.com` with a dedicated demo organization seeded by `scripts/seed-demo-org.ts`. Annotations (red arrows, numbered boxes) are CSS-selector based DOM overlays injected via `page.evaluate()` before the screenshot is taken.

**Reason:** Auto-capture keeps the guide in sync with the real UI; rerunning the script after any UI change produces an updated, correctly-aligned screenshot. Selector-based annotations follow elements when the layout shifts, so labels never need manual repositioning. The annotations being part of the captured PNG means the public guide pages need no client-side overlay logic.

**Files:** `scripts/capture-screenshots.ts`, `scripts/screenshot-config.ts`, `scripts/seed-demo-org.ts`.

---

### Screenshot script authenticates via admin-generated magiclink

**Decision:** `scripts/capture-screenshots.ts` does not call `signInWithPassword`. It uses the Supabase admin client (with the legacy JWT service_role key) to call `auth.admin.generateLink({ type: 'magiclink', email })`, extracts the `hashed_token`, and exchanges it for a session via the anon client's `verifyOtp`. The resulting session is serialized and injected as a cookie into the Playwright browser context.

**Reason:** Supabase's auth backend has Turnstile (captcha) enforcement enabled at the project level, which blocks `signInWithPassword` for non-browser callers (returns `captcha_failed`). `verifyOtp` does not require a captcha because the token comes from a server-trusted source. The admin path also sidesteps the Cloudflare Turnstile widget that fronts the login form itself.

**Files:** `scripts/capture-screenshots.ts`.

---

### Screenshot script ships a Vercel Deployment Protection bypass header

**Decision:** When `VERCEL_PROTECTION_BYPASS` is set, the screenshot script's Playwright context sends `x-vercel-protection-bypass: <token>` and `x-vercel-set-bypass-cookie: true` on every request. The token comes from Vercel Project Settings → Deployment Protection → Protection Bypass for Automation.

**Reason:** Staging is gated behind Vercel Authentication. Without a bypass, headless Chromium lands on Vercel's "Log in to Vercel" page instead of the HRHandle app, so the injected Supabase cookie has nowhere useful to take effect.

**Files:** `scripts/capture-screenshots.ts`, `.env.local` (developer machine only — never committed, never set on Vercel).

---

### GFM markdown features enabled in guide MDX via remark-gfm

**Decision:** `app/guide/[slug]/page.tsx` passes `remarkPlugins: [remarkGfm]` to `MDXRemote`. `components/guide/mdx-components.tsx` provides styled overrides for the elements GFM emits (`table`, `thead`, `tbody`, `tr`, `th`, `td`).

**Reason:** Default `next-mdx-remote` only handles CommonMark, which silently collapses pipe-delimited tables into a paragraph. The guides rely on tables (status definitions, role permissions, field types, etc.), so GFM is required for the markdown to render correctly.

**Files:** `app/guide/[slug]/page.tsx`, `components/guide/mdx-components.tsx`.

---

## Redesign Audit (2026-06-15 / 2026-06-16)

### Redesign deliverables live in `docs/redesign/`, source materials in `redesign/`

**Decision:** A full UX/IA audit + revised roadmap + per-flow mobile design for the proposed HRHandle redesign (zipped handoff package `Redisign New.zip`) is captured at:
- [`docs/redesign/audit.md`](redesign/audit.md) — critical audit (cross-cutting problems, regression risk register, per-screen audit, inconsistencies, mobile assessment, feasibility flags, open questions)
- [`docs/redesign/roadmap.md`](redesign/roadmap.md) — revised roadmap with KEEP / REVISE / DROP / ADD verdicts on each item from the redesign's `ROADMAP.md`, plus a new Phase 0 of foundation pre-work
- [`docs/redesign/mobile/`](redesign/mobile/) — design output for the four must-work-on-phone flows (apply form / candidate profile / offer approval / today's interviews)
- [`docs/redesign/flows/`](redesign/flows/) — per-screen detailed analyses, written one per session after roadmap sign-off

Source materials (the extracted zip — `.dc.html` files, screenshots, the redesign's own ROADMAP/SCREEN-SPECS/REDESIGN-DECISIONS docs) live at `redesign/` at the repo root and are **gitignored**.

**Reason:** Two roadmap concepts must not be confused: `docs/1-product/roadmap.md` is the product roadmap (what features to ship). The redesign roadmap is a *different* sequence (how to rebuild existing UI). The redesign roadmap is **standalone** — it does not interleave with Phase 9 / Phase 10 of the product roadmap, but it flags coordination notes where work overlaps (e.g., Wave 2.4 vacancy detail rebuild conflicts with A-005 RHF migration on `vacancy-form.tsx`).

The audit is deliberately adversarial — its goal is to expose problems in the redesign before implementation, not to validate it. Key findings include: the redesign was authored against an older snapshot of HRHandle (G-022 → G-032 features are not reconciled); `application_statuses` has no `type` column so custom stages is a real schema migration (XL effort, not M); the scorecard data model already exists (`vacancy_questions` + `candidate_evaluations`); Migration 022's candidate-status sync trigger has a silent bug (looks for non-existent `'inactive'` code); S11 AI Fit Analysis is blocked by your Phase 8 EU AI Act framework.

**Files (audit deliverables):** `docs/redesign/audit.md`, `docs/redesign/roadmap.md`, `docs/redesign/mobile/*.md`. **Files (source):** `redesign/` (gitignored). **Files (related):** `docs/1-product/roadmap.md` (carries a one-line "see also" link).

---

## TODO/FIXME/HACK Comments Found in Code

- `lib/actions/notifications.ts` line 74: `// Non-fatal: notifications table may not exist yet` — suggests notifications was added after the initial schema
- `lib/actions/interviews.ts` line 287: `// Email failure is non-fatal — interview was already created`
- `lib/actions/public-apply.ts` line 165: `// Already applied to this vacancy — silently succeed (same UX for the applicant)` — duplicate applications from the public form are silently accepted
- `app/(dashboard)/layout.tsx` line 77: dynamic import of admin client inside the layout to avoid bundling issues
- `app/jobs/[slug]/page.tsx` line 14: `// 2. Fallback: UUID public_page_token (backward compat with old shared links)` — old links using UUIDs still work
