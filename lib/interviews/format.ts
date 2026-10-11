import { format } from 'date-fns'
import { dateFnsLocale, formatShortDate } from '@/lib/i18n/date-locale'

/**
 * Interview date and time in the user's interface language: "Oct 11, 2026" and
 * "3:00 PM" in English; "11 ოქტ 2026" / "11 окт. 2026" and "15:00" in Georgian
 * and Russian (day first, 24-hour clock). An explicit time pattern, because
 * date-fns' Georgian long formats use a 12-hour clock.
 */
export function formatInterviewDate(date: Date, locale: string): string {
  return formatShortDate(date, dateFnsLocale(locale))
}

export function formatInterviewTime(date: Date, locale: string): string {
  return format(date, locale === 'en' ? 'h:mm a' : 'HH:mm', { locale: dateFnsLocale(locale) })
}

/** The scheduling summary's "When": "Tue, Oct 13, 11:00 AM" / "вт, 13 окт., 11:00". */
export function formatInterviewWhen(date: Date, locale: string): string {
  return format(date, locale === 'en' ? 'EEE, MMM d, h:mm a' : 'EEE, d MMM, HH:mm', { locale: dateFnsLocale(locale) })
}
