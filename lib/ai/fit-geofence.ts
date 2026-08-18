/**
 * EU/EEA geofencing for AI Fit Analysis (spec Guardrail 6). An org whose
 * `billing_country` is in the EU/EEA must have `ai_fit_eu_acknowledged = true`
 * before the feature can be enabled — the belt-and-suspenders control that
 * limits EU AI Act exposure. Pure + testable.
 */

// EU-27 + EEA (Iceland, Liechtenstein, Norway). ISO 3166-1 alpha-2.
const EU_EEA = new Set<string>([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
  'SI', 'ES', 'SE', 'IS', 'LI', 'NO',
])

/** True if the country code is in the EU/EEA. Accepts ISO alpha-2 (any case);
 * unknown / null / non-2-letter values are treated as non-EU (the safe default
 * for a null country is "unknown", NOT "EU" — the acknowledgement gate is only
 * *required* when we positively know the org is in the EU). */
export function isEuCountry(country: string | null | undefined): boolean {
  if (!country) return false
  const code = country.trim().toUpperCase()
  return EU_EEA.has(code)
}

/**
 * Whether the org may enable AI Fit Analysis given its geofencing state.
 * - non-EU billing country → allowed (standard opt-in).
 * - EU billing country → allowed only if `euAcknowledged`.
 */
export function canEnableAiFit(
  billingCountry: string | null | undefined,
  euAcknowledged: boolean,
): boolean {
  if (isEuCountry(billingCountry)) return euAcknowledged
  return true
}
