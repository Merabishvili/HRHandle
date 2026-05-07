# HRHandle — Claude Context

> For full documentation see `docs/`. This file contains only operational info and architecture gotchas relevant to making changes safely.

## Two environments

| | Staging | Production |
|---|---|---|
| Branch | `staging` | `main` |
| URL | `staging.hrhandle.com` | `hrhandle.com` |
| Supabase project | `hrhandle-staging` | `hrhandle-production` |
| Supabase project ID | `quotchdymcnjlnwtjmgu` | `fnpyfwhvgzoxgyjafbsg` |

**Any Supabase config change (email templates, redirect URLs, SMTP, OAuth providers) must be done on BOTH projects separately.**

## Deploy process

1. Work on `staging` branch
2. Open PR: `staging` → `main`
3. CI must pass (lint + tests + build check with hardcoded placeholder env vars)
4. Merge PR — Vercel auto-deploys `main` to production, `staging` to staging

## Key architecture decisions — critical gotchas

### Auth flows
- **Sign-up confirmation**: uses `token_hash` via `/auth/confirm` route — works cross-browser, no PKCE verifier needed
- **Password reset**: `app/auth/forgot-password/page.tsx` uses `createBrowserClient` with `flowType: 'implicit'` — **this is intentional, do not change to `createClient()`**. Default PKCE flow generates a verifier bound to localStorage; server-side `verifyOtp` cannot verify it without the verifier. Implicit flow produces a plain OTP.
- **OAuth (Google, Microsoft)**: uses PKCE via `/auth/callback` — standard, works in same browser session
- **Email template links** must use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...` (not `{{ .ConfirmationURL }}`) for signup and password reset — using `ConfirmationURL` breaks cross-browser confirmation

### Onboarding
- Dashboard layout (`app/(dashboard)/layout.tsx`) calls `runOnboarding(user)` from `lib/onboarding.ts` directly when no `organization_id` is on the profile
- **Do NOT revert to HTTP self-fetch** — the old approach called `/api/onboarding` via `fetch()` with forwarded cookies; Supabase SSR does not recognise the session that way and returns 401
- The `/api/onboarding` route still exists for external use and delegates to the same `lib/onboarding.ts`

### Supabase clients — which to use

| Client | File | Use for |
|---|---|---|
| Browser | `lib/supabase/client.ts` | Client components |
| Server | `lib/supabase/server.ts` | Server components, route handlers, server actions |
| Admin | `lib/supabase/admin.ts` | Privileged operations (bypasses RLS) — server-side only |
| Middleware | `lib/supabase/middleware.ts` | Session refresh in middleware only |

### Environment variables — critical rules
- `NEXT_PUBLIC_SITE_URL` — optional but must be a valid URL if set; **never set to empty string** — t3-oss/env-nextjs will throw at build time
- `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` — local `.env.local` only, overrides `emailRedirectTo` in sign-up; **must NOT be added to Vercel**

## What's left to build

## Things that went wrong before — don't repeat
