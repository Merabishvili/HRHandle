# Environment Variables

_Last updated: 2026-07-20_

## Changelog

- 🔄 **Validation section corrected against `lib/env.ts` (2026-07-20 audit).** Many vars the previous version listed as "not validated" **are now validated** in `lib/env.ts`: `GOOGLE_GEMINI_API_KEY`, `CRON_SECRET`, `SENTRY_ORG`, `SENTRY_PROJECT`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`. Only build-time / local-only / script vars remain outside the schema.
- 🆕 `CALENDLY_CLIENT_ID` / `CALENDLY_CLIENT_SECRET` (G-031) — Calendly OAuth. Validated in `lib/env.ts` (optional). Used by `lib/calendly/oauth.ts`.
- ❌ `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` **removed** — no longer in `lib/env.ts` and referenced nowhere in the codebase. LinkedIn integration is manual page-ID entry only (`app/api/integrations/linkedin/*`); there is no LinkedIn OAuth flow.
- 🔄 `GOOGLE_GEMINI_API_KEY` is now in `lib/env.ts` (optional) and used by `lib/cv-parser.ts` **and** the AI modules (`lib/ai/*` — bias-check, jd-generator, assessment-suggester, fit-analysis; note-extractor retired 2026-08-28).
- 🔄 `CRON_SECRET` is now validated in `lib/env.ts` and used by **both** cron routes (`expire-vacancies`, `purge-deleted`).

---

## Required Variables

| Name | Purpose | Service | Files That Use It | Example |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `lib/env.ts` | `https://abcdefghijkl.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous API key (public) | Supabase | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `lib/env.ts` | `eyJhbGciOiJIUzI1NiIs...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — bypasses RLS, server-only | Supabase | `lib/supabase/admin.ts`, `lib/env.ts` | `eyJhbGciOiJIUzI1NiIs...` |

## Optional Variables (validated in `lib/env.ts`)

| Name | Purpose | Service | Files That Use It | Example |
|---|---|---|---|---|
| `RESEND_API_KEY` | Resend API key for sending emails | Resend | `lib/email.ts`, `lib/env.ts` | `re_xxxxxxxxxxxx` |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL — used in email links and OAuth redirects | App | `lib/email.ts`, `lib/google/calendar.ts`, `lib/zoom/meetings.ts`, `lib/microsoft/graph.ts`, `app/api/auth/*/route.ts`, `lib/env.ts` | `https://staging.hrhandle.com` |
| `GOOGLE_CLIENT_ID` | Google OAuth app client ID (Calendar integration + sign-in) | Google | `lib/google/calendar.ts`, `lib/env.ts`, Supabase auth | `123456789-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app client secret | Google | `lib/google/calendar.ts`, `lib/env.ts` | `GOCSPX-xxxxxxxx` |
| `ZOOM_CLIENT_ID` | Zoom OAuth app client ID | Zoom | `lib/zoom/meetings.ts`, `lib/env.ts` | `AbCdEfGhIj` |
| `ZOOM_CLIENT_SECRET` | Zoom OAuth app client secret | Zoom | `lib/zoom/meetings.ts`, `lib/env.ts` | `xxxxxxxxxxxxxxxxxxxx` |
| `MICROSOFT_CLIENT_ID` | Azure AD app client ID | Microsoft | `lib/microsoft/graph.ts`, `lib/env.ts` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `MICROSOFT_CLIENT_SECRET` | Azure AD app client secret | Microsoft | `lib/microsoft/graph.ts`, `lib/env.ts` | `xxxxxxxxxxxxxxxxxxxxxxxxxx` |
| 🆕 `CALENDLY_CLIENT_ID` | Calendly OAuth app client ID (G-031) | Calendly | `lib/calendly/oauth.ts`, `lib/env.ts` | `xxxxxxxxxxxx` |
| 🆕 `CALENDLY_CLIENT_SECRET` | Calendly OAuth app client secret | Calendly | `lib/calendly/oauth.ts`, `lib/env.ts` | `xxxxxxxxxxxxxxxxxxxx` |
| `GOOGLE_GEMINI_API_KEY` | Google Generative AI key (Gemini) — CV parsing + all six AI features. When unset, CV parse returns `parse_failed` and AI features return `no_key`. | Google AI | `lib/cv-parser.ts`, `lib/ai/*`, `lib/env.ts` | `AIzaSy...` |
| `CRON_SECRET` | Bearer token for cron endpoint auth (timing-safe compare). If unset the cron routes reject all requests. | App | `app/api/cron/expire-vacancies/route.ts`, `app/api/cron/purge-deleted/route.ts`, `lib/env.ts` | `a-long-random-string` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key (public) | Cloudflare | `app/auth/login/page.tsx`, `components/auth/sign-up-form.tsx`, `components/apply/apply-form.tsx`, `lib/env.ts` | `0x4AAAAAAA...` |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile **secret** key — server-side verification for the public apply form. When unset, `lib/turnstile.ts` fails-open with a warning. **Never** prefix with `NEXT_PUBLIC_`. | Cloudflare | `lib/turnstile.ts`, `lib/env.ts` | `0x4AAAAAAA...` |
| 🆕 `FLITT_MERCHANT_ID` | Flitt merchant id (numeric). From portal.flitt.com. Server-only. | Flitt | `lib/flitt/client.ts`, `lib/env.ts` | `1549901` |
| 🆕 `FLITT_SECRET_KEY` | Flitt payment/secret key — signs checkouts + verifies callbacks. When unset the checkout fails soft (`isFlittConfigured()` false). **Never** prefix with `NEXT_PUBLIC_`. Set on **both** environments; use a sandbox merchant on staging. | Flitt | `lib/flitt/client.ts`, `lib/env.ts` | `xxxxxxxxxxxxxxxx` |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN — enables error monitoring if set | Sentry | `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `lib/env.ts` | `https://xxx@oyyy.ingest.sentry.io/zzz` |
| `SENTRY_ORG` | Sentry organization slug for source-map upload | Sentry | `next.config.mjs`, `lib/env.ts` | `my-org` |
| `SENTRY_PROJECT` | Sentry project slug for source-map upload | Sentry | `next.config.mjs`, `lib/env.ts` | `hrhandle` |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog Project API key (public). Empty/unset disables PostHog. **Set in production only.** | PostHog | `app/providers.tsx`, `lib/env.ts` | `phc_xxxx` |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog ingestion host. Defaults to `https://eu.i.posthog.com` when unset. Intentionally **not** URL-validated (a bad value must never hard-fail the prod build). | PostHog | `app/providers.tsx`, `lib/env.ts` | `https://eu.i.posthog.com` |

## Outside `lib/env.ts` (read directly via `process.env` — not schema-validated)

| Name | Purpose | Scope | Files That Use It | Example |
|---|---|---|---|---|
| `SENTRY_AUTH_TOKEN` | Sentry CLI auth token for source-map upload at build time | Vercel build env only | `next.config.mjs` (via Sentry CLI) | `sntrys_xxxx` |
| `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` | Overrides `emailRedirectTo` in sign-up to the local dev server. **MUST NOT be added to Vercel.** | Local `.env.local` only | `components/auth/sign-up-form.tsx` | `http://localhost:3000/auth/callback` |
| `STAGING_DEMO_EMAIL` / `STAGING_DEMO_PASSWORD` | Seeded demo user the screenshot script logs in as | Local scripts only | `scripts/capture-screenshots.ts` | `demo.owner@hrhandle-demo.com` |
| `SCREENSHOT_BASE_URL` | Override for the URL the screenshot script targets (defaults to staging) | Local scripts only | `scripts/capture-screenshots.ts` | `http://localhost:3000` |
| `VERCEL_PROTECTION_BYPASS` | Vercel Deployment Protection bypass token so Playwright can reach protected deployments | Local scripts only | `scripts/capture-screenshots.ts` | `<32-char token>` |

## Validation

`lib/env.ts` uses `@t3-oss/env-nextjs`. `emptyStringAsUndefined: true` so Vercel's empty-string-for-unset behaviour is treated as "absent" (avoids `.min(1)` false-failures at build).

- **Required:** `NEXT_PUBLIC_SUPABASE_URL` (valid URL), `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Optional (validated if set):** `RESEND_API_KEY`, `GOOGLE_CLIENT_ID/SECRET`, `ZOOM_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET`, `TURNSTILE_SECRET_KEY`, `FLITT_MERCHANT_ID`, `FLITT_SECRET_KEY`, `GOOGLE_GEMINI_API_KEY`, `CRON_SECRET`, `SENTRY_ORG`, `SENTRY_PROJECT`, `CALENDLY_CLIENT_ID/SECRET`, `NEXT_PUBLIC_SITE_URL` (valid URL if set — **never empty string**), `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_SENTRY_DSN` (valid URL if set), `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (not URL-validated by design).
- **Not validated** (read via `process.env.*`): `SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`, `STAGING_DEMO_*`, `SCREENSHOT_BASE_URL`, `VERCEL_PROTECTION_BYPASS`.

## Security Notes

- `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS — treat like a root password.
- `RESEND_API_KEY` can send emails from `hrhandle.com` — keep secret.
- `CRON_SECRET` — used in a timing-safe comparison; any long random string works.
- There is **no** `NEXT_PUBLIC_TURNSTILE_SECRET_KEY` — the Turnstile secret used for login/sign-up lives in the Supabase CAPTCHA dashboard; the apply-form secret is `TURNSTILE_SECRET_KEY` (no `NEXT_PUBLIC_` prefix). Never expose a secret with `NEXT_PUBLIC_`.
