import { enUS, ka, ru } from 'date-fns/locale'
import { format, type Locale as DateFnsLocale } from 'date-fns'
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

/**
 * A short date as people write it in each language: "Sep 20, 2026" in English,
 * "20 сент. 2026" and "20 სექ 2026" in Russian and Georgian (day first). Use it
 * instead of a fixed 'MMM d, yyyy', which puts the month first in every language.
 */
export function formatShortDate(value: Date | string | number, locale: DateFnsLocale = enUS): string {
  const pattern = locale.code?.startsWith('en') ? 'MMM d, yyyy' : 'd MMM yyyy'
  return format(new Date(value), pattern, { locale })
}

/** Date and time: "Sep 20, 2026, 3:05 PM" in English, "20 сент. 2026, 15:05" in Russian and Georgian. */
export function formatShortDateTime(value: Date | string | number, locale: DateFnsLocale = enUS): string {
  const pattern = locale.code?.startsWith('en') ? 'MMM d, yyyy, h:mm a' : 'd MMM yyyy, HH:mm'
  return format(new Date(value), pattern, { locale })
}
