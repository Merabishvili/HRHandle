/**
 * Flitt callback → subscription decision. Pure — no env, no SDK, no I/O — so
 * every branch (first payment, retry, renewal, decline, refund, tamper) is
 * unit-testable. The callback route does the lookups and writes.
 *
 * Renewal shape is not documented reliably, so both are handled:
 *  - **same order_id** as the first charge: a callback whose status or
 *    payment_id differs from what we stored is a new event (an `approved` on an
 *    already-approved order = renewal); an identical one is a retry.
 *  - **new order_id** derived from ours (`parent_order_id`, or our order id as
 *    a prefix): the route records it as its own `payment_orders` row (UNIQUE
 *    order_id makes retries idempotent) and it is always treated as a renewal.
 */
import type { FlittCallback } from './types'
import { PRICING_PLANS } from '@/lib/types/subscription'

/** Our order ids: `hrh_<12 hex>_<plan>_<cycle>_<epoch ms>` (lib/actions/billing.ts). */
const ORDER_ID_PREFIX_RE = /^hrh_[0-9a-f]{12}_(?:individual|organization)_(?:monthly|annual)_\d+/

/** The stored `payment_orders` fields the decision needs. */
export interface StoredOrder {
  order_id: string
  billing_cycle: string
  currency: string
  amount_minor: number
  status: string
  flitt_payment_id: string | null
}

export type CallbackDecision =
  | { kind: 'ignore'; reason: 'duplicate' | 'tamper' }
  | { kind: 'activate'; renewal: boolean; periodStart: Date; periodEnd: Date }
  | { kind: 'past_due' }
  /** `full` → the whole charge was refunded: end the plan (decision 2026-10-09). */
  | { kind: 'refund'; full: boolean }
  | { kind: 'record' }

/**
 * If this callback is a renewal reported under a NEW order id, return the
 * original (root) order id; otherwise null.
 */
export function findParentOrderId(cb: Pick<FlittCallback, 'order_id'> & { parent_order_id?: unknown }): string | null {
  const parent = typeof cb.parent_order_id === 'string' ? cb.parent_order_id.trim() : ''
  if (parent && parent !== cb.order_id) return parent
  const match = cb.order_id.match(ORDER_ID_PREFIX_RE)
  if (match && match[0] !== cb.order_id) return match[0]
  return null
}

/** Advance a date by one billing period (annual → +1 year, else +1 month). */
export function addPeriod(from: Date, cycle: string): Date {
  const d = new Date(from)
  if (cycle === 'annual') d.setUTCFullYear(d.getUTCFullYear() + 1)
  else d.setUTCMonth(d.getUTCMonth() + 1)
  return d
}

/** Flitt sends payment_id as a number or a string — compare as strings. */
export function paymentIdOf(cb: Pick<FlittCallback, 'payment_id'>): string | null {
  return cb.payment_id === undefined || cb.payment_id === null || cb.payment_id === ''
    ? null
    : String(cb.payment_id)
}

export function decideCallback(input: {
  order: StoredOrder
  cb: FlittCallback
  /** True when the callback arrived under a new order id derived from ours. */
  isChildOrder: boolean
  /** The subscription's current period end (null when none). */
  currentPeriodEnd: Date | null
  now: Date
}): CallbackDecision {
  const { order, cb, isChildOrder, currentPeriodEnd, now } = input

  // Anti-tamper — the signed amount/currency must match what we recorded.
  if (
    Number(cb.amount) !== order.amount_minor ||
    String(cb.currency).toUpperCase() !== order.currency
  ) {
    return { kind: 'ignore', reason: 'tamper' }
  }

  // Refund — `amount` stays the original charge; `reversal_amount` is what was
  // refunded. Checked before the retry dedupe: a partial refund keeps the
  // `approved` status + payment id. Not deduped — ending a plan twice is
  // idempotent.
  const reversal = Number(cb.reversal_amount ?? 0) || 0
  if (cb.order_status === 'reversed' || reversal > 0) {
    const full = reversal > 0 ? reversal >= order.amount_minor : cb.order_status === 'reversed'
    return { kind: 'refund', full }
  }

  // Retry of an event we already applied — same status + same payment.
  if (order.status === cb.order_status && paymentIdOf(cb) === order.flitt_payment_id) {
    return { kind: 'ignore', reason: 'duplicate' }
  }

  const renewal = isChildOrder || order.status === 'approved'

  switch (cb.order_status) {
    case 'approved': {
      // A renewal continues from the current period end (paying early never
      // loses days); a first payment — or a lapsed one — starts now.
      const periodStart =
        renewal && currentPeriodEnd && currentPeriodEnd > now ? currentPeriodEnd : now
      return { kind: 'activate', renewal, periodStart, periodEnd: addPeriod(periodStart, order.billing_cycle) }
    }
    case 'declined':
      return renewal ? { kind: 'past_due' } : { kind: 'record' }
    default:
      return { kind: 'record' }
  }
}

/**
 * Did Flitt confirm a subscription `stop`? Its /api/subscription reply carries
 * `response_status` + the subscription's `status` (docs show `active` after a
 * `start`). Anything but a success that leaves it `active` is not a confirmed
 * stop.
 */
export function isStopConfirmed(reply: Record<string, unknown> | null | undefined): boolean {
  if (!reply || reply.response_status !== 'success') return false
  return String(reply.status ?? '').toLowerCase() !== 'active'
}

/**
 * `subscriptions` update for a **full refund** (decisions 2026-10-09). If the
 * org's 7-day trial hasn't run out — it bought during the trial — it goes back
 * to the trial for the remaining days (same plan/limits as onboarding).
 * Otherwise the plan ends: `expired` → locked, and the org can buy again.
 */
export function refundedSubscriptionUpdate(
  trialEndAt: string | null,
  now: Date,
): { outcome: 'trial' | 'ended'; update: Record<string, unknown> } {
  const nowIso = now.toISOString()
  if (trialEndAt && new Date(trialEndAt) > now) {
    const trial = PRICING_PLANS.find((p) => p.code === 'trial')
    return {
      outcome: 'trial',
      update: {
        plan_code: 'trial',
        billing_cycle: null,
        status: 'trial',
        current_period_start_at: null,
        current_period_end_at: null,
        next_billing_at: null,
        payment_method_linked: false,
        last_payment_status: 'reversed',
        ...(trial
          ? {
              vacancy_limit: trial.vacancy_limit,
              candidate_limit: trial.candidate_limit,
              member_limit: trial.member_limit,
            }
          : {}),
        updated_at: nowIso,
      },
    }
  }
  return {
    outcome: 'ended',
    update: {
      status: 'expired',
      current_period_end_at: nowIso,
      next_billing_at: null,
      last_payment_status: 'reversed',
      updated_at: nowIso,
    },
  }
}
