import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { transliterate } from '@/lib/i18n/transliterate'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n/locales'

function slugify(value: string): string {
  return transliterate(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') // never emit a leading/trailing (or lone) hyphen
}

export type OnboardingResult =
  | { success: true; alreadyInitialized?: boolean }
  | { success: false; error: string }

export interface OnboardingOptions {
  /** Overrides user_metadata.company_name. Used by the OAuth /onboarding/company flow. */
  companyName?: string
  /** Overrides user_metadata.full_name. */
  fullName?: string
  /** The signup UI language, used to seed the org's content locale (candidate
   * emails + public pages). Falls back to user_metadata.locale, then English.
   * OAuth signups pass this from the onboarding page's NEXT_LOCALE cookie. */
  locale?: Locale
}

export async function runOnboarding(
  user: User,
  opts: OnboardingOptions = {}
): Promise<OnboardingResult> {
  const admin = createAdminClient()

  const { data: existingProfile, error: existingProfileError } = await admin
    .from('profiles')
    .select('id, organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (existingProfileError) {
    return { success: false, error: 'Failed to load account data' }
  }

  if (existingProfile?.organization_id) {
    return { success: true, alreadyInitialized: true }
  }

  const fullName =
    opts.fullName?.trim() ||
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    'New User'

  const companyName =
    opts.companyName?.trim() ||
    (user.user_metadata?.company_name as string | undefined)?.trim() ||
    'New Organization'

  // Seed the org's content locale from the signup language so candidate-facing
  // emails + public pages default to the org's language (not always English).
  // Source: explicit opt → signup metadata.locale → English. `en` is always
  // kept in the enabled set so English stays available as a fallback.
  const localeRaw = opts.locale ?? (user.user_metadata?.locale as string | undefined)
  const contentLocale: Locale = isLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE
  const enabledLocales =
    contentLocale === DEFAULT_LOCALE ? [DEFAULT_LOCALE] : [contentLocale, DEFAULT_LOCALE]

  const baseSlug = slugify(companyName) || `org-${user.id.slice(0, 8)}`
  const uniqueSlug = `${baseSlug}-${user.id.slice(0, 6)}`

  let publicPageSlug = baseSlug
  let slugCounter = 1
  while (true) {
    const { data: existing } = await admin
      .from('organizations')
      .select('id')
      .eq('public_page_slug', publicPageSlug)
      .maybeSingle()
    if (!existing) break
    publicPageSlug = `${baseSlug}${slugCounter}`
    slugCounter++
  }

  const { data: organization, error: organizationError } = await admin
    .from('organizations')
    .insert({
      name: companyName,
      slug: uniqueSlug,
      public_page_slug: publicPageSlug,
      is_active: true,
      default_content_locale: contentLocale,
      enabled_content_locales: enabledLocales,
    })
    .select('id')
    .single()

  if (organizationError || !organization) {
    console.error('[onboarding] org insert failed:', organizationError)
    return { success: false, error: 'Failed to create organization' }
  }

  const { error: profileUpsertError } = await admin
    .from('profiles')
    .upsert({
      id: user.id,
      organization_id: organization.id,
      full_name: fullName,
      email: user.email || null,
      role: 'owner',
      is_active: true,
    })

  if (profileUpsertError) {
    console.error('[onboarding] profile upsert failed:', profileUpsertError)
    await admin.from('organizations').delete().eq('id', organization.id)
    return { success: false, error: 'Failed to initialize account' }
  }

  const now = new Date()
  const trialEnd = new Date(now)
  trialEnd.setDate(trialEnd.getDate() + 7)

  const { error: subscriptionError } = await admin
    .from('subscriptions')
    .insert({
      organization_id: organization.id,
      plan_code: 'trial',
      billing_cycle: null,
      status: 'trial',
      trial_start_at: now.toISOString(),
      trial_end_at: trialEnd.toISOString(),
      current_period_start_at: null,
      current_period_end_at: null,
      next_billing_at: null,
      payment_method_linked: false,
      payment_provider_customer_ref: null,
      payment_provider_subscription_ref: null,
      last_payment_status: null,
      vacancy_limit: 5,
      candidate_limit: 100,
      member_limit: 2,
    })

  if (subscriptionError) {
    console.error('[onboarding] subscription insert failed:', subscriptionError)
    await admin.from('organizations').delete().eq('id', organization.id)
    return { success: false, error: 'Failed to initialize account' }
  }

  const { data: generalReason } = await admin
    .from('rejection_reasons')
    .insert({
      organization_id: organization.id,
      name: 'General',
      sort_order: 0,
    })
    .select('id')
    .single()

  if (generalReason) {
    await admin.from('rejection_templates').insert({
      organization_id: organization.id,
      name: 'General',
      subject: 'An update from {{company}} — {{role}}',
      body: 'After careful consideration, we have decided to move forward with other candidates whose experience more closely matches our current needs. We encourage you to apply for future opportunities that match your background.',
      sort_order: 0,
      reason_id: generalReason.id,
    })
  }

  // Seed the org's Main pipeline (default stage set) so it's populated from
  // day one: it drives the cross-vacancy board columns and is copied — with
  // origin links — onto every new vacancy. Best-effort: a failure here must
  // never break onboarding (the seeder's fallback still gives new vacancies
  // the hardcoded default set).
  const { error: pipelineSeedError } = await admin.rpc(
    'seed_org_pipeline_stage_template_defaults',
    { p_org_id: organization.id, p_created_by: user.id },
  )
  if (pipelineSeedError) {
    console.error('[onboarding] main pipeline seed failed:', pipelineSeedError.message)
  }

  return { success: true }
}
