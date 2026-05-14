# Environment Variables

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
| `CRON_SECRET` | Bearer token for cron endpoint authentication | App | `app/api/cron/expire-vacancies/route.ts` | `a-long-random-string` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key (public) | Cloudflare | `app/auth/login/page.tsx`, `components/auth/sign-up-form.tsx` | `0x4AAAAAAA...` |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry Data Source Name — enables error monitoring if set | Sentry | `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `next.config.mjs` | `https://xxx@oyyy.ingest.sentry.io/zzz` |
| `SENTRY_ORG` | Sentry organization slug for source map upload | Sentry | `next.config.mjs` | `my-org` |
| `SENTRY_PROJECT` | Sentry project slug for source map upload | Sentry | `next.config.mjs` | `hrhandle` |
| `SENTRY_AUTH_TOKEN` | Sentry CLI auth token for source map upload (not in lib/env.ts — Vercel build env only) | Sentry | `next.config.mjs` (via Sentry CLI) | `sntrys_xxxx` |

## Local Development Only

| Name | Purpose | Files That Use It | Example |
|---|---|---|---|
| `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` | Overrides `emailRedirectTo` in sign-up to redirect to local dev server instead of production | `components/auth/sign-up-form.tsx` | `http://localhost:3000/auth/callback` |

**Important:** This variable MUST NOT be added to Vercel. It is only for `.env.local`. The `NEXT_PUBLIC_` prefix means it is visible in browser bundle — it is safe only because local dev URLs are not sensitive.

## Validation

`lib/env.ts` uses `@t3-oss/env-nextjs` to validate environment variables at startup:

- `NEXT_PUBLIC_SUPABASE_URL` — required, must be valid URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — required, non-empty string
- `SUPABASE_SERVICE_ROLE_KEY` — required, non-empty string
- `NEXT_PUBLIC_SITE_URL` — optional, must be valid URL if set; **never set to empty string** (will throw at build time)
- All others — optional, must be non-empty string if set

## Security Notes

- `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS — treat like a root password
- `RESEND_API_KEY` can send emails from `hrhandle.com` — keep secret
- `CRON_SECRET` — used in timing-safe comparison; any long random string works
- `NEXT_PUBLIC_TURNSTILE_SECRET_KEY` — this variable name does NOT exist in the codebase. The Turnstile secret is only in the Supabase CAPTCHA dashboard. Do not create a `NEXT_PUBLIC_TURNSTILE_SECRET_KEY` variable (the `NEXT_PUBLIC_` prefix would expose it to the browser)
