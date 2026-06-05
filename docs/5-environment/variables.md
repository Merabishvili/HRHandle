# Environment Variables

_Last updated: 2026-05-08_

## Changelog

- 🆕 PostHog analytics vars `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST` added (both optional, validated in `lib/env.ts`). Production only; see `docs/4-integrations/posthog.md`.
- 🆕 `GOOGLE_GEMINI_API_KEY` documented — was already used by `lib/cv-parser.ts` but missing from this file
- 🆕 `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` documented as **defined-but-unused** (no LinkedIn OAuth flow today; manual page ID only)
- 🔄 Validation section corrected — `lib/env.ts` does **not** currently validate `CRON_SECRET`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, or `GOOGLE_GEMINI_API_KEY`. These are read directly via `process.env.*` at use-sites. See open issue `C-env-validation-gaps`.

---

## Required Variables

| Name | Purpose | Service | Files That Use It | Example |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `lib/env.ts` | `https://abcdefghijkl.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous API key (public) | Supabase | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `lib/env.ts` | `eyJhbGciOiJIUzI1NiIs...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — bypasses RLS, server-only | Supabase | `lib/supabase/admin.ts`, `lib/env.ts` | `eyJhbGciOiJIUzI1NiIs...` |

## Optional Variables

| Name | Purpose | Service | Files That Use It | Example |
|---|---|---|---|---|
| `RESEND_API_KEY` | Resend API key for sending emails | Resend | `lib/email.ts`, `lib/env.ts` | `re_xxxxxxxxxxxx` |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL — used in email links and OAuth redirects | App | `lib/email.ts`, `lib/google/calendar.ts`, `lib/zoom/meetings.ts`, `lib/microsoft/graph.ts`, `app/api/auth/*/route.ts`, `lib/env.ts` | `https://staging.hrhandle.com` |
| `GOOGLE_CLIENT_ID` | Google OAuth app client ID (for Calendar integration and sign-in) | Google | `lib/google/calendar.ts`, `lib/env.ts`, Supabase auth | `123456789-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app client secret | Google | `lib/google/calendar.ts`, `lib/env.ts` | `GOCSPX-xxxxxxxx` |
| `ZOOM_CLIENT_ID` | Zoom OAuth app client ID | Zoom | `lib/zoom/meetings.ts`, `lib/env.ts` | `AbCdEfGhIj` |
| `ZOOM_CLIENT_SECRET` | Zoom OAuth app client secret | Zoom | `lib/zoom/meetings.ts`, `lib/env.ts` | `xxxxxxxxxxxxxxxxxxxx` |
| `MICROSOFT_CLIENT_ID` | Azure AD app client ID | Microsoft | `lib/microsoft/graph.ts`, `lib/env.ts` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `MICROSOFT_CLIENT_SECRET` | Azure AD app client secret | Microsoft | `lib/microsoft/graph.ts`, `lib/env.ts` | `xxxxxxxxxxxxxxxxxxxxxxxxxx` |
| 🆕 `GOOGLE_GEMINI_API_KEY` | Google Generative AI API key for CV parsing (Gemini 2.5/2.0 Flash). Read directly via `process.env`; not in `lib/env.ts`. CV parse silently returns `parse_failed` if missing. | Google AI | `lib/cv-parser.ts` | `AIzaSy...` |
| ⚠️ `LINKEDIN_CLIENT_ID` | Defined in `lib/env.ts` for a future LinkedIn OAuth flow. **Not used by any code today** (LinkedIn integration is manual page-ID entry — see `docs/4-integrations/` and `app/api/integrations/linkedin/*`). | LinkedIn (planned) | `lib/env.ts` only | `77abcxyz123` |
| ⚠️ `LINKEDIN_CLIENT_SECRET` | Companion to `LINKEDIN_CLIENT_ID` — also unused. | LinkedIn (planned) | `lib/env.ts` only | `WPL_AP1.xxxxxx` |
| `CRON_SECRET` | Bearer token for cron endpoint authentication. Read directly via `process.env`; not validated in `lib/env.ts`. If unset the cron endpoint will reject all requests. | App | `app/api/cron/expire-vacancies/route.ts` | `a-long-random-string` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key (public) | Cloudflare | `app/auth/login/page.tsx`, `components/auth/sign-up-form.tsx`, `components/apply/apply-form.tsx` | `0x4AAAAAAA...` |
| 🆕 `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile **secret** key — server-side verification for the public apply form. Validated in `lib/env.ts` as optional; when unset, `lib/turnstile.ts` fails-open with a warning so deployments can roll out the env var separately from code. **Never** prefix with `NEXT_PUBLIC_`. | Cloudflare | `lib/turnstile.ts`, `lib/env.ts` | `0x4AAAAAAA...` |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry Data Source Name — enables error monitoring if set | Sentry | `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `next.config.mjs` | `https://xxx@oyyy.ingest.sentry.io/zzz` |
| `SENTRY_ORG` | Sentry organization slug for source map upload | Sentry | `next.config.mjs` | `my-org` |
| `SENTRY_PROJECT` | Sentry project slug for source map upload | Sentry | `next.config.mjs` | `hrhandle` |
| `SENTRY_AUTH_TOKEN` | Sentry CLI auth token for source map upload (not in lib/env.ts — Vercel build env only) | Sentry | `next.config.mjs` (via Sentry CLI) | `sntrys_xxxx` |
| 🆕 `NEXT_PUBLIC_POSTHOG_KEY` | PostHog Project API key (public). Empty/unset disables PostHog. **Set in production only** — leave unset in `.env.local` to keep dev traffic out of production analytics. | PostHog | `app/providers.tsx`, `lib/env.ts` | `phc_xxxx` |
| 🆕 `NEXT_PUBLIC_POSTHOG_HOST` | PostHog ingestion host. Defaults to `https://eu.i.posthog.com` (EU cloud) when unset. | PostHog | `app/providers.tsx`, `lib/env.ts` | `https://eu.i.posthog.com` |

## Local Development Only

| Name | Purpose | Files That Use It | Example |
|---|---|---|---|
| `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` | Overrides `emailRedirectTo` in sign-up to redirect to local dev server instead of production | `components/auth/sign-up-form.tsx` | `http://localhost:3000/auth/callback` |

**Important:** This variable MUST NOT be added to Vercel. It is only for `.env.local`. The `NEXT_PUBLIC_` prefix means it is visible in browser bundle — it is safe only because local dev URLs are not sensitive.

### Guide screenshot script (local only)

These variables are read by `scripts/capture-screenshots.ts` and `scripts/seed-demo-org.ts`. They are never deployed to Vercel.

| Name | Purpose | Files That Use It | Example |
|---|---|---|---|
| `STAGING_DEMO_EMAIL` | Email of the seeded demo user the screenshot script logs in as. | `scripts/capture-screenshots.ts` | `demo.owner@hrhandle-demo.com` |
| `STAGING_DEMO_PASSWORD` | Password for the seeded demo user. | `scripts/capture-screenshots.ts` | `DemoUser!2026` |
| `SCREENSHOT_BASE_URL` | Optional override for the URL the screenshot script targets. Defaults to `https://staging.hrhandle.com`. | `scripts/capture-screenshots.ts` | `http://localhost:3000` |
| `VERCEL_PROTECTION_BYPASS` | Vercel Deployment Protection bypass token. When set, the screenshot script sends `x-vercel-protection-bypass` and `x-vercel-set-bypass-cookie` headers so Playwright can reach the app behind the protection wall. Generate one in Vercel Project Settings → Deployment Protection → Protection Bypass for Automation. | `scripts/capture-screenshots.ts` | `<32-char token>` |

## Validation

`lib/env.ts` uses `@t3-oss/env-nextjs` to validate **a subset** of environment variables at startup:

**Validated:**
- `NEXT_PUBLIC_SUPABASE_URL` — required, must be valid URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — required, non-empty string
- `SUPABASE_SERVICE_ROLE_KEY` — required, non-empty string
- `NEXT_PUBLIC_SITE_URL` — optional, must be valid URL if set; **never set to empty string** (will throw at build time)
- `RESEND_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` — optional, non-empty string if set
- `NEXT_PUBLIC_POSTHOG_KEY` — optional, non-empty string if set; `NEXT_PUBLIC_POSTHOG_HOST` — optional string if set (intentionally **not** URL-validated, so a malformed host can't break the production build)

**🔄 NOT validated** (read directly via `process.env.*` — typos and missing values fail silently or at runtime):
- `GOOGLE_GEMINI_API_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`, `STAGING_DEMO_*`, `SCREENSHOT_BASE_URL`, `VERCEL_PROTECTION_BYPASS`

## Security Notes

- `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS — treat like a root password
- `RESEND_API_KEY` can send emails from `hrhandle.com` — keep secret
- `CRON_SECRET` — used in timing-safe comparison; any long random string works
- `NEXT_PUBLIC_TURNSTILE_SECRET_KEY` — this variable name does NOT exist in the codebase. The Turnstile secret is only in the Supabase CAPTCHA dashboard. Do not create a `NEXT_PUBLIC_TURNSTILE_SECRET_KEY` variable (the `NEXT_PUBLIC_` prefix would expose it to the browser)
