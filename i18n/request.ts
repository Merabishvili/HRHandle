import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { resolveRequestLocale } from '@/lib/i18n/locales'

/**
 * next-intl request config — "without i18n routing" mode (see
 * docs/redesign/i18n-plan.md §2.3).
 *
 * Locale resolution priority:
 *   1. An **explicitly requested** locale (`requestLocale`) — set when a server
 *      component renders in a fixed language via `getTranslations({ locale })` /
 *      `getMessages({ locale })`. The public candidate-facing pages (status,
 *      offer) use this to render in the ORG content locale regardless of the
 *      visitor. WITHOUT honouring it, those pages silently fell back to the
 *      cookie/default and rendered English for anonymous visitors.
 *   2. The `NEXT_LOCALE` cookie — the dashboard UI language (written from
 *      `profiles.language`).
 *   3. English — anonymous / first-visit fallback.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const store = await cookies()
  const locale = resolveRequestLocale(await requestLocale, store.get('NEXT_LOCALE')?.value)

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
