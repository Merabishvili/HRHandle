import { getLocale } from 'next-intl/server'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n/locales'

/**
 * The language of a public page's visitor: the `NEXT_LOCALE` cookie (set by the
 * landing/legal/guide language switcher, or the signed-in user's UI language),
 * English otherwise. Used by the legal pages and the guide.
 */
export async function visitorLocale(): Promise<Locale> {
  const raw = await getLocale()
  return isLocale(raw) ? raw : DEFAULT_LOCALE
}
