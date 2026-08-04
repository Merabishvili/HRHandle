/**
 * Pure callback normalization — no env, no SDK, no I/O (so it's unit-testable in
 * isolation and safe to import anywhere). Signature verification lives in
 * lib/flitt/client.ts (`verifyCallback`), which needs the secret.
 */
import type { FlittCallback } from './types'

/**
 * Flatten a raw callback body to the payment fields we act on. Handles the
 * protocol-2.0 shape (`{ version:'2.0', data:<base64> }`) by decoding, and the
 * flat 1.0 shape directly. Returns null if neither yields an order.
 *
 * Call ONLY after the signature has been verified — this does no checking.
 */
export function normalizeCallback(body: Record<string, unknown>): FlittCallback | null {
  if (body.version === '2.0' && typeof body.data === 'string') {
    try {
      const decoded = JSON.parse(Buffer.from(body.data, 'base64').toString('utf8')) as {
        order?: FlittCallback
      } & FlittCallback
      const order = decoded.order ?? decoded
      return order?.order_id ? order : null
    } catch {
      return null
    }
  }
  if (typeof body.order_id === 'string' && typeof body.order_status === 'string') {
    return body as unknown as FlittCallback
  }
  return null
}
