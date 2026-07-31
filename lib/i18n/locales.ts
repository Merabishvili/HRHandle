/**
 * i18n locale definitions (Phase 7 — see docs/redesign/i18n-plan.md).
 *
 * `en` is the source language. `ka` (Georgian) and `ru` (Russian) are the first
 * two target locales. Personal UI language and org content language both draw
 * from this set but are resolved independently (never merged).
 */
export const LOCALES = ['en', 'ka', 'ru'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

/** Native-name labels for locale pickers (self-endonyms). */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ka: 'ქართული',
  ru: 'Русский',
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/**
 * Localised text stored per-locale on org content (vacancy bodies, screening +
 * scorecard labels). See docs/redesign/i18n-plan.md §2.5. `pickLocale` reads one
 * with a fallback chain: requested → default → first available → ''.
 */
export type LocalizedText = Partial<Record<Locale, string>>

export function pickLocale(
  text: LocalizedText | string | null | undefined,
  locale: Locale,
  fallback: Locale = DEFAULT_LOCALE,
): string {
  if (text == null) return ''
  if (typeof text === 'string') return text // pre-i18n plain string
  return text[locale] ?? text[fallback] ?? Object.values(text)[0] ?? ''
}
