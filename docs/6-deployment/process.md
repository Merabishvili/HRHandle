# Deployment Process

_Last updated: 2026-07-20_

## Changelog

- 🔄 (2026-07-20 audit) Verified current: the staging→main flow, two-env table, and Supabase-config-sync rules still match. The Vercel env-var set has grown considerably since — the canonical list is now `docs/5-environment/variables.md` (Calendly, Sentry org/project, Turnstile secret, etc.).
- 🔄 No structural changes to the staging→main deploy flow
- 🆕 New env vars to set on Vercel before deploy if you want the relevant features: `GOOGLE_GEMINI_API_KEY` (CV parsing + AI features), `CRON_SECRET` (cron auth), `CALENDLY_CLIENT_ID`/`SECRET` (Calendly), `TURNSTILE_SECRET_KEY` (apply-form CAPTCHA)

---

## Two Environments

| | Staging | Production |
|---|---|---|
| Branch | `staging` | `main` |
| URL | `staging.hrhandle.com` | `hrhandle.com` |
| Supabase project | `hrhandle-staging` | `hrhandle-production` |
| Supabase project ID | `quotchdymcnjlnwtjmgu` | `fnpyfwhvgzoxgyjafbsg` |
| Vercel deployment | Auto on push to `staging` | Auto on merge to `main` |

## Deploy Flow

1. Work on the `staging` branch (or a feature branch off `staging`)
2. Open a PR from `staging` → `main`
3. CI must pass (see `docs/6-deployment/ci-cd.md`)
4. Merge the PR — Vercel auto-deploys `main` to production
5. Vercel also auto-deploys pushes to `staging` to the staging environment

## Supabase Config Sync

Any configuration change in Supabase must be applied to **both** projects separately:

- Email templates (Supabase Dashboard → Auth → Email Templates)
- Redirect URLs (Supabase Dashboard → Auth → URL Configuration)
- OAuth providers (Supabase Dashboard → Auth → Providers)
- SMTP configuration (Supabase Dashboard → Auth → SMTP Settings)
- Database migrations

The staging project (`quotchdymcnjlnwtjmgu`) and production project (`fnpyfwhvgzoxgyjafbsg`) are entirely separate Supabase instances.

## Environment Variables on Vercel

Each Vercel environment (staging, production) has its own set of env vars. Key differences:

- `NEXT_PUBLIC_SITE_URL` — `https://staging.hrhandle.com` for staging, `https://hrhandle.com` for production
- `NEXT_PUBLIC_SUPABASE_URL` and keys — different for each Supabase project
- `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` — must NOT be set on Vercel (local dev only)

## Vercel Project Configuration

- Build command: `next build`
- Output: Next.js (detected automatically)
- Node.js version: 20.x (required for Next.js 16)
- The `withSentryConfig` wrapper in `next.config.mjs` runs during build — `SENTRY_AUTH_TOKEN` is needed in the Vercel build environment for source map upload if Sentry is configured
