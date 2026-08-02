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

/** English names — used inside AI prompts (the model recognises these). */
export const LOCALE_ENGLISH_NAME: Record<Locale, string> = {
  en: 'English',
  ka: 'Georgian',
  ru: 'Russian',
}

/**
 * i18n Slice 5 — appended to an AI prompt so generated content is written in the
 * org's content language (§4), regardless of the recruiter's UI language. Empty
 * for English (the source). Proper nouns are kept verbatim so names/companies/
 * technologies aren't mangled.
 */
export function aiLanguageDirective(locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return ''
  const name = LOCALE_ENGLISH_NAME[locale]
  return (
    `\n\nIMPORTANT — LANGUAGE: Write all human-readable text (summaries, ` +
    `descriptions, explanations, suggestions, questions, evidence) in ${name} ` +
    `(${LOCALE_LABELS[locale]}). Keep JSON keys, field names, and any ` +
    `enumerated/category values EXACTLY as specified in English. Keep proper ` +
    `nouns — people's names, company names, product/technology names — in their ` +
    `original form.`
  )
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
