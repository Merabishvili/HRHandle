import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import FlittPay from '@flittpayments/flitt-node-js-sdk'
import { normalizeCallback } from '@/lib/flitt/callback'

/**
 * Replicates the SDK's protocol-1.0 signature so we can forge a VALID callback
 * and assert `isValidResponse` accepts it (and rejects tampering / wrong
 * secret). This locks the callback contract the webhook route depends on —
 * without it a silent signature-format drift would let forged callbacks grant
 * plans, or reject real ones.
 */
function signV1(data: Record<string, unknown>, secret: string): string {
  const ordered: Record<string, unknown> = {}
  Object.keys(data)
    .sort()
    .forEach((k) => {
      if (data[k] !== '' && k !== 'signature' && k !== 'response_signature_string') {
        ordered[k] = data[k]
      }
    })
  return crypto
    .createHash('sha1')
    .update(secret + '|' + Object.values(ordered).join('|'))
    .digest('hex')
}

describe('Flitt callback signature contract', () => {
  const secret = 'test'
  const flitt = new FlittPay({ merchantId: 1549901, secretKey: secret })
  const base = {
    order_id: 'org123-individual-monthly-1700000000',
    order_status: 'approved',
    amount: '4900',
    currency: 'GEL',
    merchant_id: 1549901,
    payment_id: '999',
  }

  it('accepts a correctly signed callback', () => {
    const body = { ...base, signature: signV1(base, secret) }
    expect(flitt.isValidResponse(body)).toBe(true)
  })

  it('rejects a tampered amount', () => {
    const body: Record<string, unknown> = { ...base, signature: signV1(base, secret) }
    body.amount = '1' // tampered after signing
    expect(flitt.isValidResponse(body)).toBe(false)
  })

  it('rejects a signature made with the wrong secret', () => {
    const body = { ...base, signature: signV1(base, 'not-the-secret') }
    expect(flitt.isValidResponse(body)).toBe(false)
  })
})

describe('normalizeCallback', () => {
  it('passes through a flat protocol-1.0 callback', () => {
    const cb = normalizeCallback({
      order_id: 'o1',
      order_status: 'approved',
      amount: '4900',
      currency: 'GEL',
      merchant_id: 1,
    })
    expect(cb?.order_id).toBe('o1')
    expect(cb?.order_status).toBe('approved')
  })

  it('decodes a protocol-2.0 base64 callback', () => {
    const order = {
      order_id: 'o2',
      order_status: 'declined',
      amount: '9900',
      currency: 'EUR',
      merchant_id: 1,
    }
    const data = Buffer.from(JSON.stringify({ order })).toString('base64')
    const cb = normalizeCallback({ version: '2.0', data, signature: 'x' })
    expect(cb?.order_id).toBe('o2')
    expect(cb?.order_status).toBe('declined')
  })

  it('returns null for an unrecognizable body', () => {
    expect(normalizeCallback({ foo: 'bar' })).toBeNull()
  })
})
