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
  | { kind: 'refund' }
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
    case 'reversed':
      return { kind: 'refund' }
    default:
      return { kind: 'record' }
  }
}
