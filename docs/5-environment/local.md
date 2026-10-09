# Local Development Setup

_Last updated: 2026-05-08_

## Changelog

- 🆕 Set `GOOGLE_GEMINI_API_KEY` if you want CV parsing to work locally — otherwise parse calls return `parse_failed` silently
- 🆕 Set `CRON_SECRET` to any random string if you want to test `/api/cron/expire-vacancies` locally
- 🆕 Turnstile test site key `1x00000000000000000000AA` (always passes) is recommended for local — saves you setting up a real key

---

## Prerequisites

- Node.js 24+ (pinned via `.nvmrc` / `engines.node`; Vercel disables Node 20 builds on 2026-10-01)
- npm (or compatible package manager)
- A Supabase account with a project (or use the staging project `hrhandle-staging` with read access)
- Git

## 1. Clone and Install

```bash
git clone <repo-url>
cd HRHandle-staging
npm install
```

## 2. Create `.env.local`

Create a file named `.env.local` in the project root. Required variables:

```bash
# Supabase — required
NEXT_PUBLIC_SUPABASE_URL=https://quotchdymcnjlnwtjmgu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from Supabase dashboard>
SUPABASE_SERVICE_ROLE_KEY=<service role key from Supabase dashboard>

# Email — optional (emails silently fail if not set)
RESEND_API_KEY=re_xxxxxxxxxxxx

# Site URL — optional; used in email links and OAuth redirects
# Do not set to an empty string — env validation will throw
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Auth redirect for local dev — overrides emailRedirectTo in sign-up
# Needed so confirmation emails redirect back to localhost instead of production
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/callback

# Turnstile CAPTCHA — optional (login/signup will fail the captcha check if omitted)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<site key from Cloudflare Turnstile dashboard>

# Google Calendar integration — optional
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Zoom integration — optional
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=

# Microsoft integration — optional
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# Cron protection — optional (cron endpoint will reject all requests if not set)
CRON_SECRET=any-local-secret

# Sentry — optional (monitoring disabled if not set)
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
```

Get the Supabase keys from: Supabase Dashboard → Project Settings → API.

## 3. Supabase Setup

### Option A: Use the Staging Supabase Project (Recommended)

Use the staging project ID `quotchdymcnjlnwtjmgu`. Copy the URL and keys from the Supabase dashboard. The schema and seed data are already in place.

You must have redirect URLs configured in Supabase Auth:
- `http://localhost:3000/**` must be in the allowed redirect URLs list

### Option B: Use a Local Supabase Instance

1. Install Supabase CLI: `npm install -g supabase`
2. `supabase init`
3. `supabase start`
4. Apply migrations from `supabase/migrations/` (if present in repo)
5. Seed lookup data: `application_statuses`, `candidate_statuses`, `vacancy_statuses`, `sectors`
6. Update `.env.local` with local URLs/keys from `supabase status`

## 4. Turnstile CAPTCHA for Local Dev

If `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is not set, login and sign-up forms will wait indefinitely for the captcha token (the Turnstile widget will not render). Options:

- Use a Cloudflare Turnstile test site key that always passes: `1x00000000000000000000AA`
- Or temporarily remove the captcha check in the form (do not commit)

The corresponding Turnstile secret key must be set in the Supabase CAPTCHA dashboard (Auth → CAPTCHA). For local development, configure a separate Turnstile site/secret pair, or disable CAPTCHA in the Supabase project temporarily.

## 5. Run the Development Server

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

## 6. Running Tests

```bash
npm test        # Run all tests once
npm run test:watch  # Watch mode
```

Tests use Vitest with the Node environment. Test files match `**/__tests__/**/*.test.ts` and `**/__tests__/**/*.test.tsx`.

Current test files:
- `__tests__/validations.test.ts` — schema validation, public apply logic, evaluation scoring
- `lib/validations/__tests__/candidate.test.ts`
- `lib/validations/__tests__/vacancy.test.ts`
- `lib/validations/__tests__/interview.test.ts`
- `lib/__tests__/email-template-utils.test.ts`
- `lib/__tests__/session.test.ts`

## 7. Building for Production (Local Check)

```bash
npm run build
```

This runs TypeScript type checking and Next.js build. The build will fail on any TypeScript errors (`ignoreBuildErrors: false` in `next.config.mjs`).

Note: The CI pipeline uses hardcoded placeholder env vars in the build step to avoid needing real secrets. For a full local build, all required env vars must be set.

## Useful Notes

- The dashboard is under `app/(dashboard)/` — requires authenticated session
- Public pages: `/jobs/[slug]`, `/apply/[token]`, `/join`
- Auth pages: `/auth/login`, `/auth/sign-up`, `/auth/forgot-password`, `/auth/reset-password`
- If you sign up locally, you must confirm the email before accessing the dashboard — the confirmation email will use `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` as the redirect base if set

## Capturing guide screenshots

The guide (`/guide`) is written in English, Georgian and Russian, and every screenshot exists in all three languages (`public/guide/screenshots/<locale>/`). Playwright captures them from a **local production build that uses the staging database**:

```bash
# 1. Install browser binaries (once)
npx playwright install chromium

# 2. Seed the three demo companies on staging (idempotent; refuses any other project)
npm run guide:seed                 # or one language: npm run guide:seed -- --locale ka

# 3. Build and start the app on staging data, port 3123 — leave it running
npm run guide:serve

# 4. In another terminal, capture
npm run guide:screenshots                                   # every topic, EN + KA + RU at once
npm run guide:screenshots -- --topic post-a-vacancy         # one topic (comma-separate for more)
npm run guide:screenshots -- --locale ka                    # one language
npm run guide:screenshots -- --preview /tmp/guide-preview   # also write EN | KA | RU side-by-side sheets
```

What each piece does:

- **Demo companies** — `scripts/guide-demo-data.ts` holds one fictional company per language (Acme Corporation / აკმე კორპორაცია / Акме Корпорация) with native names, vacancies and candidates, so each language's screenshots show native data. `scripts/seed-guide-demo.ts` creates the organization through the real sign-up code (`runOnboarding`), so it has a customer's defaults, then mirrors the server actions for the rest. Logins: `guide.<en|ka|ru>.<owner|admin|member>@example.com` (password in `guide-demo-data.ts`; staging only).
- **`guide:serve`** — `next build` + `next start` with `.env.local` loaded first (`scripts/with-env-local.mjs`). **Don't use a plain `next start` for this:** a local production build reads `.env.production.local` before `.env.local`, and that file may point at the **production** database (it did on 2026-10-09).
- **Capture** — `scripts/capture-screenshots.ts` logs in as each language's demo owner (a magic-link session, so no password or captcha), sets the `NEXT_LOCALE` cookie, and runs the flows in `scripts/screenshot-config.ts` in all three languages at the same time. A flow clicks through the real UI and finds elements by id/role and by the app's own translated labels, so one flow works in every language. Markers are numbered red boxes explained in the guide text, so no text on the images needs translating. Tall pages are captured by growing the window (a full-page capture misplaces the fixed sidebar). Shots are saved as WebP and their sizes written to `content/guides/screenshots.json`. Flows that create data (the vacancy wizard publishes a vacancy) delete it again afterwards.
- **Service role key** — must be the **legacy JWT** `service_role` key (starts with `eyJ`), not the newer `sb_secret_*` key: the auth admin endpoints reject the new format.
- **Deployed staging instead of local** — set `SCREENSHOT_BASE_URL=https://staging.hrhandle.com` and `VERCEL_PROTECTION_BYPASS=<token>` (Vercel → Project Settings → Deployment Protection → Protection Bypass for Automation). Staging then has to be running the code you want to show.
