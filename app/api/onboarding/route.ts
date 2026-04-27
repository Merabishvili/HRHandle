import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 5

const attempts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const entry = attempts.get(userId)

  if (!entry || now >= entry.resetAt) {
    attempts.set(userId, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }

  if (entry.count >= MAX_ATTEMPTS) return true

  entry.count++
  return false
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export async function POST() {
  try {
    // Normal client: only for identifying logged-in user
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (isRateLimited(user.id)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before retrying.' },
        { status: 429 }
      )
    }

    // Admin client: for inserts/upserts during onboarding
    const admin = createAdminClient()

    const { data: existingProfile, error: existingProfileError } = await admin
      .from('profiles')
      .select('id, organization_id')
      .eq('id', user.id)
      .maybeSingle()

    if (existingProfileError) {
      return NextResponse.json(
        { error: existingProfileError.message },
        { status: 500 }
      )
    }

    if (existingProfile?.organization_id) {
      return NextResponse.json({ success: true, alreadyInitialized: true })
    }

    const fullName =
      (user.user_metadata?.full_name as string | undefined)?.trim() || 'New User'

    const companyName =
      (user.user_metadata?.company_name as string | undefined)?.trim() || 'New Organization'

    const baseSlug = slugify(companyName) || `org-${user.id.slice(0, 8)}`
    const uniqueSlug = `${baseSlug}-${user.id.slice(0, 6)}`

    const { data: organization, error: organizationError } = await admin
      .from('organizations')
      .insert({
        name: companyName,
        slug: uniqueSlug,
        is_active: true,
      })
      .select('id')
      .single()

    if (organizationError || !organization) {
      return NextResponse.json(
        { error: organizationError?.message || 'Failed to create organization' },
        { status: 500 }
      )
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
      return NextResponse.json(
        { error: profileUpsertError.message },
        { status: 500 }
      )
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
      })

    if (subscriptionError) {
      return NextResponse.json(
        { error: subscriptionError.message },
        { status: 500 }
      )
    }

    // Seed default rejection reason
    await admin.from('rejection_reasons').insert({
      organization_id: organization.id,
      name: 'General',
      sort_order: 0,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unexpected onboarding error',
      },
      { status: 500 }
    )
  }
}