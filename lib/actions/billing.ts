'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import { getRequestCountry } from '@/lib/sanctions'
import { isOrgAdmin } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit-log'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSubscriptionCheckout, stopSubscription, isFlittConfigured } from '@/lib/flitt/client'
import {
  resolveBillingCurrency,
  toMinorUnits,
  isCurrency,
  type Currency,
} from '@/lib/pricing/currency'
import {
  PRICING_PLANS,
  getPlanChargeTotal,
  type BillingCycle,
  type PlanCode,
} from '@/lib/types/subscription'

const PAID_PLANS: PlanCode[] = ['individual', 'organization']

/** Absolute site origin — NEXT_PUBLIC_SITE_URL when set, else the request host
 * (Flitt requires absolute HTTPS callback + return URLs). */
async function getSiteUrl(): Promise<string> {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
  if (configured) return configured
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return host ? `${proto}://${host}` : ''
}

/**
 * Start a recurring Flitt checkout for a paid plan. Owner/admin only. Resolves
 * the org's currency (GEL/EUR/USD), records a pending `payment_orders` row (via
 * the service-role admin client — clients can never write orders), then asks
 * Flitt for a hosted checkout URL. The subscription only flips to active when
 * the signed server callback arrives (see the callback route) — this action
 * just gets the user to the payment page.
 */
export async function startPlanCheckout(input: {
  planCode: PlanCode
  cycle: BillingCycle
}): Promise<ActionResult<{ checkoutUrl: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can manage billing.' }
  }
  if (!PAID_PLANS.includes(input.planCode)) {
    return { success: false, error: 'Choose a paid plan to upgrade.' }
  }
  if (input.cycle !== 'monthly' && input.cycle !== 'annual') {
    return { success: false, error: 'Invalid billing cycle.' }
  }
  if (!isFlittConfigured()) {
    return { success: false, error: 'Payments are not configured yet. Please try again later.' }
  }

  const { data: org } = await ctx.supabase
    .from('organizations')
    .select('name, billing_country, billing_currency')
    .eq('id', ctx.orgId)
    .single()

  const requestCountry = getRequestCountry(await headers())
  const currency: Currency = resolveBillingCurrency(
    org?.billing_country || requestCountry,
    org?.billing_currency,
  )

  const plan = PRICING_PLANS.find((p) => p.code === input.planCode)
  if (!plan) return { success: false, error: 'Unknown plan.' }
  const total = getPlanChargeTotal(plan, currency, input.cycle)
  if (total === null) return { success: false, error: 'This plan is not purchasable.' }
  const amountMinor = toMinorUnits(total)

  // Unique order id — also the correlation key on the callback + the recurring
  // handle we use to cancel later.
  const shortOrg = ctx.orgId.replace(/-/g, '').slice(0, 12)
  const orderId = `hrh_${shortOrg}_${input.planCode}_${input.cycle}_${Date.now()}`

  const {
    data: { user },
  } = await ctx.supabase.auth.getUser()

  const admin = createAdminClient()
  const { error: insErr } = await admin.from('payment_orders').insert({
    organization_id: ctx.orgId,
    order_id: orderId,
    plan_code: input.planCode,
    billing_cycle: input.cycle,
    currency,
    amount_minor: amountMinor,
    status: 'pending',
    created_by: ctx.userId,
  })
  if (insErr) {
    return { success: false, error: 'Could not start checkout. Please try again.' }
  }

  const siteUrl = await getSiteUrl()
  const result = await createSubscriptionCheckout({
    orderId,
    orderDesc: `HRHandle ${plan.name} — ${input.cycle === 'annual' ? 'annual' : 'monthly'}`,
    amountMinor,
    currency,
    responseUrl: `${siteUrl}/settings/billing?checkout=return`,
    callbackUrl: `${siteUrl}/api/payments/flitt/callback`,
    ...(user?.email ? { senderEmail: user.email } : {}),
    merchantData: JSON.stringify({ org: ctx.orgId }),
    // Monthly = charge every 1 month; annual = charge every 12 months. Flitt
    // tokenizes the card on the first charge and auto-renews thereafter.
    recurring: { every: input.cycle === 'annual' ? 12 : 1, period: 'month' },
  })

  if (!result.ok) {
    return {
      success: false,
      error:
        result.reason === 'not_configured'
          ? 'Payments are not configured yet.'
          : 'The payment provider is unavailable right now. Please try again shortly.',
    }
  }

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'organization',
    entityId: ctx.orgId,
    action: 'billing_checkout_started',
    message: `Checkout started — ${plan.name} ${input.cycle} (${currency} ${total})`,
    details: { orderId, planCode: input.planCode, cycle: input.cycle, currency, amountMinor },
  })

  return { success: true, data: { checkoutUrl: result.checkoutUrl } }
}

/** Owner/admin: persist a manual billing-currency override for the org. */
export async function setBillingCurrency(currency: Currency): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can change the billing currency.' }
  }
  if (!isCurrency(currency)) return { success: false, error: 'Invalid currency.' }

  const { error } = await ctx.supabase
    .from('organizations')
    .update({ billing_currency: currency })
    .eq('id', ctx.orgId)
  if (error) return { success: false, error: 'Could not update the billing currency.' }

  revalidatePath('/settings/billing')
  return { success: true, data: undefined }
}

/**
 * Owner/admin: stop auto-renewal at Flitt. The org keeps access until the end
 * of the current paid period; `next_billing_at` is cleared so no further charge
 * is expected. The recurring is keyed by the order id we stored on the
 * subscription's `payment_provider_subscription_ref`.
 */
export async function cancelSubscription(): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can manage billing.' }
  }

  const { data: sub } = await ctx.supabase
    .from('subscriptions')
    .select('payment_provider_subscription_ref')
    .eq('organization_id', ctx.orgId)
    .single()

  const orderRef = (sub?.payment_provider_subscription_ref as string | null) ?? null
  if (!orderRef) return { success: false, error: 'No active subscription to cancel.' }

  const stop = await stopSubscription(orderRef)
  if (!stop.ok) {
    return {
      success: false,
      error: 'Could not cancel with the payment provider. Please contact support.',
    }
  }

  const admin = createAdminClient()
  await admin
    .from('subscriptions')
    .update({ next_billing_at: null, updated_at: new Date().toISOString() })
    .eq('organization_id', ctx.orgId)

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'organization',
    entityId: ctx.orgId,
    action: 'billing_subscription_canceled',
    message: 'Auto-renewal canceled',
    details: { orderRef },
  })

  revalidatePath('/settings/billing')
  return { success: true, data: undefined }
}
