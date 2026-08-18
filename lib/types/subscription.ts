import type { UUID, ISODateTimeString } from './common'
import type { Currency } from '@/lib/pricing/currency'

export type PlanCode = 'trial' | 'individual' | 'organization'
export type BillingCycle = 'monthly' | 'annual'
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'expired' | 'canceled'

export interface Subscription {
  id: UUID
  organization_id: UUID
  plan_code: PlanCode
  billing_cycle: BillingCycle | null
  status: SubscriptionStatus

  trial_start_at: ISODateTimeString | null
  trial_end_at: ISODateTimeString | null
  current_period_start_at: ISODateTimeString | null
  current_period_end_at: ISODateTimeString | null
  next_billing_at: ISODateTimeString | null

  payment_method_linked: boolean
  payment_provider_customer_ref: string | null
  payment_provider_subscription_ref: string | null
  last_payment_status: string | null

  vacancy_limit: number
  candidate_limit: number
  member_limit: number

  created_at: ISODateTimeString
  updated_at: ISODateTimeString
}

export interface PlanUsage {
  current_plan: PlanCode
  subscription_status: SubscriptionStatus
  vacancy_limit: number
  candidate_limit: number
  used_vacancies: number
  used_candidates: number
  remaining_trial_days: number | null
  payment_method_linked: boolean
}

/** Per-currency price points. `annual` is the PER-MONTH price when billed
 * annually (the yearly charge is `annual * 12`). */
export interface PlanPrice {
  monthly: number
  annual: number
}

export interface PricingPlan {
  name: string
  code: PlanCode
  /** Prices in every supported currency; `null` for the free trial. */
  prices: Record<Currency, PlanPrice> | null
  features: string[]
  vacancy_limit: number
  candidate_limit: number
  member_limit: number
  popular?: boolean
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    name: 'Free Trial',
    code: 'trial',
    prices: null,
    vacancy_limit: 5,
    candidate_limit: 100,
    member_limit: 2,
    features: [
      '7-day free trial',
      'Up to 5 vacancies',
      'Up to 100 candidates',
      'Up to 2 team members',
      'Basic ATS features',
    ],
  },
  {
    name: 'Individual',
    code: 'individual',
    prices: {
      GEL: { monthly: 49, annual: 39 },
      EUR: { monthly: 19, annual: 15 },
      USD: { monthly: 20, annual: 16 },
    },
    vacancy_limit: 500,
    candidate_limit: 10000,
    member_limit: 3,
    features: [
      'Up to 500 vacancies',
      'Up to 10,000 candidates',
      'Up to 3 team members',
      'Full candidate tracking',
      'Interview scheduling',
      'Advanced filtering',
    ],
  },
  {
    name: 'Organization',
    code: 'organization',
    prices: {
      GEL: { monthly: 99, annual: 79 },
      EUR: { monthly: 39, annual: 31 },
      USD: { monthly: 40, annual: 32 },
    },
    vacancy_limit: 1000,
    candidate_limit: 20000,
    member_limit: 50,
    popular: true,
    features: [
      'Up to 1,000 vacancies',
      'Up to 20,000 candidates',
      'Up to 50 team members',
      'Full candidate tracking',
      'Interview scheduling',
      'Advanced filtering',
      'Team collaboration',
    ],
  },
]

/** Per-month price for a plan in a currency + cycle (null for the free trial). */
export function getPlanMonthly(
  plan: PricingPlan,
  currency: Currency,
  cycle: BillingCycle,
): number | null {
  if (!plan.prices) return null
  const p = plan.prices[currency]
  return cycle === 'annual' ? p.annual : p.monthly
}

/** Total amount charged per billing period (monthly = 1×, annual = 12×). */
export function getPlanChargeTotal(
  plan: PricingPlan,
  currency: Currency,
  cycle: BillingCycle,
): number | null {
  const monthly = getPlanMonthly(plan, currency, cycle)
  if (monthly === null) return null
  return cycle === 'annual' ? monthly * 12 : monthly
}
