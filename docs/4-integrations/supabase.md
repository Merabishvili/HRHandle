# Supabase Integration

## Auth Flows

### Email/Password Sign-up
1. `SignUpForm` calls `supabase.auth.signUp()` with `emailRedirectTo` pointing to `{origin}/dashboard` (or the `next` param if present)
2. Supabase sends a confirmation email using the configured template
3. Email link uses `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`
4. `app/auth/confirm/route.ts` (GET) receives `token_hash` and calls `supabase.auth.verifyOtp({ token_hash, type })`
5. On success, redirects to `next` (defaults to `/dashboard`)
6. Dashboard layout detects no `organization_id` and runs `runOnboarding()`

### Email/Password Sign-in
1. Login form calls `supabase.auth.signInWithPassword({ email, password, options: { captchaToken } })`
2. Cloudflare Turnstile captcha token is required
3. On success, `router.push(safeNext)` navigates to dashboard (or original `next` URL)
4. `setSessionPreference(rememberMe)` persists the remember-me preference to localStorage

### Password Reset (Implicit Flow)
1. `app/auth/forgot-password/page.tsx` creates a client with `flowType: 'implicit'` (not PKCE)
   - Reason: PKCE generates a code verifier stored in localStorage; the server-side `verifyOtp` cannot access it
2. Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin/auth/confirm?type=recovery&next=/auth/reset-password })`
3. Email link uses `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password`
4. `app/auth/confirm/route.ts` verifies the OTP and redirects to `/auth/reset-password`
5. `app/auth/reset-password/page.tsx` calls `supabase.auth.updateUser({ password })` (validates 8+ chars)
6. On success redirects to `/auth/reset-password-success`

### Google OAuth (Sign-in)
1. Login form calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: origin/auth/callback } })`
2. Supabase handles PKCE flow internally
3. `app/auth/callback/route.ts` (GET) calls `supabase.auth.exchangeCodeForSession(code)`
4. Redirects to `safeNext` (relative paths only — open-redirect protection)

### Microsoft/Azure OAuth (Sign-in)
Same pattern as Google but `provider: 'azure'` with `scopes: 'email'`.

### Team Invitation Flow
1. Invited user clicks link `/join?token={token}` in email
2. If not logged in, redirected to `/auth/sign-up?next=/join?token={token}`
3. Sign-up form stores `invite_token` in `user_metadata` if this is an invite flow
4. Dashboard layout checks `user_metadata.invite_token` and redirects to `/join` if a pending invite exists
5. `acceptInvitation(token)` validates token, matches email, upserts profile with org and role

## Client Types

| Client | File | Created With | Session Access | Bypasses RLS |
|---|---|---|---|---|
| Browser | `lib/supabase/client.ts` | `createBrowserClient` (@supabase/ssr) | Yes — reads browser cookies | No |
| Server | `lib/supabase/server.ts` | `createServerClient` (@supabase/ssr) | Yes — reads Next.js cookies | No |
| Admin | `lib/supabase/admin.ts` | `createClient` (@supabase/supabase-js) | No session — uses service role key | Yes |
| Middleware | `lib/supabase/middleware.ts` | `createServerClient` (@supabase/ssr) | Yes — reads request cookies | No |

**When to use each:**
- Browser client: client components (`'use client'`) that need Supabase
- Server client: server components, route handlers, server actions
- Admin client: onboarding, invitations, document storage signed URLs, notification inserts, post-onboarding profile refetch — anywhere RLS must be bypassed
- Middleware client: `middleware.ts` only, for session refresh on every request

## Files Importing from `lib/supabase/`

### `lib/supabase/client.ts`
- `app/auth/login/page.tsx`
- `components/auth/sign-up-form.tsx`
- `components/auth/session-guard.tsx`
- `components/auth/sign-out-button.tsx`
- `lib/actions/index.ts` (imports server, not client — noted for clarity)

### `lib/supabase/server.ts`
- `lib/actions/index.ts`
- `lib/actions/invitations.ts`
- `app/(dashboard)/layout.tsx`
- `app/(dashboard)/vacancies/page.tsx`
- `app/(dashboard)/candidates/page.tsx`
- `app/(dashboard)/interviews/page.tsx`
- `app/(dashboard)/settings/team/page.tsx`
- `app/(dashboard)/settings/profile/page.tsx`
- `app/(dashboard)/settings/organization/page.tsx`
- `app/(dashboard)/settings/integrations/page.tsx`
- `app/(dashboard)/subscription/page.tsx`
- `app/api/auth/google/route.ts`
- `app/api/auth/google/callback/route.ts`
- `app/api/auth/google/disconnect/route.ts`
- `app/api/auth/zoom/route.ts`
- `app/api/auth/zoom/callback/route.ts`
- `app/api/auth/zoom/disconnect/route.ts`
- `app/api/auth/microsoft/route.ts`
- `app/api/auth/microsoft/callback/route.ts`
- `app/api/auth/microsoft/disconnect/route.ts`
- `app/api/export/candidates/route.ts`
- `app/api/export/applications/route.ts`
- `app/api/onboarding/route.ts`
- `app/auth/confirm/route.ts`
- `app/auth/callback/route.ts`
- `app/join/page.tsx`

