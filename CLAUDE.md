# HRHandle — Claude Context

## What this app is
HRHandle is a SaaS HR platform for managing recruitment. Core features: vacancies, candidates, applications, interviews, team members, rejection templates, notifications, subscriptions/billing. Built with Next.js 15 (App Router), Supabase, Tailwind, shadcn/ui, deployed on Vercel.

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
3. CI must pass (lint removed — ESLint 9 incompatibility; build check runs with hardcoded placeholder env vars)
4. Merge PR — Vercel auto-deploys `main` to production, `staging` to staging

## Key architecture decisions

### Auth flows
- **Sign-up confirmation**: uses `token_hash` via `/auth/confirm` route — works cross-browser, no PKCE verifier needed
- **Password reset**: forgot-password page uses `createBrowserClient` with `flowType: 'implicit'` — this is intentional. Default PKCE flow generates a verifier-bound token that server-side `verifyOtp` cannot verify without the verifier stored in localStorage. Implicit flow produces a plain OTP.
- **OAuth (Google, Microsoft)**: uses PKCE via `/auth/callback` — standard, works in same browser session
- **Email template links** must use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...` (not `{{ .ConfirmationURL }}`) for signup and password reset

### Onboarding
- When a new user first hits the dashboard, `app/(dashboard)/layout.tsx` detects no `organization_id` on the profile and calls `runOnboarding(user)` from `lib/onboarding.ts` directly
- **Do NOT revert to HTTP self-fetch** — the old approach called `/api/onboarding` via `fetch()` with forwarded cookies; Supabase SSR doesn't recognise the session that way and returns 401
- The `/api/onboarding` route still exists for external use and delegates to the same `lib/onboarding.ts`

### Supabase clients — which to use
| Client | File | Use for |
|---|---|---|
| Browser | `lib/supabase/client.ts` | Client components |
| Server | `lib/supabase/server.ts` | Server components, route handlers, server actions |
| Admin | `lib/supabase/admin.ts` | Privileged operations (bypasses RLS) — server-side only |
| Middleware | `lib/supabase/middleware.ts` | Session refresh in middleware only |

### Environment variables
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — required, validated by `lib/env.ts`
- `SUPABASE_SERVICE_ROLE_KEY` — required server-side for admin client
- `NEXT_PUBLIC_SITE_URL` — optional but must be a valid URL if set; **never set to empty string** (t3-oss/env-nextjs will throw at build time)
- `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` — local `.env.local` only, overrides `emailRedirectTo` in sign-up; **must NOT be added to Vercel**

## Project structure
```
app/
  (dashboard)/          # Authenticated app — layout checks auth + onboarding
    candidates/
    vacancies/
    interviews/
    settings/           # profile, team, billing, org, custom-fields, email-templates, etc.
    subscription/
  api/
    auth/               # Supabase auth helpers
    onboarding/         # POST — delegates to lib/onboarding.ts
    health/             # GET — health check
    cron/               # Scheduled jobs
    export/             # Data export
  auth/                 # Public auth pages
    login/
    sign-up/
    forgot-password/    # Uses implicit-flow Supabase client — do not change to createClient()
    reset-password/     # Renders after token_hash verification
    confirm/            # GET — verifies token_hash, redirects to `next`
    callback/           # GET — exchanges OAuth PKCE code for session
  apply/                # Public candidate application form
  jobs/                 # Public vacancy listings
  join/                 # Team invitation acceptance
lib/
  actions/              # Server actions per feature domain
  supabase/             # client / server / admin / middleware clients
  onboarding.ts         # Shared onboarding logic (org + profile + subscription + seed data)
  env.ts                # t3-oss/env-nextjs validated env vars
  email.ts              # Resend email sending
  google/               # Google OAuth + Calendar integration
  zoom/                 # Zoom OAuth + meeting creation
  microsoft/            # Microsoft OAuth (sign-in only for now)
```

## Supabase configuration

### Email templates

**Confirm signup** — must use `token_hash`, NOT `{{ .ConfirmationURL }}`
```html
<h2>Confirm your email address</h2>
<p>Welcome! Please confirm your email address to complete your registration.</p>
<p>This step helps us secure your account and activate your access.</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup"
     style="display:inline-block;padding:10px 16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;">
    Confirm Email
  </a>
</p>
<p>If you did not create an account, you can safely ignore this email.</p>
```

**Reset password** — must use `token_hash`, forgot-password page must use `flowType: 'implicit'`
```html
<h2>Reset your password</h2>
<p>We received a request to reset your account password.</p>
<p>Click the button below to set a new password:</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password"
     style="display:inline-block;padding:10px 16px;background:#dc2626;color:#ffffff;text-decoration:none;border-radius:6px;">
    Reset Password
  </a>
</p>
<p>This link will expire shortly for security reasons.</p>
<p>If you did not request a password reset, you can safely ignore this email.</p>
```

**Member invitation**
```html
<h2>You're invited to join {{ .SiteURL }}</h2>
<p>You have been invited to create an account and join our platform.</p>
<p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;padding:10px 16px;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:6px;">
    Accept Invitation
  </a>
</p>
<p>If you were not expecting this invitation, you can ignore this email.</p>
```

**Magic link**
```html
<h2>Sign in to your account</h2>
<p>Use the link below to securely sign in to your account.</p>
<p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;padding:10px 16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;">
    Sign In
  </a>
</p>
<p>This link will expire shortly for your security.</p>
<p>If you did not request this login, you can safely ignore this email.</p>
```

**Change email address**
```html
<h2>Confirm your new email address</h2>
<p>We received a request to change your email address.</p>
<p><strong>Current email:</strong> {{ .Email }}<br><strong>New email:</strong> {{ .NewEmail }}</p>
<p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;padding:10px 16px;background:#f59e0b;color:#ffffff;text-decoration:none;border-radius:6px;">
    Confirm Email Change
  </a>
</p>
<p>If you did not request this change, please ignore this email or contact support immediately.</p>
```

**Confirm reauthentication**
```html
<h2>Security verification required</h2>
<p>To continue, please confirm your identity using the code below:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px;">{{ .Token }}</p>
<p>This code will expire shortly for your security.</p>
```

### URL configuration
- Site URL — staging: `https://staging.hrhandle.com`, production: `https://hrhandle.com`
- Redirect URLs: `https://hrhandle.com/**`, `https://staging.hrhandle.com/**`, `http://localhost:3000/**`

### Auth providers
Email, Google, Azure (Microsoft, scope: `email`) — all enabled on both projects.

### SMTP
Provider: Resend — host `smtp.resend.com`, port `465`, username `resend`, sender `HRHandle <noreply@hrhandle.com>`. Domain DKIM/SPF/DMARC verified in Resend.

## What's left to build

## Things that went wrong before — don't repeat
