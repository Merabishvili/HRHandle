/**
 * Domain types and helpers around Supabase Auth's MFA factor list.
 * Kept pure (no Supabase imports) so the helpers stay easy to unit-test.
 */

export interface FactorSummary {
  id: string
  type: 'totp' | string
  friendly_name: string | null
  status: 'verified' | 'unverified'
  created_at: string
}

/**
 * Filter the factors list to verified TOTP factors only. Unverified factors
 * are work-in-progress enrollments; we never expose them to gating decisions.
 */
export function verifiedFactors(factors: FactorSummary[]): FactorSummary[] {
  return factors.filter((f) => f.type === 'totp' && f.status === 'verified')
}

export function hasVerifiedFactor(factors: FactorSummary[]): boolean {
  return verifiedFactors(factors).length > 0
}

/**
 * Default friendly name for new enrollments — Supabase requires a name and we
 * don't want to force the user to type one. They can rename later in v2.
 */
export function defaultFactorName(): string {
  return `Authenticator (${new Date().toISOString().slice(0, 10)})`
}

/**
 * Normalise a 6-digit TOTP code typed by the user: strip whitespace + dashes
 * (some authenticator apps display the code as `123 456` or `123-456`).
 */
export function normalizeTotpCode(input: string): string {
  return (input ?? '').replace(/[\s-]/g, '').slice(0, 6)
}

export function isValidTotpCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}
