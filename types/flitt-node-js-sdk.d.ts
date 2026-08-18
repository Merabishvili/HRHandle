/**
 * Ambient types for the official Flitt Node SDK.
 *
 * The package ships a `.d.ts`, but it declares the module as
 * `"flitt-node-js-sdk"` (unscoped) while the real package is
 * `@flittpayments/flitt-node-js-sdk` — so TypeScript never picks it up. This
 * declaration maps the correctly-scoped name to the subset of the SDK we use.
 *
 * The SDK is dependency-free (Node `crypto`/`https`/`querystring` only) and
 * signs requests + verifies callbacks internally — see lib/flitt/client.ts.
 */
declare module '@flittpayments/flitt-node-js-sdk' {
  export interface FlittPayOptions {
    protocol?: string
    merchantId: number
    baseUrl?: string
    secretKey: string
    creditKey?: string
    contentType?: string
    timeout?: number
  }

  export default class FlittPay {
    constructor(options: FlittPayOptions)
    getOrderId(): string
    /** Verify a server callback's signature (handles protocol 1.0 + 2.0). */
    isValidResponse(data: Record<string, unknown>, credit?: boolean): boolean
    /** One-time hosted checkout (protocol 1.0). */
    Checkout(data: Record<string, unknown>): Promise<Record<string, unknown>>
    /** Recurring hosted checkout (protocol 2.0 — safe for nested recurring_data). */
    Subscription(data: Record<string, unknown>): Promise<Record<string, unknown>>
    /** Subscription control, e.g. { order_id, action: 'stop' }. */
    SubscriptionActions(data: Record<string, unknown>): Promise<Record<string, unknown>>
    Status(data: Record<string, unknown>): Promise<Record<string, unknown>>
    Reverse(data: Record<string, unknown>): Promise<Record<string, unknown>>
  }
}
