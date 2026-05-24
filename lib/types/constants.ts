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

/**
 * Application-pipeline status codes — the `code` column on `application_statuses`.
 * Source of truth for the literal union in `lib/types/application.ts`.
 *
 * Audit ref: A-006 (was a sprinkle of magic strings across server actions).
 */
export const APPLICATION_STATUS = {
  APPLIED: 'applied',
  SCREENING: 'screening',
  INTERVIEW: 'interview',
  OFFER: 'offer',
  HIRED: 'hired',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
} as const

export type ApplicationStatusCode =
  (typeof APPLICATION_STATUS)[keyof typeof APPLICATION_STATUS]

/**
 * Status codes considered "active" — a candidate is counted against the
 * `MAX_ACTIVE_APPLICATIONS_PER_CANDIDATE` cap while any of their applications
 * are in one of these states.
 */
export const ACTIVE_APPLICATION_STATUS_CODES: readonly ApplicationStatusCode[] = [
  APPLICATION_STATUS.APPLIED,
  APPLICATION_STATUS.SCREENING,
  APPLICATION_STATUS.INTERVIEW,
  APPLICATION_STATUS.OFFER,
] as const

/**
 * Candidate general-status codes — the `code` column on `candidate_statuses`.
 * Source of truth for the literal union in `lib/types/candidate.ts`.
 */
export const CANDIDATE_STATUS = {
  ACTIVE: 'active',
  HIRED: 'hired',
  ARCHIVED: 'archived',
} as const

export type CandidateStatusCode =
  (typeof CANDIDATE_STATUS)[keyof typeof CANDIDATE_STATUS]
