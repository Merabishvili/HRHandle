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
- **Password reset**: `app/auth/forgot-password/page.tsx` submits to server action `requestPasswordReset()` in `lib/actions/auth.ts`. The server action calls `createBrowserClient` with `flowType: 'implicit'` (the "browser" name is a misnomer — it's a stateless HTTP wrapper that works server-side) — **this is intentional, do not change to `createClient()`**. Default PKCE flow generates a verifier bound to localStorage; server-side `verifyOtp` cannot verify it without the verifier. Implicit flow produces a plain OTP. **It must also be passed stateless cookie methods — `cookies: { getAll: () => [], setAll: () => {} }` — or `@supabase/ssr` (≥0.10) throws `createBrowserClient in non-browser runtimes … needs getAll/setAll` when GoTrue's storage init reads cookies. Do not remove them; a reset-email request needs no session, so reading/persisting nothing is correct.** The server action also enforces 5/IP/hour + 5/email/hour rate limits and returns a generic response (reason **codes**, localized client-side) to close the email-enumeration leak. **Captcha is verified by Supabase**, not our `verifyCaptcha`: the Turnstile token is forwarded to `resetPasswordForEmail({ captchaToken })`. Do NOT also call `verifyCaptcha` here — a Turnstile token is single-use, so verifying it ourselves first consumed it and made Supabase reject the recover call → "sent" with no email. Same class of bug hit the change-password re-auth (`signInWithPassword` needs the token too) — see `components/settings/change-password-form.tsx`. Rule: **any Supabase auth call (signup, signin, recover) needs the Turnstile token forwarded now that dashboard CAPTCHA is on.**
- **OAuth (Google, Microsoft)**: uses PKCE via `/auth/callback` — standard, works in same browser session. First-time OAuth users (no `user_metadata.company_name`) are intercepted by the dashboard layout and redirected to `/onboarding/company` to set their name + org name before `runOnboarding()` runs; email sign-up carries `company_name` in metadata and skips this hop
- **Email template links** must use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...` (not `{{ .ConfirmationURL }}`) for signup and password reset — using `ConfirmationURL` breaks cross-browser confirmation

### Onboarding
- Dashboard layout (`app/(dashboard)/layout.tsx`) calls `runOnboarding(user)` from `lib/onboarding.ts` directly when no `organization_id` is on the profile — **but only after** the OAuth company-name redirect: if `user_metadata.company_name` is missing the layout sends the user to `/onboarding/company` first
- The page `/onboarding/company` collects name + company and submits to the server action `completeCompanyOnboarding` (in `lib/actions/onboarding.ts`), which calls `runOnboarding(user, { fullName, companyName })`, **stamps `company_name` + `full_name` into auth metadata**, then redirects to `/pipeline`
- **The metadata stamp is load-bearing — do not remove it.** The layout treats "no `user_metadata.company_name`" as a first-time OAuth user and redirects to `/onboarding/company`. Without stamping it after onboarding, a brief regular-client read gap on the freshly-committed `organization_id` makes the layout bounce a just-onboarded user to onboarding → which redirects back to `/pipeline` → **onboarding⇄pipeline loop / white screen.** The layout also double-checks org existence via the admin client before that redirect as a belt-and-suspenders guard.
- `runOnboarding` accepts an optional `{ fullName?, companyName? }` arg that overrides `user_metadata` lookups; falls back to "New User" / "New Organization" only when neither source has a value
- **Do NOT revert to HTTP self-fetch** — the old approach called `/api/onboarding` via `fetch()` with forwarded cookies; Supabase SSR does not recognise the session that way and returns 401
- The `/api/onboarding` route still exists for external use and delegates to the same `lib/onboarding.ts`. Optional JSON body `{ fullName?, companyName? }` overrides `user_metadata`

### Content-Security-Policy — per-request nonce

CSP is set in `middleware.ts` (via `lib/security-headers.ts:buildCsp(nonce)`), **not** in `next.config.mjs`. Each request gets a fresh nonce that is:
- Forwarded to the app via the `x-nonce` request header (server components read it via `headers().get('x-nonce')`)
- Set on the response `Content-Security-Policy` header

When adding inline `<script>` tags in server components, **always** stamp the nonce on them (e.g., `<script nonce={nonce} dangerouslySetInnerHTML={...} />`) or the browser will block them once Phase 2 drops `'unsafe-inline'`. Next.js framework scripts are auto-nonced when the request header is present.

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
- `TURNSTILE_SECRET_KEY` — server-only secret for Cloudflare Turnstile verification on the public apply form (`lib/turnstile.ts`). **Never** prefix `NEXT_PUBLIC_`. When unset, the apply form fails-open with a server warning; set on Vercel to activate enforcement. Distinct from the Supabase CAPTCHA secret used for login/sign-up (which lives in the Supabase dashboard).
- `FLITT_MERCHANT_ID` / `FLITT_SECRET_KEY` — Flitt payment gateway, server-only (**never** `NEXT_PUBLIC_`). Set on **both** Vercel environments. Use a **sandbox merchant on staging** so test clicks never charge real cards once the live merchant is active. Unset → checkout fails soft. Full detail in `docs/4-integrations/flitt.md`.

### Payments (Flitt) — critical gotchas
- **Multi-currency, one processor.** Flitt charges GEL/EUR/USD; currency is resolved per org (`billing_country` → GE=GEL, EU=EUR, else USD, with a `billing_currency` override). Georgian customers **must** see GEL by law — the public landing pricing defaults to GEL for the same reason. Don't hardcode `$`.
- **The signed server callback (`/api/payments/flitt/callback`) is the source of truth**, not the browser return URL. It verifies the signature, matches the stored `payment_orders` amount/currency (anti-tamper), and grants the plan via the admin client. Writes to `payment_orders`/`subscriptions` are service-role only.
- **Recurring uses the SDK's `Subscription()` (protocol 2.0)** so nested `recurring_data` is signed correctly. Trust the SDK source over Flitt's web-doc signature examples (those are unreliable when paraphrased).
- The migration `20260804_flitt_billing.sql` must be applied on **both** Supabase projects. Contact details (name, ID, address, email, phone) are set in `lib/legal/contact.ts`. The merchant is on Flitt's **test** environment until the remaining pre-production steps are done (test the 3 payment methods; request the live switch) and live creds are set on both Vercel envs.

### Google OAuth Configuration

Staging and production share a **single Google Cloud OAuth client**. All redirect URIs for both environments are registered on it. Key URIs:
- `https://quotchdymcnjlnwtjmgu.supabase.co/auth/v1/callback` — Supabase sign-in (staging)
- `https://fnpyfwhvgzoxgyjafbsg.supabase.co/auth/v1/callback` — Supabase sign-in (production)
- `https://staging.hrhandle.com/api/auth/google/callback` — Calendar integration (staging)
- `https://hrhandle.com/api/auth/google/callback` — Calendar integration (production)
- `http://localhost:3000/api/auth/google/callback` — Local dev

**If Google OAuth breaks with `redirect_uri_mismatch`:** Add the missing URI to the single shared OAuth client in Google Cloud Console. Changes can take 5–10 minutes to propagate. See `docs/4-integrations/google.md` for the full URI list.

## Workflow — follow this for every task

Full detail in `docs/claude-code-workflow.md`. Summary:

1. **Read docs first** — before touching code, read the relevant files under `docs/` (start with `docs/3-architecture/overview.md`, then the specific area)
2. **Output an impact list** — identify every file, doc, type, test, and env variable the change touches
3. **Write a plan, wait for approval** — present the implementation plan before writing any code; do not proceed until confirmed
4. **Execute in order**: code → docs update → tests update (all in the same session, never deferred)
5. **Run verification checklist** before declaring done:
   - All affected `docs/*.md` files updated
   - All existing tests pass; new tests added for new logic
   - Ripple-checked callers of any changed function, type, or endpoint

**Every change touches four things: code, docs, tests, and a ripple-check.**

## What's left to build

See [`docs/1-product/roadmap.md`](docs/1-product/roadmap.md) — single index of planned features, tracked open items, ATS gaps not yet filed, and accepted tech debt. Update it when scoping new work.

## Things that went wrong before — don't repeat

- **PostgREST embed ambiguity (`profiles` ⇄ `organizations`).** `organizations.ai_fit_enabled_by` references `profiles(id)`, so there are TWO FK relationships between the tables. A plain embed like `.from('profiles').select('… organizations ( … )')` fails with *"Could not embed because more than one relationship was found"* → the dashboard layout's profile read errors → "Something went wrong" for every user. **Always hint the relationship: `organizations!organization_id ( … )`.** The same applies to any new `profiles`↔`organizations` (or other double-FK pair, e.g. `ai_fit_analyses`↔`profiles` via `created_by`/`assessed_by`) embed. Applies to admin-client reads too — it's a schema-level ambiguity, not RLS.
