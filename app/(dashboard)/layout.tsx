import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { runOnboarding } from '@/lib/onboarding'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { SessionGuard } from '@/components/auth/session-guard'
import { PostHogIdentify } from '@/components/analytics/posthog-identify'

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
        deleted_at: string | null
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

  // Invited users have invite_token stored in user metadata at sign-up.
  // Redirect them to accept the invite before loading the dashboard,
  // regardless of whether onboarding has already run.
  const inviteToken = user.user_metadata?.invite_token as string | undefined
  if (inviteToken) {
    const { createAdminClient: adminForInvite } = await import('@/lib/supabase/admin')
    const { data: pendingInvite } = await adminForInvite()
      .from('team_invitations')
      .select('token')
      .eq('token', inviteToken)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    if (pendingInvite) {
      redirect(`/join?token=${inviteToken}`)
    }
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
        deleted_at,
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

    // G-008 country gate, OAuth-loophole closure: a user from a blocked
    // jurisdiction can bypass /auth/sign-up by clicking "Continue with Google"
    // on /auth/login (which is intentionally NOT country-gated because it
    // serves existing customers who travel). At this point in the layout we
    // know the user has no organization yet — i.e. this is effectively new
    // account creation. Block here too. Existing customers (with org_id) are
    // never affected because they don't reach this branch.
    const { getBlockedCountry } = await import('@/lib/sanctions')
    const requestHeaders = await headers()
    if (getBlockedCountry(requestHeaders)) {
      redirect('/not-available')
    }

    // First-time OAuth users have no company_name in metadata (Google/Microsoft
    // don't return it). Send them to /onboarding/company to collect it before
    // creating the org — otherwise runOnboarding falls back to "New Organization".
    // Email-signup users have it set by the sign-up form and skip this hop.
    const metadataCompanyName = user.user_metadata?.company_name
    const hasCompanyName =
      typeof metadataCompanyName === 'string' && metadataCompanyName.trim().length > 0
    if (!hasCompanyName) {
      redirect('/onboarding/company')
    }

    const result = await runOnboarding(user)
    if (!result.success) {
      throw new Error(`Onboarding failed: ${result.error}`)
    }

    const { createAdminClient: createAdminClientForRefresh } = await import('@/lib/supabase/admin')
    const adminForRefresh = createAdminClientForRefresh()
    const { data: refreshedProfileRaw, error: refreshedProfileError } = await adminForRefresh
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

    // The layout and page run concurrently in Next.js App Router, so the page
    // may query organization_id before the onboarding write is visible to the
    // regular Supabase client. Redirecting forces a fresh request where both
    // the layout and page read the fully committed state.
    redirect('/dashboard')
  }

  const organization = profile.organizations?.[0] || null

  // G-007 chokepoint: if the organisation has been scheduled for deletion,
  // route every member (owner and team) to the deletion-scheduled page until
  // either an admin cancels (email-based for now) or the daily purge cron
  // hard-deletes the org after the 30-day grace promised in Privacy Policy §7.
  if (organization?.deleted_at) {
    redirect('/onboarding/account-deletion-scheduled')
  }

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

  // Expired trial: send them to the canonical billing page. The legacy
  // /subscription route still redirects to /settings/billing, so the
  // includes() check covers both URLs and avoids a redirect loop if the
  // user lands on /subscription themselves.
  if (isExpired && !pathname.includes('/subscription') && !pathname.includes('/settings/billing')) {
    redirect('/settings/billing')
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Skip-to-content link (audit AC-011). Hidden until keyboard-focused. */}
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to main content
      </a>

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

        <main id="dashboard-main" tabIndex={-1} className="flex-1 p-4 lg:p-8">{children}</main>
        <SessionGuard />
        <PostHogIdentify userId={user.id} orgId={profile.organization_id} role={profile.role} />
      </div>
    </div>
  )
}