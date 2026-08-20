import { createHmac, timingSafeEqual } from 'crypto'

/**
 * The `encryptedToken` Zoom expects back for its endpoint URL-validation (CRC)
 * challenge: HMAC-SHA256 of the plainToken, keyed by the app's Secret Token,
 * hex-encoded.
 */
export function zoomCrcEncryptedToken(plainToken: string, secret: string): string {
  return createHmac('sha256', secret).update(plainToken).digest('hex')
}

/**
 * Verify a Zoom webhook signature. Zoom sends
 *   x-zm-signature: "v0=" + HMAC-SHA256("v0:<timestamp>:<rawBody>", secret)
 * Constant-time compare; returns false on any mismatch.
 */
export function verifyZoomSignature(
  rawBody: string,
  timestamp: string,
  signature: string,
  secret: string,
): boolean {
  const expected = `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
