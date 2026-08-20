import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_LOCALE, isLocale, type Locale } from './locales'

/**
 * Org content-language helpers. An org publishes candidate-facing content
 * (public jobs/apply/status/offer pages, emails, AI output) in a SINGLE
 * language, chosen by the owner and stored in `default_content_locale`. This is
 * resolved independently of each recruiter's personal UI locale.
 *
 * The multi-language model (an `enabled_content_locales` set + `/[locale]/jobs`
 * SEO path routing) was removed — see docs/redesign/i18n-plan.md §10. The
 * `enabled_content_locales` column is retained for backwards compatibility and
 * written as `[default_content_locale]`, but reads derive everything from the
 * single default, so a stale multi-value array can never resurface two languages.
 */
export interface OrgContentLocaleSettings {
  default_content_locale?: string | null
  enabled_content_locales?: string[] | null
}

/** The org's single content locale — falls back to `en` if unset/invalid. */
export function orgDefaultLocale(org: OrgContentLocaleSettings | null | undefined): Locale {
  const d = org?.default_content_locale
  return isLocale(d) ? d : DEFAULT_LOCALE
}

/**
 * The org's content locales as a one-element list (always `[orgDefaultLocale]`).
 * Kept as an array so callers that iterate content languages (e.g. the vacancy
 * description form) collapse to a single entry without special-casing.
 */
export function orgEnabledLocales(org: OrgContentLocaleSettings | null | undefined): Locale[] {
  return [orgDefaultLocale(org)]
}

/**
 * Resolve the display locale for a candidate-facing page. With a single content
 * language this is just the org default; the parameter is kept for call-site
 * compatibility and intentionally ignored.
 */
export function resolveOrgContentLocale(
  org: OrgContentLocaleSettings | null | undefined,
  _requested?: string | null,
): Locale {
  return orgDefaultLocale(org)
}

/**
 * Fetch + resolve an org's content locale (used by the AI routes to generate in
 * the org's language). Graceful: unmigrated / unset → English. Works with any
 * Supabase client (authed or admin).
 */
export async function fetchOrgContentLocale(
  client: SupabaseClient,
  orgId: string,
): Promise<Locale> {
  const { data } = await client
    .from('organizations')
    .select('default_content_locale, enabled_content_locales')
    .eq('id', orgId)
    .single()
  return orgDefaultLocale(data as OrgContentLocaleSettings | null)
}

/** Validate a submitted content locale before persisting — invalid → `en`. */
export function normalizeOrgContentLocale(locale: string): Locale {
  return isLocale(locale) ? locale : DEFAULT_LOCALE
}
