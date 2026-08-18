import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifyCalendlySignature } from '@/lib/calendly/webhook-verify'

function sign(body: string, key: string, t: number): string {
  return createHmac('sha256', key).update(`${t}.${body}`).digest('hex')
}

describe('verifyCalendlySignature', () => {
  const key = 'test-signing-key'
  const body = '{"event":"invitee.created"}'

  it('returns ok=true for a valid signature within tolerance', () => {
    const t = Math.floor(Date.now() / 1000)
    const sig = sign(body, key, t)
    const res = verifyCalendlySignature({
      header: `t=${t},v1=${sig}`,
      rawBody: body,
      signingKey: key,
    })
    expect(res.ok).toBe(true)
  })

  it('rejects when header missing', () => {
    const res = verifyCalendlySignature({ header: null, rawBody: body, signingKey: key })
    expect(res.ok).toBe(false)
  })

  it('rejects malformed header', () => {
    const res = verifyCalendlySignature({ header: 'garbage', rawBody: body, signingKey: key })
    expect(res.ok).toBe(false)
  })

  it('rejects when signature is wrong', () => {
    const t = Math.floor(Date.now() / 1000)
    const res = verifyCalendlySignature({
      header: `t=${t},v1=${'0'.repeat(64)}`,
      rawBody: body,
      signingKey: key,
    })
    expect(res.ok).toBe(false)
  })

  it('rejects out-of-tolerance timestamp', () => {
    const longAgo = Math.floor(Date.now() / 1000) - 60 * 60 // 1h old
    const sig = sign(body, key, longAgo)
    const res = verifyCalendlySignature({
      header: `t=${longAgo},v1=${sig}`,
      rawBody: body,
      signingKey: key,
    })
    expect(res.ok).toBe(false)
  })

  it('rejects when raw body has been tampered with', () => {
    const t = Math.floor(Date.now() / 1000)
    const sig = sign(body, key, t)
    const res = verifyCalendlySignature({
      header: `t=${t},v1=${sig}`,
      rawBody: body + 'tampered',
      signingKey: key,
    })
    expect(res.ok).toBe(false)
  })

  it('rejects when signing key is wrong', () => {
    const t = Math.floor(Date.now() / 1000)
    const sig = sign(body, 'wrong-key', t)
    const res = verifyCalendlySignature({
      header: `t=${t},v1=${sig}`,
      rawBody: body,
      signingKey: key,
    })
    expect(res.ok).toBe(false)
  })
})
