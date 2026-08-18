export type OrgRole = 'owner' | 'admin' | 'member'

export interface OrgMfaPolicy {
  require_mfa: boolean
  require_mfa_for_admins: boolean
}

export interface PolicyEvaluation {
  /** User must enroll a TOTP factor before continuing into the dashboard. */
  enrollmentRequired: boolean
  /** Human-readable reason — surfaced in the enrollment banner on /settings/profile/security. */
  reason: 'org_wide' | 'admin_only' | null
}

/**
 * Decide whether the user must enroll a TOTP factor before they can use the
 * dashboard, given the org's policy and the user's current state.
 *
 * - `require_mfa = true` forces every member to enroll
 * - `require_mfa_for_admins = true` forces owners + admins to enroll
 *   (members are unaffected)
 * - The two flags are independent; org_wide wins the reason string when both
 *   apply, because it's the broader policy
 */
export function evaluatePolicy(
  policy: OrgMfaPolicy,
  role: OrgRole,
  hasFactor: boolean
): PolicyEvaluation {
  if (hasFactor) return { enrollmentRequired: false, reason: null }

  if (policy.require_mfa) {
    return { enrollmentRequired: true, reason: 'org_wide' }
  }
  if (policy.require_mfa_for_admins && (role === 'owner' || role === 'admin')) {
    return { enrollmentRequired: true, reason: 'admin_only' }
  }
  return { enrollmentRequired: false, reason: null }
}

/**
 * Decide whether to redirect a logged-in user to the MFA challenge page.
 *
 * A logged-in user with an enrolled factor whose session AAL is still 'aal1'
 * has password-only authentication. We force them through the challenge so
 * the session reaches 'aal2' before they see any sensitive UI.
 */
export function needsChallenge(
  hasFactor: boolean,
  currentAal: string | null | undefined
): boolean {
  if (!hasFactor) return false
  return currentAal !== 'aal2'
}
