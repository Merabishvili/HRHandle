'use server'

import { headers } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import { getRequestCountry } from '@/lib/sanctions'
import { isOrgAdmin } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit-log'
import { createAdminClient } from '@/lib/supabase/admin'
import { callbackOrigin } from '@/lib/site-url'
import { isResidencyLocked } from '@/lib/billing/residency'
import { createSubscriptionCheckout, stopSubscription, isFlittConfigured } from '@/lib/flitt/client'
import {
  allowedCurrencies,
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

/**
 * Start a recurring Flitt checkout for a paid plan. Owner/admin only. Resolves
 * the org's currency (GEL/EUR/USD), records a pending `payment_orders` row (via
 * the service-role admin client — clients can never write orders), then asks
 * Flitt for a hosted checkout URL. Refuses until the org has answered the
 * Georgian-residency question (`billing_ge_resident`), since that decides
 * whether it may pay in a foreign currency. The subscription only flips to active when
 * the signed server callback arrives (see the callback route) — this action
 * just gets the user to the payment page.
 */
export async function startPlanCheckout(input: {
  planCode: PlanCode
  cycle: BillingCycle
}): Promise<ActionResult<{ checkoutUrl: string }>> {
  // Errors are shown in a toast — localize to the caller's UI language.
  const t = await getTranslations('billingErr')
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: t('notAuthenticated') }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: t('adminOnly') }
  }
  if (!PAID_PLANS.includes(input.planCode)) {
    return { success: false, error: t('choosePaidPlan') }
  }
  if (input.cycle !== 'monthly' && input.cycle !== 'annual') {
    return { success: false, error: t('invalidCycle') }
  }
  if (!isFlittConfigured()) {
    return { success: false, error: t('notConfigured') }
  }

  const { data: org } = await ctx.supabase
    .from('organizations')
    .select('name, billing_country, billing_currency, billing_ge_resident')
    .eq('id', ctx.orgId)
    .single()

  const geResident = (org?.billing_ge_resident as boolean | null | undefined) ?? null
  if (geResident === null) return { success: false, error: t('residencyRequired') }

  const requestCountry = getRequestCountry(await headers())
  const currency: Currency = resolveBillingCurrency(
    org?.billing_country || requestCountry,
    org?.billing_currency,
    geResident,
  )

  const plan = PRICING_PLANS.find((p) => p.code === input.planCode)
  if (!plan) return { success: false, error: t('unknownPlan') }
  const total = getPlanChargeTotal(plan, currency, input.cycle)
  if (total === null) return { success: false, error: t('notPurchasable') }
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
    return { success: false, error: t('checkoutFailed') }
  }

  // The host serving this request (www.hrhandle.com in prod) — NOT the apex
  // NEXT_PUBLIC_SITE_URL, which 307-redirects and loses Flitt's server callback.
  const siteUrl = callbackOrigin(await headers())
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
      error: result.reason === 'not_configured' ? t('notConfigured') : t('providerUnavailable'),
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
  // Errors are shown in a toast — localize to the caller's UI language.
  const t = await getTranslations('billingErr')
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: t('notAuthenticated') }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: t('currencyAdminOnly') }
  }
  if (!isCurrency(currency)) return { success: false, error: t('invalidCurrency') }

  const { data: org } = await ctx.supabase
    .from('organizations')
    .select('billing_ge_resident')
    .eq('id', ctx.orgId)
    .single()
  if (!allowedCurrencies(org?.billing_ge_resident as boolean | null | undefined).includes(currency)) {
    return { success: false, error: t('residentGelOnly') }
  }

  const { error } = await ctx.supabase
    .from('organizations')
    .update({ billing_currency: currency })
    .eq('id', ctx.orgId)
  if (error) return { success: false, error: t('currencyUpdateFailed') }

  revalidatePath('/settings/billing')
  return { success: true, data: undefined }
}

/**
 * Owner/admin: answer the required "I am a resident of Georgia (individual or
 * legal entity)" question on the billing page. A resident is charged in GEL
 * only (Organic Law on the National Bank, art. 34), so a yes also clears any
 * foreign-currency override. Who answered and when is kept on the org row and
 * in the audit log: the customer is responsible for the declaration (Terms §5).
 * Locked after the org's first successful payment (`isResidencyLocked`); from
 * then on only support changes it. Answered in Settings → Organization or in
 * the dialog that opens from Upgrade on the billing page.
 */
export async function setBillingResidency(geResident: boolean): Promise<ActionResult<void>> {
  // Errors are shown in a toast — localize to the caller's UI language.
  const t = await getTranslations('billingErr')
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: t('notAuthenticated') }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: t('adminOnly') }
  }
  if (typeof geResident !== 'boolean') return { success: false, error: t('residencyUpdateFailed') }
  if (await isResidencyLocked(ctx.supabase, ctx.orgId)) {
    return { success: false, error: t('residencyLocked') }
  }

  const { error } = await ctx.supabase
    .from('organizations')
    .update({
      billing_ge_resident: geResident,
      billing_residency_declared_at: new Date().toISOString(),
      billing_residency_declared_by: ctx.userId,
      ...(geResident ? { billing_currency: 'GEL' } : {}),
    })
    .eq('id', ctx.orgId)
  if (error) return { success: false, error: t('residencyUpdateFailed') }

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'organization',
    entityId: ctx.orgId,
    action: 'billing_residency_declared',
    message: geResident
      ? 'Declared a resident of Georgia (charged in GEL)'
      : 'Declared not a resident of Georgia',
    details: { resident: geResident },
  })

  revalidatePath('/settings/billing')
  revalidatePath('/settings/organization')
  return { success: true, data: undefined }
}

/**
 * Owner/admin: stop auto-renewal at Flitt. The org keeps access until the end
 * of the current paid period; `next_billing_at` is cleared so no further charge
 * is expected. The recurring is keyed by the order id we stored on the
 * subscription's `payment_provider_subscription_ref`.
 */
export async function cancelSubscription(): Promise<ActionResult<void>> {
  // Errors are shown in a toast — localize to the caller's UI language.
  const t = await getTranslations('billingErr')
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: t('notAuthenticated') }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: t('adminOnly') }
  }

  const { data: sub } = await ctx.supabase
    .from('subscriptions')
    .select('payment_provider_subscription_ref')
    .eq('organization_id', ctx.orgId)
    .single()

  const orderRef = (sub?.payment_provider_subscription_ref as string | null) ?? null
  if (!orderRef) return { success: false, error: t('noSubscription') }

  const stop = await stopSubscription(orderRef)
  if (!stop.ok) {
    return {
      success: false,
      error: t('cancelFailed'),
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
    // Flitt's confirmed status — the portal doesn't show it, so this is the proof.
    details: { orderRef, flittStatus: stop.status ?? null },
  })

  revalidatePath('/settings/billing')
  return { success: true, data: undefined }
}
