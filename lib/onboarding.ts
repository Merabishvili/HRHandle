import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export type OnboardingResult =
  | { success: true; alreadyInitialized?: boolean }
  | { success: false; error: string }

export async function runOnboarding(user: User): Promise<OnboardingResult> {
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
    (user.user_metadata?.full_name as string | undefined)?.trim() || 'New User'

  const companyName =
    (user.user_metadata?.company_name as string | undefined)?.trim() || 'New Organization'

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

  return { success: true }
}
