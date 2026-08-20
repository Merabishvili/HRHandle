/**
 * Billing currency resolution + formatting.
 *
 * Multi-currency, single processor (Flitt handles GEL/EUR/USD). Georgian
 * customers must be shown GEL by law; the EU is billed in EUR; everyone else in
 * USD. The org's currency derives from `organizations.billing_country`, with a
 * manual `billing_currency` override an owner can set on the billing page.
 */
import { isEuCountry } from '@/lib/ai/fit-geofence'

export type Currency = 'GEL' | 'EUR' | 'USD'

export const CURRENCIES: readonly Currency[] = ['GEL', 'EUR', 'USD'] as const

export const CURRENCY_SYMBOL: Record<Currency, string> = { GEL: '₾', EUR: '€', USD: '$' }

/** Human label for a currency selector. */
// Compact symbol + ISO code — universal, needs no translation, and keeps the
// currency picker small (per staging design feedback).
export const CURRENCY_LABEL: Record<Currency, string> = {
  GEL: '₾ GEL',
  EUR: '€ EUR',
  USD: '$ USD',
}

export function isCurrency(v: unknown): v is Currency {
  return v === 'GEL' || v === 'EUR' || v === 'USD'
}

/**
 * Georgia → GEL (legal display requirement), EU/EEA → EUR, everything else →
 * USD. An explicit `override` (the org's saved `billing_currency`) always wins.
 */
export function resolveBillingCurrency(
  billingCountry: string | null | undefined,
  override?: string | null,
): Currency {
  if (isCurrency(override)) return override
  const code = (billingCountry ?? '').trim().toUpperCase()
  if (code === 'GE') return 'GEL'
  if (isEuCountry(code)) return 'EUR'
  return 'USD'
}

/**
 * Default currency for an org's salary/vacancy fields. Prefers the billing
 * config (explicit override → billing country), but when billing isn't
 * configured yet (a fresh org that never set a country), falls back to the org's
 * **content language** so a Georgian-language org defaults to GEL instead of USD
 * (#10). Only `ka` implies GEL — `ru`/`en` keep USD, since Russian isn't a
 * supported billing currency and English is the neutral default.
 */
export function resolveOrgDefaultCurrency(opts: {
  billingCountry?: string | null
  billingCurrency?: string | null
  contentLocale?: string | null
}): Currency {
  if (isCurrency(opts.billingCurrency)) return opts.billingCurrency
  if (opts.billingCountry && opts.billingCountry.trim()) {
    return resolveBillingCurrency(opts.billingCountry, null)
  }
  return opts.contentLocale === 'ka' ? 'GEL' : 'USD'
}

/**
 * Flitt charges in the minor unit (tetri / cents). GEL, EUR and USD are all
 * 2-decimal, so ×100. e.g. ₾49.00 → 4900.
 */
export function toMinorUnits(major: number): number {
  return Math.round(major * 100)
}

/** Display a whole-number price with its symbol, e.g. (49, 'GEL') → "₾49". */
export function formatPrice(amount: number, currency: Currency): string {
  return `${CURRENCY_SYMBOL[currency]}${amount}`
}
