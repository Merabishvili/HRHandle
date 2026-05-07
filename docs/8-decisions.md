# Architecture Decisions

## Auth

### token_hash Flow for Email Confirmation

**Decision:** Email confirmation uses `token_hash` via `/auth/confirm` route instead of Supabase's default `{{ .ConfirmationURL }}`.

**Reason:** The default confirmation URL includes a PKCE verifier bound to the browser that initiated the sign-up. If the user opens the confirmation link in a different browser or a mobile app, the verifier is not available and verification fails. The `token_hash` approach calls `supabase.auth.verifyOtp({ token_hash, type })` server-side using the server client, which has no dependency on browser state.

**Files:** `app/auth/confirm/route.ts`, Supabase email template for Confirm signup.

---

### Implicit Flow for Password Reset

**Decision:** The forgot-password page uses `createBrowserClient` with `flowType: 'implicit'` instead of the default PKCE flow.

**Reason:** PKCE generates a code verifier that is stored in `localStorage` on the browser that initiated the reset request. If the reset email is opened in a different browser (e.g. mobile app opens in default browser vs. the browser where the request was made), the server-side `verifyOtp` cannot access the localStorage verifier and fails. The implicit flow generates a plain OTP (token_hash) that the server can verify without browser state.

**Files:** `app/auth/forgot-password/page.tsx`.

---

### OAuth Uses PKCE via `/auth/callback`

**Decision:** Google and Microsoft OAuth sign-in use PKCE via `supabase.auth.signInWithOAuth()` and `app/auth/callback/route.ts`.

**Reason:** OAuth flows stay in the same browser session from start to finish, so the PKCE verifier in localStorage is always accessible when the callback is processed.

**Files:** `app/auth/login/page.tsx`, `components/auth/sign-up-form.tsx`, `app/auth/callback/route.ts`.

---

## Onboarding

### Onboarding Runs Directly in Layout, Not via HTTP Self-fetch

**Decision:** `app/(dashboard)/layout.tsx` calls `runOnboarding(user)` directly instead of calling `POST /api/onboarding` via `fetch()`.

**Reason:** The old approach called `/api/onboarding` via `fetch()` and forwarded cookies. Supabase SSR does not recognise the session from a self-fetch — the cookie forwarding mechanism differs from a real browser request, and `getUser()` returns 401. Calling `runOnboarding()` directly (which uses the admin client) avoids this entirely.

**Files:** `app/(dashboard)/layout.tsx`, `lib/onboarding.ts`.

---

### Admin Client for Post-Onboarding Profile Refetch

**Decision:** After `runOnboarding()` completes, the dashboard layout uses `createAdminClient()` to refetch the profile rather than `createClient()`.

**Reason:** Supabase JWTs are issued at sign-in time and include the user's `organization_id` claim at that point. A newly-onboarded user's JWT does not yet include the `organization_id`, so RLS-scoped queries via the user's own token cannot read the profile row. The admin client bypasses RLS and can read the row immediately.

**Files:** `app/(dashboard)/layout.tsx`.

---

### Admin Client for Storage Signed URLs

**Decision:** `getDocumentSignedUrl()` uses `createAdminClient().storage` to generate signed URLs.

**Reason:** Supabase Storage RLS policies may not allow the user's JWT to create signed URLs for documents in their organization's folder. Using the admin client bypasses storage RLS while the ownership check is enforced in application code (verifying `organization_id` before generating the URL).

**Files:** `lib/actions/documents.ts`.

---

## Data Integrity

### Upsert Instead of Update for Profiles in `acceptInvitation`

**Decision:** `acceptInvitation()` uses `admin.from('profiles').upsert()` rather than `.update()`.

**Reason:** When a user accepts an invitation, they may have just signed up and their profile row may not exist yet in the `profiles` table (Supabase creates the `auth.users` row but the `profiles` row is created by a trigger or onboarding — if the invited user bypassed normal onboarding, the row may be absent). Using `upsert` handles both the "update existing profile" and "create new profile" cases.

**Files:** `lib/actions/invitations.ts`.

---

### Candidate Status Sync on Application Status Change

**Decision:** When an application moves to `hired`, the candidate's `general_status_id` is automatically set to `hired`. When it moves away from `hired` (and no other application is also `hired`), the candidate is reverted to `active`.

**Reason:** The candidate's general status should reflect their overall state across all applications. A candidate with any active `hired` application should show as hired; removing that application should restore them to active unless another hired application exists.

**Files:** `lib/actions/applications.ts`.

---

## Public Apply

### In-Memory Rate Limiting

**Decision:** The public apply action (`lib/actions/public-apply.ts`) limits submissions to 5 per IP per hour using the `applications` table (queries `ip_address` and `created_at`).

**Reason:** This is a database-backed rate limit — not in-memory — and survives server restarts. The API onboarding route (`app/api/onboarding/route.ts`) uses an in-memory `Map` for rate limiting which does reset on server restart.

**Note:** The `/api/onboarding` in-memory rate limiting is documented in `docs/issues-found.md` as a known issue.

---

## Session Management

### `persistSession` Kept at Default (True)

**Decision:** No custom session persistence setting is applied to the Supabase clients. The default behavior (sessions persist across page loads via cookies) is used.

**Reason:** An application-level "remember me" check is implemented in `lib/session.ts` using `localStorage`. The `SessionGuard` component reads `hrhandle_last_active` and can sign the user out if the tab has been inactive, but this is handled at the UI level rather than by Supabase memory-only sessions (which would break SSR).

**Files:** `lib/session.ts`, `components/auth/session-guard.tsx`.

---

## TODO/FIXME/HACK Comments Found in Code

- `lib/actions/notifications.ts` line 74: `// Non-fatal: notifications table may not exist yet` — suggests notifications was added after the initial schema
- `lib/actions/interviews.ts` line 287: `// Email failure is non-fatal — interview was already created`
- `lib/actions/public-apply.ts` line 165: `// Already applied to this vacancy — silently succeed (same UX for the applicant)` — duplicate applications from the public form are silently accepted
- `app/(dashboard)/layout.tsx` line 77: dynamic import of admin client inside the layout to avoid bundling issues
- `app/jobs/[slug]/page.tsx` line 14: `// 2. Fallback: UUID public_page_token (backward compat with old shared links)` — old links using UUIDs still work
