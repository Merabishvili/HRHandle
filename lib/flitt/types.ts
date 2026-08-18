/**
 * Flitt payment gateway — shared domain types.
 *
 * These describe the server-to-server callback Flitt POSTs to our
 * `server_callback_url` after every charge (first payment + each recurring
 * cycle). See lib/flitt/client.ts for signature verification + normalization.
 */

/** Terminal + interim states Flitt reports on `order_status`. */
export type FlittOrderStatus =
  | 'created'
  | 'processing'
  | 'declined'
  | 'approved'
  | 'expired'
  | 'reversed'
  | 'captured'

/** Currencies we charge in (Flitt merchant must be enabled for each). */
export type FlittCurrency = 'GEL' | 'EUR' | 'USD'

/**
 * Normalized callback payload. Flitt sends amounts in the **minor unit**
 * (tetri / cents) as strings; `merchant_data` carries our own JSON for
 * correlation. Extra fields (card data, settlement, rrn…) are preserved via the
 * index signature but not typed — we only act on the ones below.
 */
export interface FlittCallback {
  order_id: string
  order_status: FlittOrderStatus
  amount: string
  currency: string
  merchant_id: string | number
  payment_id?: string
  response_status?: string
  /** Recurring token — present once the card is tokenized for auto-renewal. */
  rectoken?: string
  rectoken_lifetime?: string
  merchant_data?: string
  masked_card?: string
  [key: string]: unknown
}
