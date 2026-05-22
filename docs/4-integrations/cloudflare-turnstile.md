# Cloudflare Turnstile Integration

_Last updated: 2026-05-08_

## Changelog

- 🔄 No code changes. Reminder: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is read directly from `process.env` and **not** validated in `lib/env.ts`. Use the test key `1x00000000000000000000AA` locally.

---

## Overview

Cloudflare Turnstile is used as an invisible CAPTCHA to protect the login and sign-up forms from automated abuse. The widget verifies the user is human without requiring any interaction in most cases.

## Package

`@marsidev/react-turnstile` v1.5.2

## Where It Is Used

### Public apply form (`components/apply/apply-form.tsx`)

The widget renders inline (invisible mode). Submit is disabled until `captchaToken` is set; the token is appended to the FormData as `cf_turnstile_token`. The server action `submitPublicApplication` calls `verifyCaptcha()` from `lib/turnstile.ts`, which posts to Cloudflare's `siteverify` endpoint using `TURNSTILE_SECRET_KEY`.

Failure behaviour:
- `TURNSTILE_SECRET_KEY` unset → server logs a warning and accepts the submission (fail-open during rollout)
- Secret set + token missing or rejected by Cloudflare → submission rejected with `'Security check failed. Please refresh and try again.'`

### Login (`app/auth/login/page.tsx`)

The `LoginForm` component:
1. Renders `<Turnstile>` with `options={{ size: 'invisible' }}`
2. `onSuccess` callback sets `captchaToken` in state
3. The Sign in button is disabled until `captchaToken` is set
4. On form submit, if no `captchaToken` is available: `'Security check not complete. Please wait a moment and try again.'`
5. `captchaToken` is passed to `supabase.auth.signInWithPassword({ options: { captchaToken } })`
6. On auth error, the Turnstile widget is reset and `captchaToken` cleared

### Sign-up (`components/auth/sign-up-form.tsx`)

Same pattern as login:
1. `<Turnstile>` widget renders invisibly
2. `captchaToken` must be set before form submission
3. Passed to `supabase.auth.signUp({ options: { captchaToken } })`
4. Widget resets on error

## Configuration

The site key is read from `process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY` and passed directly to the `<Turnstile siteKey={...}>` component.

The **secret key** is configured in the Supabase dashboard under Auth → CAPTCHA. Supabase validates the token server-side — the secret key is never in the Next.js application code.

## Environment Variables

| Variable | Purpose | Where Configured |
|---|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key (public) | `.env.local` and Vercel |
| `TURNSTILE_SECRET_KEY` 🆕 | Cloudflare Turnstile secret — used server-side to verify tokens for the public apply form (login + sign-up still verify via Supabase's CAPTCHA config) | `.env.local` and Vercel — server only |

**`TURNSTILE_SECRET_KEY` must NOT be prefixed `NEXT_PUBLIC_`** — that would inline it into the browser bundle. The Supabase Auth CAPTCHA dashboard still holds a copy of the same secret for login/sign-up validation; both should be the same value (or different keys per Turnstile widget if you split sites).

## Turnstile Widget Props

```tsx
<Turnstile
  ref={turnstileRef}
  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
  onSuccess={(token) => setCaptchaToken(token)}
  onError={() => setCaptchaToken(null)}
  onExpire={() => setCaptchaToken(null)}
  options={{ size: 'invisible' }}
/>
```

The `ref` (`TurnstileInstance`) provides `.reset()` to re-challenge after a failed attempt.
