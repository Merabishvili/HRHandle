import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCallback, stopSubscription } from '@/lib/flitt/client'
import { normalizeCallback } from '@/lib/flitt/callback'
import {
  decideCallback,
  findParentOrderId,
  paymentIdOf,
  refundedSubscriptionUpdate,
} from '@/lib/flitt/lifecycle'
import { PRICING_PLANS } from '@/lib/types/subscription'
import { writeAuditLog } from '@/lib/audit-log'

// The Flitt SDK uses Node's `https`/`crypto`; keep this on the Node runtime.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ORDER_COLUMNS =
  'id, order_id, organization_id, plan_code, billing_cycle, currency, amount_minor, status, flitt_payment_id'

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
 * match the stored order (anti-tamper), then apply the decision from
 * `decideCallback` (lib/flitt/lifecycle.ts): activate / extend the period,
 * mark past_due on a failed renewal, end the plan on a full refund (flag a
 * partial one). Always ack with 200 once handled so Flitt stops retrying; a bad
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

  // 2) Correlate to our order. A renewal may arrive under a NEW order id
  // derived from ours — record it as its own row, copied from the root order.
  const parentOrderId = findParentOrderId(cb)
  const rootOrderId = parentOrderId ?? cb.order_id

  let { data: order } = await admin
    .from('payment_orders')
    .select(ORDER_COLUMNS)
    .eq('order_id', cb.order_id)
    .maybeSingle()

  if (!order && parentOrderId) {
    const { data: parent } = await admin
      .from('payment_orders')
      .select(ORDER_COLUMNS)
      .eq('order_id', parentOrderId)
      .maybeSingle()
    if (parent) {
      const { data: child, error: insErr } = await admin
        .from('payment_orders')
        .insert({
          organization_id: parent.organization_id,
          order_id: cb.order_id,
          plan_code: parent.plan_code,
          billing_cycle: parent.billing_cycle,
          currency: parent.currency,
          amount_minor: parent.amount_minor,
          status: 'pending',
        })
        .select(ORDER_COLUMNS)
        .single()
      if (insErr) {
        // Concurrent retry inserted it first — ack; Flitt's next retry dedupes.
        return new NextResponse('OK', { status: 200 })
      }
      order = child
    }
  }

  if (!order) {
    // Unknown order — ack so Flitt stops retrying, but record the anomaly.
    Sentry.captureMessage('[flitt/callback] unknown order_id', {
      level: 'warning',
      tags: { feature: 'flitt_callback' },
      extra: { order_id: cb.order_id },
    })
    return new NextResponse('OK', { status: 200 })
  }

  const { data: sub } = await admin
    .from('subscriptions')
    .select('current_period_end_at, payment_provider_subscription_ref, trial_end_at')
    .eq('organization_id', order.organization_id)
    .maybeSingle()
  const currentRef = (sub?.payment_provider_subscription_ref as string | null | undefined) ?? null

  const now = new Date()
  const decision = decideCallback({
    order,
    cb,
    isChildOrder: parentOrderId !== null,
    currentPeriodEnd: sub?.current_period_end_at ? new Date(sub.current_period_end_at) : null,
    now,
  })

  if (decision.kind === 'ignore') {
    if (decision.reason === 'tamper') {
      Sentry.captureMessage('[flitt/callback] amount/currency mismatch', {
        level: 'error',
        tags: { feature: 'flitt_callback' },
        extra: { order_id: cb.order_id, cb_amount: cb.amount, cb_currency: cb.currency },
      })
    }
    return new NextResponse('OK', { status: 200 })
  }

  const nowIso = now.toISOString()

  // 3) Reflect the latest status + provider ids on the order ledger.
  await admin
    .from('payment_orders')
    .update({
      status: cb.order_status,
      flitt_payment_id: paymentIdOf(cb),
      ...(cb.rectoken ? { flitt_rectoken: cb.rectoken as string } : {}),
      updated_at: nowIso,
    })
    .eq('id', order.id)

  // A renewal / failure for a recurring the org has since replaced (e.g. a
  // plan change whose old recurring we couldn't stop) must not touch the
  // current subscription. Stop it and flag it.
  const isStale =
    (decision.kind !== 'activate' || decision.renewal) &&
    currentRef !== null &&
    currentRef !== rootOrderId
  if (isStale && decision.kind !== 'record') {
    Sentry.captureMessage('[flitt/callback] event for a replaced recurring — stopping it', {
      level: 'warning',
      tags: { feature: 'flitt_callback' },
      extra: { order_id: cb.order_id, root: rootOrderId, current: currentRef, status: cb.order_status },
    })
    await stopSubscription(rootOrderId)
    return new NextResponse('OK', { status: 200 })
  }

  switch (decision.kind) {
    case 'activate': {
      const plan = PRICING_PLANS.find((p) => p.code === order.plan_code)
      await admin
        .from('subscriptions')
        .update({
          plan_code: order.plan_code,
          billing_cycle: order.billing_cycle,
          status: 'active',
          current_period_start_at: decision.periodStart.toISOString(),
          current_period_end_at: decision.periodEnd.toISOString(),
          next_billing_at: decision.periodEnd.toISOString(),
          payment_method_linked: true,
          payment_provider_subscription_ref: rootOrderId,
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

      // A new purchase replaces the old recurring (plan change, or re-paying
      // after a failed renewal) — stop the old one so the card isn't charged
      // twice.
      if (!decision.renewal && currentRef && currentRef !== rootOrderId) {
        const stopped = await stopSubscription(currentRef)
        if (!stopped.ok) {
          Sentry.captureMessage('[flitt/callback] could not stop the replaced recurring', {
            level: 'error',
            tags: { feature: 'flitt_callback' },
            extra: { old_ref: currentRef, new_ref: rootOrderId },
          })
        }
      }
      break
    }
    case 'past_due':
      // Failed renewal — the org keeps access for the grace period
      // (lib/billing/access.ts) and sees a payment-problem prompt.
      await admin
        .from('subscriptions')
        .update({ status: 'past_due', last_payment_status: cb.order_status, updated_at: nowIso })
        .eq('organization_id', order.organization_id)
      break
    case 'refund':
      if (decision.full) {
        // Full refund → the paid plan ends now (decision 2026-10-09): stop the
        // recurring at Flitt so the card isn't charged again, then either back
        // to the remaining trial or locked (`expired`; the org can buy again).
        const stopped = await stopSubscription(rootOrderId)
        const refunded = refundedSubscriptionUpdate(
          (sub?.trial_end_at as string | null | undefined) ?? null,
          now,
        )
        await admin
          .from('subscriptions')
          .update(refunded.update)
          .eq('organization_id', order.organization_id)
        const outcomeText = refunded.outcome === 'trial' ? 'back to trial' : 'plan ended'
        void writeAuditLog({
          orgId: order.organization_id,
          userId: null,
          entityType: 'organization',
          entityId: order.organization_id,
          action: 'billing_refunded',
          message: `Payment fully refunded — ${outcomeText}`,
          details: {
            orderId: cb.order_id,
            outcome: refunded.outcome,
            recurringStopped: stopped.ok,
            flittStatus: stopped.status ?? null,
          },
        })
        Sentry.captureMessage(`[flitt/callback] full refund — ${outcomeText}`, {
          // An unconfirmed stop means the card could be charged again — act on it.
          level: stopped.ok ? 'info' : 'error',
          tags: { feature: 'flitt_callback' },
          extra: { order_id: cb.order_id, organization_id: order.organization_id, flitt_status: stopped.status },
        })
      } else {
        // Partial refund — record + flag only; access unchanged.
        await admin
          .from('subscriptions')
          .update({ last_payment_status: 'partially_reversed', updated_at: nowIso })
          .eq('organization_id', order.organization_id)
        Sentry.captureMessage('[flitt/callback] partial refund — review access manually', {
          level: 'warning',
          tags: { feature: 'flitt_callback' },
          extra: { order_id: cb.order_id, organization_id: order.organization_id, reversal: cb.reversal_amount },
        })
      }
      break
    case 'record':
      // First-payment failure / interim state — the plan is unchanged.
      if (cb.order_status === 'declined' || cb.order_status === 'expired') {
        await admin
          .from('subscriptions')
          .update({ last_payment_status: cb.order_status, updated_at: nowIso })
          .eq('organization_id', order.organization_id)
      }
      break
  }

  return new NextResponse('OK', { status: 200 })
}
