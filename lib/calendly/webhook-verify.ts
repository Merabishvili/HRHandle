import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verify a Calendly webhook signature.
 *
 * Calendly sends `Calendly-Webhook-Signature: t=<unix_ts>,v1=<hex>`.
 * The signature is HMAC-SHA256(signing_key, `${t}.${rawBody}`).
 *
 * We reject signatures more than 5 minutes off the current clock to mitigate
 * replay attacks. The clock window is generous — Calendly's docs show ~3
 * minute drift in practice from their queue.
 */
export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60

export interface VerifyInput {
  header: string | null | undefined
  rawBody: string
  signingKey: string
  now?: number // unix seconds, defaults to Date.now()/1000
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: string }

export function verifyCalendlySignature({ header, rawBody, signingKey, now }: VerifyInput): VerifyResult {
  if (!header) return { ok: false, reason: 'Missing signature header' }
  const parts = header.split(',').map((s) => s.trim())
  let t: string | null = null
  let v1: string | null = null
  for (const p of parts) {
    if (p.startsWith('t=')) t = p.slice(2)
    else if (p.startsWith('v1=')) v1 = p.slice(3)
  }
  if (!t || !v1) return { ok: false, reason: 'Malformed signature header' }

  const tNum = Number.parseInt(t, 10)
  if (!Number.isFinite(tNum)) return { ok: false, reason: 'Bad timestamp' }
  const nowSec = now ?? Math.floor(Date.now() / 1000)
  if (Math.abs(nowSec - tNum) > SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, reason: 'Signature timestamp out of tolerance' }
  }

  const expected = createHmac('sha256', signingKey).update(`${t}.${rawBody}`).digest('hex')
  // Constant-time compare — guard against length mismatch (timingSafeEqual throws on different lengths).
  if (expected.length !== v1.length) return { ok: false, reason: 'Signature mismatch' }
  try {
    if (!timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'))) {
      return { ok: false, reason: 'Signature mismatch' }
    }
  } catch {
    return { ok: false, reason: 'Signature mismatch' }
  }
  return { ok: true }
}
