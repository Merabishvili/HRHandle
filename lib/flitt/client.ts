/**
 * Flitt payment gateway client (thin wrapper over the official SDK).
 *
 * The SDK (`@flittpayments/flitt-node-js-sdk`) is dependency-free and handles
 * the two error-prone parts for us: signing requests (protocol 2.0 for
 * recurring, so nested `recurring_data` is signed correctly) and verifying
 * callback signatures (`isValidResponse`). We add: env-gated construction
 * (fail-soft when unconfigured), a hard timeout the SDK lacks, Sentry capture,
 * and callback normalization.
 *
 * Server-only — never import from a client component (reads FLITT_SECRET_KEY).
 */
import FlittPay from '@flittpayments/flitt-node-js-sdk'
import * as Sentry from '@sentry/nextjs'
import { env } from '@/lib/env'
import type { FlittCurrency } from './types'

export { normalizeCallback } from './callback'

const REQUEST_TIMEOUT_MS = 20_000

/** True when both merchant id + secret are present and the id is numeric. */
export function isFlittConfigured(): boolean {
  return (
    !!env.FLITT_MERCHANT_ID &&
    !!env.FLITT_SECRET_KEY &&
    !Number.isNaN(Number(env.FLITT_MERCHANT_ID))
  )
}

function getClient(): FlittPay | null {
  if (!isFlittConfigured()) return null
  return new FlittPay({
    merchantId: Number(env.FLITT_MERCHANT_ID),
    secretKey: env.FLITT_SECRET_KEY as string,
  })
}

/** Reject a hung SDK call — the SDK's own `timeout` option doesn't abort. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('flitt_timeout')), ms)),
  ])
}

export interface CheckoutParams {
  /** Our unique order id — also the correlation key on the callback. */
  orderId: string
  orderDesc: string
  /** Amount in the minor unit (tetri / cents). */
  amountMinor: number
  currency: FlittCurrency
  /** Where the browser lands after payment (our billing return page). */
  responseUrl: string
  /** Server-to-server callback endpoint (source of truth). */
  callbackUrl: string
  senderEmail?: string
  /** Stringified JSON echoed back on the callback for correlation. */
  merchantData?: string
  /** Recurring schedule — Flitt tokenizes on the first charge and auto-renews. */
  recurring: { every: number; period: 'day' | 'week' | 'month'; startDate?: string }
}

export type CheckoutResult =
  | { ok: true; checkoutUrl: string; paymentId?: string }
  | { ok: false; reason: 'not_configured' | 'timeout' | 'failed'; message?: string }

/**
 * Create a recurring hosted-checkout session. Flitt shows the card / Google Pay
 * / Apple Pay page, charges the first period, saves the card, and auto-charges
 * each subsequent cycle (firing a callback each time).
 */
export async function createSubscriptionCheckout(p: CheckoutParams): Promise<CheckoutResult> {
  const client = getClient()
  if (!client) return { ok: false, reason: 'not_configured' }

  const data: Record<string, unknown> = {
    order_id: p.orderId,
    order_desc: p.orderDesc,
    amount: p.amountMinor,
    currency: p.currency,
    response_url: p.responseUrl,
    server_callback_url: p.callbackUrl,
    ...(p.senderEmail ? { sender_email: p.senderEmail } : {}),
    ...(p.merchantData ? { merchant_data: p.merchantData } : {}),
    recurring_data: {
      every: p.recurring.every,
      period: p.recurring.period,
      amount: p.amountMinor,
      state: 'y',
      readonly: 'y',
      ...(p.recurring.startDate ? { start_time: p.recurring.startDate } : {}),
    },
  }

  try {
    const res = await withTimeout(client.Subscription(data), REQUEST_TIMEOUT_MS)
    const order = (res?.order as Record<string, unknown> | undefined) ?? res
    const checkoutUrl = order?.checkout_url as string | undefined
    if (!checkoutUrl) {
      Sentry.captureMessage('[flitt] checkout returned no checkout_url', {
        level: 'error',
        tags: { feature: 'flitt_checkout' },
      })
      return { ok: false, reason: 'failed', message: 'no checkout_url in response' }
    }
    const paymentId = order?.payment_id as string | undefined
    return { ok: true, checkoutUrl, ...(paymentId ? { paymentId } : {}) }
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: 'flitt_checkout' } })
    const timedOut = err instanceof Error && err.message === 'flitt_timeout'
    return { ok: false, reason: timedOut ? 'timeout' : 'failed', message: (err as Error)?.message }
  }
}

/** Stop future recurring charges for an order (Flitt keeps the paid period). */
export async function stopSubscription(orderId: string): Promise<{ ok: boolean }> {
  const client = getClient()
  if (!client) return { ok: false }
  try {
    await withTimeout(
      client.SubscriptionActions({ order_id: orderId, action: 'stop' }),
      REQUEST_TIMEOUT_MS,
    )
    return { ok: true }
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: 'flitt_subscription_stop' } })
    return { ok: false }
  }
}

/**
 * Verify a callback's signature against our secret. Pass the RAW parsed body
 * (with `signature` + any `version`/`data`) — the SDK handles both protocol 1.0
 * (flat) and 2.0 (base64) callbacks. Returns false when unconfigured or invalid.
 */
export function verifyCallback(body: Record<string, unknown>): boolean {
  const client = getClient()
  if (!client) return false
  try {
    return client.isValidResponse(body)
  } catch {
    return false
  }
}
