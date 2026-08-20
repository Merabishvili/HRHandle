import { isLocale } from '@/lib/i18n/locales'

/**
 * The cookie next-intl reads for the recruiter's dashboard UI language
 * (`i18n/request.ts`). Written from `profiles.language` and mirrored into
 * `user_metadata.locale` by `updateProfile`.
 */
export const LOCALE_COOKIE = 'NEXT_LOCALE'
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

/** Extract a valid app locale from a Supabase user's metadata, if present. */
export function localeFromUserMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  const raw = metadata?.locale
  return typeof raw === 'string' && isLocale(raw) ? raw : null
}

/**
 * Client-side: set the `NEXT_LOCALE` cookie so the dashboard renders in the
 * user's saved language after login — logging in from a landing page in another
 * language must not leave the app in that language (#7).
 */
export function setLocaleCookieClient(locale: string): void {
  if (!isLocale(locale)) return
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`
}
