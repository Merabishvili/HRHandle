/**
 * Sign-up country gate (G-008). HRHandle blocks new account creation from a
 * small union of jurisdictions that are subject to FATF "call for action"
 * (the FATF black list) plus OFAC / EU / UN comprehensive country sanctions.
 *
 * What this is and what it isn't:
 *
 * - This blocks **new account creation** (email sign-up + OAuth onboarding).
 *   Existing customers can sign in from anywhere — sanctions law does not
 *   require breaking pre-existing customer relationships, and locking out a
 *   travelling user would be bad product behaviour.
 *
 * - This does **not** gate the public apply form (`/apply/[token]`). A
 *   candidate is a data subject of the customer-controller, not a counter-
 *   party of HRHandle. Gating candidates by country would create a hiring-
 *   discrimination problem, not solve a sanctions one.
 *
 * - This does **not** screen individuals or company entities (denied-party /
 *   SDN screening). Those require name-level matching against fast-moving
 *   lists and are out of scope for a country-IP gate.
 *
 * - VPNs bypass IP-based gating. Everyone knows this. The point is a
 *   documented, good-faith control, not an unbypassable wall.
 *
 * The list ships hardcoded and is reviewed quarterly (see
 * `docs/9-compliance/sanctions-screening.md`).
 */

/** ISO 3166-1 alpha-2 codes blocked at sign-up. */
export const BLOCKED_COUNTRY_CODES = [
  'KP', // North Korea — FATF black, OFAC comprehensive
  'IR', // Iran — FATF black, OFAC comprehensive
  'MM', // Myanmar — FATF black
  'SY', // Syria — OFAC comprehensive
  'CU', // Cuba — OFAC comprehensive
  'BY', // Belarus — EU/UK/US comprehensive
  'RU', // Russia — EU/UK/US/Japan/Switzerland comprehensive (post-2022)
  'VE', // Venezuela — OFAC (partial regime, blocked here per B2B SaaS norm)
] as const

export type BlockedCountryCode = (typeof BLOCKED_COUNTRY_CODES)[number]

/**
 * Read the visitor's country code from request headers. Vercel populates
 * `x-vercel-ip-country` with the ISO 3166-1 alpha-2 code on every request.
 *
 * Returns `null` when the header is absent — that happens in local
 * development (no Vercel edge in front), in test environments, and on
 * requests from networks where Vercel cannot determine the country. Callers
 * should treat `null` as "country unknown, do not block" so dev keeps working.
 */
export function getRequestCountry(headers: {
  get(name: string): string | null
}): string | null {
  const code = headers.get('x-vercel-ip-country')
  if (!code) return null
  return code.trim().toUpperCase()
}

/**
 * True if the ISO country code is on HRHandle's sign-up blocklist.
 * Case-insensitive. Returns `false` for unknown / null / empty input.
 */
export function isBlockedCountry(code: string | null | undefined): boolean {
  if (!code) return false
  const normalized = code.trim().toUpperCase()
  return (BLOCKED_COUNTRY_CODES as readonly string[]).includes(normalized)
}

/**
 * Convenience: returns the blocked country code (already upper-cased) if the
 * request originated from one, else `null`. Used at sign-up to decide whether
 * to render the form or redirect to `/not-available`.
 */
export function getBlockedCountry(headers: {
  get(name: string): string | null
}): string | null {
  const code = getRequestCountry(headers)
  return isBlockedCountry(code) ? code : null
}
