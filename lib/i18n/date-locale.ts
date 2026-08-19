import { enUS, ka, ru } from 'date-fns/locale'
import type { Locale as DateFnsLocale } from 'date-fns'
import type { Locale } from '@/lib/i18n/locales'

/**
 * Map an app locale to its date-fns locale so `format()` renders month/day names
 * in the right language on the candidate-facing pages (status / apply / offer),
 * which render in the ORG content locale. Defaults to English.
 */
const DATE_FNS_LOCALES: Record<Locale, DateFnsLocale> = { en: enUS, ka, ru }

export function dateFnsLocale(locale: string): DateFnsLocale {
  return DATE_FNS_LOCALES[locale as Locale] ?? enUS
}
