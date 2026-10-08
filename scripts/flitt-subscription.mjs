#!/usr/bin/env node
/**
 * Stop (or restart) Flitt subscriptions by order ID and print Flitt's reply.
 *
 * The Flitt portal doesn't show whether a subscription is on or off, so this is
 * how to check: stopping an already-stopped subscription is harmless, so
 * `stop` doubles as a status check.
 *
 *   FLITT_MERCHANT_ID=4056901 FLITT_SECRET_KEY=<payment key> \
 *     node scripts/flitt-subscription.mjs stop <order_id> [<order_id> …]
 *
 * Pass the key inline like this — never commit it or put it in a file. Uses the
 * same SDK call as the app's cancel (lib/flitt/client.ts → stopSubscription).
 */
import FlittPay from '@flittpayments/flitt-node-js-sdk'

const [action, ...orderIds] = process.argv.slice(2)
const merchantId = Number(process.env.FLITT_MERCHANT_ID)
const secretKey = process.env.FLITT_SECRET_KEY

if (!['stop', 'start'].includes(action) || orderIds.length === 0) {
  console.error('Usage: node scripts/flitt-subscription.mjs <stop|start> <order_id> [<order_id> …]')
  process.exit(1)
}
if (!merchantId || !secretKey) {
  console.error('Set FLITT_MERCHANT_ID (numeric) and FLITT_SECRET_KEY (the payment key) for this run.')
  process.exit(1)
}

let failed = 0
for (const orderId of orderIds) {
  // Fresh client per call — the SDK mutates its protocol on some calls.
  const flitt = new FlittPay({ merchantId, secretKey })
  try {
    const reply = await flitt.SubscriptionActions({ order_id: orderId, action })
    console.log(`${orderId}: response_status=${reply?.response_status} status=${reply?.status}`)
  } catch (err) {
    failed++
    const r = err?.response
    console.log(
      `${orderId}: FAILED${r ? ` error_code=${r.error_code} error_message=${r.error_message}` : ` ${err?.message}`}`,
    )
  }
}
process.exit(failed ? 1 : 0)
