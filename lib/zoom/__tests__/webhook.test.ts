import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { zoomCrcEncryptedToken, verifyZoomSignature } from '@/lib/zoom/webhook'

const SECRET = 'test-secret-token'

describe('zoomCrcEncryptedToken', () => {
  it('is HMAC-SHA256(plainToken, secret) hex — matches Zoom’s CRC formula', () => {
    const plain = 'abc123'
    const expected = createHmac('sha256', SECRET).update(plain).digest('hex')
    expect(zoomCrcEncryptedToken(plain, SECRET)).toBe(expected)
  })
})

describe('verifyZoomSignature', () => {
  const raw = JSON.stringify({ event: 'app_deauthorized', payload: { user_id: 'u1' } })
  const ts = '1700000000'
  const validSig = `v0=${createHmac('sha256', SECRET).update(`v0:${ts}:${raw}`).digest('hex')}`

  it('accepts a correctly signed request', () => {
    expect(verifyZoomSignature(raw, ts, validSig, SECRET)).toBe(true)
  })

  it('rejects a tampered body', () => {
    expect(verifyZoomSignature(raw + 'x', ts, validSig, SECRET)).toBe(false)
  })

  it('rejects a wrong timestamp', () => {
    expect(verifyZoomSignature(raw, '1700000001', validSig, SECRET)).toBe(false)
  })

  it('rejects a wrong secret', () => {
    expect(verifyZoomSignature(raw, ts, validSig, 'other-secret')).toBe(false)
  })

  it('rejects an empty / malformed signature without throwing', () => {
    expect(verifyZoomSignature(raw, ts, '', SECRET)).toBe(false)
    expect(verifyZoomSignature(raw, ts, 'garbage', SECRET)).toBe(false)
  })
})
