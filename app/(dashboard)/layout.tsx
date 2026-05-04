import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { runOnboarding } from '@/lib/onboarding'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { TrialBanner } from '@/components/dashboard/trial-banner'

interface ProfileRow {
  id: string
  organization_id: string | null
  full_name: string
  email: string | null
  avatar_url: string | null
  phone: string | null
  role: 'owner' | 'admin' | 'member'
  is_active: boolean
  created_at: string
  updated_at: string
  organizations:
    | {
        id: string
        name: string
        slug: string
        logo_url: string | null
        is_active: boolean
        created_at: string
        updated_at: string
      }[]
    | null
}

interface SubscriptionRow {
  id: string
  organization_id: string
  plan_code: 'trial' | 'individual' | 'organization'
  billing_cycle: 'monthly' | 'annual' | null
  status: 'trial' | 'active' | 'past_due' | 'expired' | 'canceled'
  trial_start_at: string | null
  trial_end_at: string | null
  current_period_start_at: string | null
  current_period_end_at: string | null
  next_billing_at: string | null
  payment_method_linked: boolean
  payment_provider_customer_ref: string | null
  payment_provider_subscription_ref: string | null
  last_payment_status: string | null
  vacancy_limit: number
  candidate_limit: number
  member_limit: number
  created_at: string
  updated_at: string
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  let { data: profileRaw } = await supabase
    .from('profiles')
    .select(`
      id,
      organization_id,
      full_name,
      email,
      avatar_url,
      phone,
      role,
      is_active,
      created_at,
      updated_at,
      organizations (
        id,
        name,
        slug,
        logo_url,
        is_active,
        created_at,
        updated_at
      )
    `)
    .eq('id', user.id)
    .single()

  let profile = profileRaw as ProfileRow | null

  if (!profile?.organization_id) {
    // If there's a pending invitation for this user's email, redirect them
    // to accept it instead of creating a new org via onboarding.
    if (user.email) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const admin = createAdminClient()
      const { data: pendingInvite } = await admin
        .from('team_invitations')
        .select('token')
        .eq('email', user.email.toLowerCase())
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .maybeSingle()
      if (pendingInvite) {
        redirect(`/join?token=${pendingInvite.token}`)
      }
    }

    const result = await runOnboarding(user)
    if (!result.success) {
      throw new Error(`Onboarding failed: ${result.error}`)
    }

    const { data: refreshedProfileRaw, error: refreshedProfileError } = await supabase
      .from('profiles')
      .select(`
        id,
        organization_id,
        full_name,
        email,
        avatar_url,
        phone,
        role,
        is_active,
        created_at,
        updated_at,
        organizations (
          id,
          name,
          slug,
          logo_url,
          is_active,
          created_at,
          updated_at
        )
      `)
      .eq('id', user.id)
      .single()

    if (refreshedProfileError) {
      throw new Error(`Refreshed profile fetch failed: ${refreshedProfileError.message}`)
    }

    profile = refreshedProfileRaw as ProfileRow | null

    if (!profile?.organization_id) {
      throw new Error('Onboarding completed but profile.organization_id is still missing')
    }
  }

  const organization = profile.organizations?.[0] || null
  const headersList = await headers()
  const pathname = headersList.get('x-invoke-path') || headersList.get('x-pathname') || ''

  let subscription: SubscriptionRow | null = null

  if (profile.organization_id) {
    const { data: subscriptionRaw } = await supabase
      .from('subscriptions')
      .select(`
        id,
        organization_id,
        plan_code,
        billing_cycle,
        status,
        trial_start_at,
        trial_end_at,
        current_period_start_at,
        current_period_end_at,
        next_billing_at,
        payment_method_linked,
        payment_provider_customer_ref,
        payment_provider_subscription_ref,
        last_payment_status,
        vacancy_limit,
        candidate_limit,
        created_at,
        updated_at
      `)
      .eq('organization_id', profile.organization_id)
      .single()

    subscription = subscriptionRaw as SubscriptionRow | null
  }

  const isExpired =
    subscription?.status === 'expired' ||
    (subscription?.status === 'trial' &&
      !!subscription.trial_end_at &&
      new Date(subscription.trial_end_at) < new Date())

  if (isExpired && !pathname.includes('/subscription')) {
    redirect('/subscription')
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar
        user={user}
        profile={profile}
        organization={organization}
        subscription={subscription}
      />

      <div className="flex flex-1 flex-col lg:ml-64">
        <DashboardHeader
          user={user}
          profile={profile}
          organization={organization}
          subscription={subscription}
        />

        <TrialBanner
          trialEndAt={subscription?.trial_end_at ?? null}
          isExpired={isExpired}
        />
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  )
}