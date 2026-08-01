import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n/locales'

/**
 * next-intl request config — "without i18n routing" mode (see
 * docs/redesign/i18n-plan.md §2.3). The dashboard resolves its UI locale from
 * the `NEXT_LOCALE` cookie (written from `profiles.language` when the user
 * saves their profile); public path-segment routing lands in a later slice.
 * Falls back to English for anonymous / first-visit requests.
 */
export default getRequestConfig(async () => {
  const store = await cookies()
  const cookieLocale = store.get('NEXT_LOCALE')?.value
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
