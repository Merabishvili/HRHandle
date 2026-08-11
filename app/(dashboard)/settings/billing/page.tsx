import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getRequestCountry } from '@/lib/sanctions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Zap } from 'lucide-react'
import { PRICING_PLANS, getPlanMonthly } from '@/lib/types/subscription'
import { resolveBillingCurrency, CURRENCY_SYMBOL } from '@/lib/pricing/currency'
import { isCampaignActive, CAMPAIGN } from '@/lib/campaign'
import { PlanCards } from '@/components/subscription/plan-cards'
import { BillingControls } from '@/components/subscription/billing-controls'
import { PaymentMethods } from '@/components/subscription/payment-methods'

interface ProfileRow {
  id: string
  organization_id: string | null
  role: 'owner' | 'admin' | 'member'
}

interface OrganizationRow {
  id: string
  name: string
  slug: string
  billing_country: string | null
  billing_currency: string | null
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
  vacancy_limit: number
  candidate_limit: number
  member_limit: number
  created_at: string
  updated_at: string
}

function getSubscriptionBadgeClass(status: SubscriptionRow['status']) {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800'
    case 'trial':
      return 'bg-blue-100 text-blue-800'
    case 'past_due':
      return 'bg-yellow-100 text-yellow-800'
    case 'expired':
    case 'canceled':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

function getPlanDisplayNameKey(planCode: 'trial' | 'individual' | 'organization') {
  switch (planCode) {
    case 'individual': return 'billing.planIndividual'
    case 'organization': return 'billing.planOrganization'
    default: return 'billing.planTrial'
  }
}

function getRemainingTrialDays(trialEndAt: string | null): number | null {
  if (!trialEndAt) return null

  const now = new Date()
  const end = new Date(trialEndAt)
  const diffMs = end.getTime() - now.getTime()
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  return days > 0 ? days : 0
}

/**
 * Settings → Organization → Billing (Wave 1.2 / S07 §2.8).
 *
 * Was previously hosted at /subscription. The standalone /subscription route
 * now redirects here. Per locked Q-S7-g, the redirect stays in place for ~6
 * months so any external bookmarks / email links keep working.
 */
export default async function BillingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>
}) {
  const { checkout } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organization_id, role')
    .eq('id', user.id)
    .single()

  const typedProfile = profile as ProfileRow | null

  if (!typedProfile?.organization_id) {
    redirect('/pipeline')
  }

  if (typedProfile.role === 'member') {
    redirect('/pipeline')
  }

  const organizationId = typedProfile.organization_id

  const { data: organization } = await supabase
    .from('organizations')
    .select('id, name, slug, billing_country, billing_currency')
    .eq('id', organizationId)
    .single()

  const typedOrganization = organization as OrganizationRow | null

  if (!typedOrganization) {
    redirect('/pipeline')
  }

  const { data: subscription } = await supabase
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
      vacancy_limit,
      candidate_limit,
      created_at,
      updated_at
    `)
    .eq('organization_id', organizationId)
    .single()

  const typedSubscription = subscription as SubscriptionRow | null

  if (!typedSubscription) {
    redirect('/pipeline')
  }

  // Default the currency by the visitor's location when the org hasn't set a
  // billing country — a Georgian visitor (x-vercel-ip-country = GE) defaults to
  // GEL. The saved billing_currency override always wins.
  const requestCountry = getRequestCountry(await headers())
  const currency = resolveBillingCurrency(
    typedOrganization.billing_country || requestCountry,
    typedOrganization.billing_currency,
  )

  const currentPlan =
    PRICING_PLANS.find((plan) => plan.code === typedSubscription.plan_code) || PRICING_PLANS[0]

  const isPaidActive =
    typedSubscription.plan_code !== 'trial' && typedSubscription.status === 'active'

  const currentCycle: 'monthly' | 'annual' =
    typedSubscription.billing_cycle === 'annual' ? 'annual' : 'monthly'
  const currentMonthly = currentPlan ? getPlanMonthly(currentPlan, currency, currentCycle) : null

  const { count: vacancyCount } = await supabase
    .from('vacancies')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .is('archived_at', null)
    .is('deleted_at', null)

  const { count: candidateCount } = await supabase
    .from('candidates')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  const remainingTrialDays = getRemainingTrialDays(typedSubscription.trial_end_at)
  const isTrial = typedSubscription.plan_code === 'trial'
  const t = await getTranslations()

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('settings.nav.billing')}</h1>
        <p className="text-muted-foreground">{t('billing.subtitle')}</p>
      </div>

      {checkout === 'return' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-medium">{t('billing.checkoutThanks')}</p>
          <p className="mt-1">
            {t('billing.checkoutDesc')}
          </p>
        </div>
      )}

      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('billing.currentPlan')}</CardTitle>
              <CardDescription>{t('billing.currentPlanDesc')}</CardDescription>
            </div>

            <Badge
              variant="secondary"
              className={getSubscriptionBadgeClass(typedSubscription.status)}
            >
              {t(`billing.status.${typedSubscription.status}`)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <div className="mb-6 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-foreground">
              {t(getPlanDisplayNameKey(typedSubscription.plan_code))}
            </span>

            {typedSubscription.plan_code !== 'trial' && currentMonthly !== null && (
              <span className="text-muted-foreground">
                {currentCycle === 'annual'
                  ? t('billing.perMoAnnual', { price: `${CURRENCY_SYMBOL[currency]}${currentMonthly}` })
                  : t('billing.perMonth', { price: `${CURRENCY_SYMBOL[currency]}${currentMonthly}` })}
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">{t('billing.vacanciesUsed')}</p>
              <p className="text-2xl font-bold text-foreground">
                {vacancyCount || 0} / {typedSubscription.vacancy_limit}
              </p>
            </div>

            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">{t('billing.candidatesUsed')}</p>
              <p className="text-2xl font-bold text-foreground">
                {candidateCount || 0} / {typedSubscription.candidate_limit}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">{t('billing.planOrganization')}</p>
              <p className="font-medium text-foreground">{typedOrganization.name}</p>
            </div>

            <div className="rounded-lg bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">{t('billing.paymentMethod')}</p>
              <p className="font-medium text-foreground">
                {typedSubscription.payment_method_linked ? t('billing.linked') : t('billing.notLinked')}
              </p>
            </div>
          </div>

          {isTrial && remainingTrialDays !== null && (
            <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-900">
              <p className="font-medium">
                {t('billing.trialRemaining', { count: remainingTrialDays })}
              </p>
              <p className="mt-1 text-sm">
                {t('billing.trialAfter')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <BillingControls
        currency={currency}
        canManage={typedProfile.role === 'owner' || typedProfile.role === 'admin'}
        showCancel={isPaidActive}
        autoRenewOff={isPaidActive && !typedSubscription.next_billing_at}
      />

      <PlanCards
        plans={PRICING_PLANS}
        currentPlanCode={typedSubscription.plan_code}
        currency={currency}
        campaign={CAMPAIGN}
        campaignActive={isCampaignActive()}
      />

      <PaymentMethods className="justify-center" />

      <p className="text-center text-xs text-muted-foreground">
        {t.rich('billing.renewNote', {
          refund: (c) => <a href="/refund" className="underline">{c}</a>,
          terms: (c) => <a href="/terms" className="underline">{c}</a>,
        })}
      </p>

      {typedSubscription.plan_code === 'trial' && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-6 w-6 text-primary" />
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">
                  {t('billing.unlockCapacity')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t('billing.upgradeDesc')}
                </p>
              </div>

              <Button>{t('billing.upgradeNow')}</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