### `lib/supabase/admin.ts`
- `lib/onboarding.ts`
- `lib/actions/invitations.ts`
- `lib/actions/documents.ts`
- `lib/actions/notifications.ts`
- `lib/actions/public-apply.ts`
- `lib/google/calendar.ts`
- `lib/zoom/meetings.ts`
- `lib/microsoft/graph.ts`
- `lib/cache/lookups.ts`
- `app/(dashboard)/layout.tsx` (dynamic import for invite check + post-onboarding refetch)
- `app/api/auth/google/callback/route.ts`
- `app/api/auth/zoom/callback/route.ts`
- `app/api/auth/microsoft/callback/route.ts`
- `app/api/health/route.ts`
- `app/api/cron/expire-vacancies/route.ts`
- `app/apply/[token]/page.tsx`
- `app/jobs/[slug]/page.tsx`
- `app/auth/sign-up/page.tsx` (dynamic import for invite lookup)

### `lib/supabase/middleware.ts`
- `middleware.ts`

## Storage

Bucket name: `candidate-documents`

Storage path pattern: `{organization_id}/{candidate_id}/{uuid}.{ext}`

Allowed types: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

Max file size: 10 MB

Magic byte validation is performed server-side to prevent extension spoofing.

Signed URLs are generated via the admin client (`createAdminClient().storage.from(BUCKET).createSignedUrl(...)`) with a 3600-second TTL. The raw storage path is never sent to the client.

## RLS Approach

All queries in server actions and route handlers include explicit `organization_id` filters (`.eq('organization_id', ctx.orgId)`). The Supabase RLS policies enforce this at the database level for the anon/service key. The admin client bypasses RLS — it is used only in trusted server contexts where the org check is performed in application code.

## Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public, required) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous API key (public, required) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for admin operations (server-only, required) |

Validated by `lib/env.ts` using `@t3-oss/env-nextjs`. `NEXT_PUBLIC_SUPABASE_URL` must be a valid URL; the other two must be non-empty strings.

## Supabase Configuration Notes

- Email auth provider: enabled
- Google OAuth provider: enabled (uses Supabase's built-in OAuth, not the custom Google Calendar OAuth)
- Azure (Microsoft) OAuth provider: enabled with scope `email`
- SMTP: Resend — `smtp.resend.com:465`, username `resend`, sender `HRHandle <noreply@hrhandle.com>`
- Email templates in Supabase dashboard use `token_hash` links (not `{{ .ConfirmationURL }}`) for signup and password reset

### URL Configuration

**Site URL** (Authentication → URL Configuration → Site URL field):
| Project | Site URL |
|---|---|
| Staging (`quotchdymcnjlnwtjmgu`) | `https://staging.hrhandle.com` |
| Production (`fnpyfwhvgzoxgyjafbsg`) | `https://hrhandle.com` |

The Site URL is the fallback redirect destination when `redirectTo` is not specified or doesn't match the allow list. Getting this wrong causes `/?code=...` to appear in the URL after OAuth.

**Production redirect URLs** (Authentication → URL Configuration on `fnpyfwhvgzoxgyjafbsg`):
```
https://hrhandle.com/**
https://hrhandle.com/auth/callback
https://hrhandle.com/auth/login
https://hrhandle.com/auth/reset-password
https://hrhandle.com/auth/sign-up-success
http://hrhandle.com/auth/sign-up-success
http://hrhandle.com/auth/login
http://hrhandle.com/auth/reset-password
http://hrhandle.com/auth/callback
http://hrhandle.com/callback
http://hrhandle.com
http://hrhandle.com/**
https://fnpyfwhvgzoxgyjafbsg.supabase.co/auth/v1/callback
```

**Staging redirect URLs** (Authentication → URL Configuration on `quotchdymcnjlnwtjmgu`):
```
https://v0.app/chat/api/supabase/redirect/iMVdPQPuOsb
http://localhost:3000/auth/callback
http://localhost:3000/auth/reset-password
http://localhost:3000/auth/login
http://staging.hrhandle.com/callback
http://staging.hrhandle.com/auth/callback
http://staging.hrhandle.com/auth/reset-password
http://staging.hrhandle.com/auth/login
https://staging.hrhandle.com/auth/sign-up-success
https://staging.hrhandle.com/auth/callback
https://staging.hrhandle.com/auth/login
https://staging.hrhandle.com/auth/reset-password
http://staging.hrhandle.com/auth/sign-up-success
https://staging.hrhandle.com/**
http://staging.hrhandle.com/**
```
