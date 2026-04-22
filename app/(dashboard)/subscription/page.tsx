import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Zap } from 'lucide-react'
import { PRICING_PLANS } from '@/lib/types/subscription'

interface ProfileRow {
  id: string
  organization_id: string | null
  role: 'owner' | 'admin' | 'member'
}

interface OrganizationRow {
  id: string
  name: string
  slug: string
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

function getPlanDisplayName(planCode: 'trial' | 'individual' | 'organization') {
  switch (planCode) {
    case 'individual': return 'Individual'
    case 'organization': return 'Organization'
    default: return 'Free Trial'
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

export default async function SubscriptionPage() {
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
    redirect('/dashboard')
  }

  if (typedProfile.role === 'member') {
    redirect('/dashboard')
  }

  const organizationId = typedProfile.organization_id

  const { data: organization } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('id', organizationId)
    .single()

  const typedOrganization = organization as OrganizationRow | null

  if (!typedOrganization) {
    redirect('/dashboard')
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
    redirect('/dashboard')
  }

  const currentPlan =
    PRICING_PLANS.find((plan) => plan.code === typedSubscription.plan_code) || PRICING_PLANS[0]

  const { count: vacancyCount } = await supabase
    .from('vacancies')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .is('archived_at', null)

  const { count: candidateCount } = await supabase
    .from('candidates')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  const remainingTrialDays = getRemainingTrialDays(typedSubscription.trial_end_at)
  const isTrial = typedSubscription.plan_code === 'trial'

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Subscription</h1>
        <p className="text-muted-foreground">Manage your subscription and billing.</p>
      </div>

      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Your active subscription details</CardDescription>
            </div>

            <Badge
              variant="secondary"
              className={getSubscriptionBadgeClass(typedSubscription.status)}
            >
              {typedSubscription.status.replace('_', ' ')}
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <div className="mb-6 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-foreground">
              {getPlanDisplayName(typedSubscription.plan_code)}
            </span>

            {typedSubscription.plan_code !== 'trial' && (
              <span className="text-muted-foreground">
                {typedSubscription.billing_cycle === 'annual'
                  ? `$${currentPlan.price_annual}/mo billed annually`
                  : `$${currentPlan.price_monthly}/month`}
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">Vacancies Used</p>
              <p className="text-2xl font-bold text-foreground">
                {vacancyCount || 0} / {typedSubscription.vacancy_limit}
              </p>
            </div>

            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">Candidates Used</p>
              <p className="text-2xl font-bold text-foreground">
                {candidateCount || 0} / {typedSubscription.candidate_limit}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Organization</p>
              <p className="font-medium text-foreground">{typedOrganization.name}</p>
            </div>

            <div className="rounded-lg bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">Payment Method</p>
              <p className="font-medium text-foreground">
                {typedSubscription.payment_method_linked ? 'Linked' : 'Not linked'}
              </p>
            </div>
          </div>

          {isTrial && remainingTrialDays !== null && (
            <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-900">
              <p className="font-medium">
                Trial period: {remainingTrialDays} day{remainingTrialDays === 1 ? '' : 's'} remaining
              </p>
              <p className="mt-1 text-sm">
                After the free trial, the account should move to Professional if a payment method is linked.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-xl font-semibold text-foreground">Available Plans</h2>

        <div className="grid gap-6 md:grid-cols-2">
          {PRICING_PLANS.map((plan) => {
            const isCurrent = plan.code === typedSubscription.plan_code

            return (
              <Card
                key={plan.code}
                className={`relative border-border ${
                  plan.popular ? 'border-2 border-primary shadow-lg' : ''
                } ${isCurrent ? 'bg-muted/30' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    Most Popular
                  </div>
                )}

                <CardContent className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>
                    {isCurrent && <Badge variant="secondary">Current</Badge>}
                  </div>

                  <div className="mb-6">
                    {plan.code === 'trial' ? (
                      <>
                        <span className="text-3xl font-bold text-foreground">Free</span>
                        <span className="text-muted-foreground"> / 7 days</span>
                      </>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-foreground">
                          ${plan.price_monthly}
                        </span>
                        <span className="text-muted-foreground">/month</span>
                        <p className="mt-1 text-sm text-muted-foreground">
                          or ${plan.price_annual}/year
                        </p>
                      </>
                    )}
                  </div>

                  <ul className="mb-6 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={isCurrent ? 'outline' : plan.popular ? 'default' : 'outline'}
                    disabled={isCurrent}
                  >
                    {isCurrent
                      ? 'Current Plan'
                      : plan.code === 'trial'
                        ? 'Trial Plan'
                        : 'Upgrade'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {typedSubscription.plan_code === 'trial' && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-6 w-6 text-primary" />
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">
                  Unlock more capacity
                </h3>
                <p className="text-sm text-muted-foreground">
                  Move to Professional to manage more vacancies and candidates with full ATS functionality.
                </p>
              </div>

              <Button>Upgrade Now</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}