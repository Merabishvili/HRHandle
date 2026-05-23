// Shared business-rule constants. Keep this file small and dependency-free
// so it can be imported by both server actions and client components without
// pulling in heavier modules.

/**
 * Maximum number of "active" (pre-hired, not rejected/withdrawn) applications a
 * candidate may have at the same time. Used by:
 *   - `lib/actions/applications.ts` (createApplication — enforced server-side)
 *   - `components/candidates/add-application-dialog.tsx` (UI disable + warning)
 *
 * Audit ref: C-009 (was hardcoded `5` in two places).
 */
export const MAX_ACTIVE_APPLICATIONS_PER_CANDIDATE = 5

/**
 * Path that Supabase appends to `emailRedirectTo` when sending the sign-up
 * confirmation email. Defined in one place so the sign-up form and the
 * `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` rewrite stay in sync.
 *
 * Audit ref: C-014 (was an inline string in `components/auth/sign-up-form.tsx`).
 */
export const AUTH_CALLBACK_PATH = '/auth/callback'
