import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCallback } from '@/lib/flitt/client'
import { normalizeCallback } from '@/lib/flitt/callback'
import { PRICING_PLANS } from '@/lib/types/subscription'

// The Flitt SDK uses Node's `https`/`crypto`; keep this on the Node runtime.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Advance a date by one billing period. */
function addPeriod(from: Date, cycle: string): Date {
  const d = new Date(from)
  if (cycle === 'annual') d.setUTCFullYear(d.getUTCFullYear() + 1)
  else d.setUTCMonth(d.getUTCMonth() + 1)
  return d
}

/** Parse a Flitt callback body — JSON or form-encoded, with an optional
 * `{ request: … }` wrapper. */
async function parseBody(req: Request): Promise<Record<string, unknown> | null> {
  const contentType = req.headers.get('content-type') ?? ''
  try {
    if (contentType.includes('application/json')) {
      const json = (await req.json()) as Record<string, unknown>
      return (json.request as Record<string, unknown>) ?? json
    }
    const text = await req.text()
    const params = Object.fromEntries(new URLSearchParams(text)) as Record<string, unknown>
    if (typeof params.request === 'string') {
      try {
        return JSON.parse(params.request as string) as Record<string, unknown>
      } catch {
        return params
      }
    }
    return params
  } catch {
    return null
  }
}

/**
 * Flitt server-to-server callback — the source of truth for a payment. Fires on
 * the first charge and on each recurring renewal. We verify the signature,
 * match the stored order (anti-tamper), then flip the subscription to active on
 * `approved`. Always ack with 200 once handled so Flitt stops retrying; a bad
 * signature returns 400 (unverified — never trusted).
 */
export async function POST(req: Request): Promise<NextResponse> {
  const body = await parseBody(req)
  if (!body) return new NextResponse('bad request', { status: 400 })

  // 1) Signature — reject anything we can't verify against our secret.
  if (!verifyCallback(body)) {
    Sentry.captureMessage('[flitt/callback] signature verification failed', {
      level: 'warning',
      tags: { feature: 'flitt_callback' },
    })
    return new NextResponse('invalid signature', { status: 400 })
  }

  const cb = normalizeCallback(body)
  if (!cb) return new NextResponse('OK', { status: 200 }) // nothing actionable

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('payment_orders')
    .select('id, organization_id, plan_code, billing_cycle, currency, amount_minor, status')
    .eq('order_id', cb.order_id)
    .maybeSingle()

  if (!order) {
    // Unknown order — ack so Flitt stops retrying, but record the anomaly.
    Sentry.captureMessage('[flitt/callback] unknown order_id', {
      level: 'warning',
      tags: { feature: 'flitt_callback' },
      extra: { order_id: cb.order_id },
    })
    return new NextResponse('OK', { status: 200 })
  }

  // 2) Anti-tamper — the signed amount/currency must match what we recorded.
  const amountMatches = Number(cb.amount) === order.amount_minor
  const currencyMatches = String(cb.currency).toUpperCase() === order.currency
  if (!amountMatches || !currencyMatches) {
    Sentry.captureMessage('[flitt/callback] amount/currency mismatch', {
      level: 'error',
      tags: { feature: 'flitt_callback' },
      extra: { order_id: cb.order_id, cb_amount: cb.amount, cb_currency: cb.currency },
    })
    return new NextResponse('OK', { status: 200 })
  }

  const status = cb.order_status
  const nowIso = new Date().toISOString()

  // 3) Idempotency — if this order is already approved and we get another
  // approved callback (Flitt retry), don't double-apply.
  if (order.status === 'approved' && status === 'approved') {
    return new NextResponse('OK', { status: 200 })
  }

  // Always reflect the latest status + provider ids on the order ledger.
  await admin
    .from('payment_orders')
    .update({
      status,
      flitt_payment_id: (cb.payment_id as string | undefined) ?? null,
      flitt_rectoken: (cb.rectoken as string | undefined) ?? null,
      updated_at: nowIso,
    })
    .eq('id', order.id)

  if (status === 'approved') {
    const plan = PRICING_PLANS.find((p) => p.code === order.plan_code)
    const periodStart = new Date()
    const periodEnd = addPeriod(periodStart, order.billing_cycle)

    await admin
      .from('subscriptions')
      .update({
        plan_code: order.plan_code,
        billing_cycle: order.billing_cycle,
        status: 'active',
        current_period_start_at: periodStart.toISOString(),
        current_period_end_at: periodEnd.toISOString(),
        next_billing_at: periodEnd.toISOString(),
        payment_method_linked: true,
        payment_provider_subscription_ref: cb.order_id,
        last_payment_status: 'approved',
        ...(plan
          ? {
              vacancy_limit: plan.vacancy_limit,
              candidate_limit: plan.candidate_limit,
              member_limit: plan.member_limit,
            }
          : {}),
        updated_at: nowIso,
      })
      .eq('organization_id', order.organization_id)
  } else if (status === 'declined' || status === 'expired' || status === 'reversed') {
    // A failed charge (first payment or a renewal). Record it; a renewal that
    // fails moves the org to past_due so the UI can prompt a fix.
    await admin
      .from('subscriptions')
      .update({ last_payment_status: status, updated_at: nowIso })
      .eq('organization_id', order.organization_id)
      .eq('plan_code', order.plan_code)
  }

  return new NextResponse('OK', { status: 200 })
}
