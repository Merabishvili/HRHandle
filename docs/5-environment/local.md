# Local Development Setup

_Last updated: 2026-05-08_

## Changelog

- 🆕 Set `GOOGLE_GEMINI_API_KEY` if you want CV parsing to work locally — otherwise parse calls return `parse_failed` silently
- 🆕 Set `CRON_SECRET` to any random string if you want to test `/api/cron/expire-vacancies` locally
- 🆕 Turnstile test site key `1x00000000000000000000AA` (always passes) is recommended for local — saves you setting up a real key

---

## Prerequisites

- Node.js 20+ (Next.js 16 requires Node 20+)
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

## Capturing guide screenshots (one-time setup)

The guide pages under `/guide/[slug]` reference screenshots in `public/guide/screenshots/`. They are produced by a Playwright script that runs against staging:

```bash
# 1. Install browser binaries (once)
npx playwright install chromium

# 2. Seed the demo org on staging Supabase (idempotent)
NEXT_PUBLIC_SUPABASE_URL=https://quotchdymcnjlnwtjmgu.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<staging legacy JWT service_role key> \
npm run guide:seed

# 3. Add the printed credentials + the Vercel bypass token to .env.local
#    STAGING_DEMO_EMAIL=demo.owner@hrhandle-demo.com
#    STAGING_DEMO_PASSWORD=DemoUser!2026
#    VERCEL_PROTECTION_BYPASS=<token from Vercel Protection Bypass for Automation>
#    SUPABASE_SERVICE_ROLE_KEY=<staging legacy JWT service_role key>

# 4. Capture all configured shots
npm run guide:screenshots
```

What each piece does:

- **Seed script** — creates the Acme Corporation demo org with users, vacancies, pipeline applications, vacancy questions, custom fields, rejection reasons + templates, and a demo LinkedIn integration. Refuses to run unless `NEXT_PUBLIC_SUPABASE_URL` points at the staging project, so it cannot accidentally write to production.
- **Service role key** — needs to be the **legacy JWT-based** `service_role` key (starts with `eyJ`), not the newer `sb_secret_*` key. Supabase's auth admin endpoints currently reject the new key format. Find the legacy key under Settings → API → Legacy anon/service_role API keys.
- **Vercel bypass token** — staging is behind Vercel Deployment Protection. Without the bypass header, Playwright lands on Vercel's auth wall instead of the app. Generate the token under Vercel Project Settings → Deployment Protection → Protection Bypass for Automation.
- **Demo email / password** — printed at the end of `guide:seed`. The screenshot script does not use the password directly (Supabase Turnstile blocks `signInWithPassword`); instead it uses the admin client to mint a magic-link `hashed_token` and exchanges it via `verifyOtp` for a session, which is then injected as a cookie into Playwright.
