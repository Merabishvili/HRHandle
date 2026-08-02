import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from './locales'

/**
 * Org content-language helpers (i18n Slice 2 — see docs/redesign/i18n-plan.md
 * §10.2). The org's content language governs candidate-facing pages + AI
 * output, resolved independently of each recruiter's personal UI locale.
 */
export interface OrgContentLocaleSettings {
  default_content_locale?: string | null
  enabled_content_locales?: string[] | null
}

/** Enabled content locales for an org — validated, deduped, `en` always present. */
export function orgEnabledLocales(org: OrgContentLocaleSettings | null | undefined): Locale[] {
  const raw = (org?.enabled_content_locales ?? []).filter(isLocale)
  const set = new Set<Locale>(raw)
  set.add(DEFAULT_LOCALE) // 'en' is always available
  // Preserve the canonical LOCALES order for stable rendering.
  return LOCALES.filter((l) => set.has(l))
}

/** The org's default content locale — falls back to `en` if unset/invalid. */
export function orgDefaultLocale(org: OrgContentLocaleSettings | null | undefined): Locale {
  const d = org?.default_content_locale
  return isLocale(d) ? d : DEFAULT_LOCALE
}

/**
 * Resolve the display locale for a candidate-facing page:
 * requested (only if the org enabled it) → org default → `en`.
 */
export function resolveOrgContentLocale(
  org: OrgContentLocaleSettings | null | undefined,
  requested?: string | null,
): Locale {
  const enabled = orgEnabledLocales(org)
  if (requested && isLocale(requested) && enabled.includes(requested)) return requested
  const def = orgDefaultLocale(org)
  return enabled.includes(def) ? def : DEFAULT_LOCALE
}

/**
 * Normalize an admin's submitted content-language settings before persisting:
 * drop invalid locales, force-include `en`, and clamp the default into the
 * enabled set. Pure — unit-tested and reused by the server action.
 */
/**
 * Fetch + resolve an org's default content locale (i18n Slice 5 — used by the
 * AI routes to generate in the org's language). Graceful: unmigrated / unset →
 * English. Works with any Supabase client (authed or admin).
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

export function normalizeOrgLocales(
  defaultLocale: string,
  enabled: string[],
): { default: Locale; enabled: Locale[] } {
  const set = new Set<Locale>(enabled.filter(isLocale))
  set.add(DEFAULT_LOCALE)
  const enabledOrdered = LOCALES.filter((l) => set.has(l))
  const def: Locale = isLocale(defaultLocale) && set.has(defaultLocale) ? defaultLocale : DEFAULT_LOCALE
  return { default: def, enabled: enabledOrdered }
}
