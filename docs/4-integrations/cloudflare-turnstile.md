# Cloudflare Turnstile Integration

## Overview

Cloudflare Turnstile is used as an invisible CAPTCHA to protect the login and sign-up forms from automated abuse. The widget verifies the user is human without requiring any interaction in most cases.

## Package

`@marsidev/react-turnstile` v1.5.2

## Where It Is Used

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

## Environment Variable

| Variable | Purpose | Where Configured |
|---|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key (public) | `.env.local` and Vercel |

Note: The corresponding secret key is stored only in Supabase's CAPTCHA configuration and is not an environment variable in this Next.js app. Do not add `NEXT_PUBLIC_TURNSTILE_SECRET_KEY` as a variable — it would be incorrectly exposed to the browser (the `NEXT_PUBLIC_` prefix makes it public).

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
