import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const rpcMock = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: rpcMock }),
}))

import { GET } from '@/app/api/cron/expire-vacancies/route'

const SECRET = 'test-cron-secret-1234567890'
const ORIGINAL_SECRET = process.env.CRON_SECRET

function makeReq(authHeader?: string): NextRequest {
  const headers = new Headers()
  if (authHeader !== undefined) headers.set('authorization', authHeader)
  return new NextRequest('http://localhost/api/cron/expire-vacancies', { headers })
}

describe('GET /api/cron/expire-vacancies', () => {
  beforeEach(() => {
    rpcMock.mockReset()
    process.env.CRON_SECRET = SECRET
  })

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = ORIGINAL_SECRET
  })

  it('returns 200 + invokes the RPC when the Bearer token matches', async () => {
    rpcMock.mockResolvedValue({ error: null })

    const res = await GET(makeReq(`Bearer ${SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(typeof body.ran_at).toBe('string')
    expect(rpcMock).toHaveBeenCalledWith('expire_past_vacancies')
  })

  it('returns 401 when the Authorization header is missing', async () => {
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('returns 401 when the Bearer token is wrong', async () => {
    const res = await GET(makeReq('Bearer wrong-secret-of-same-length-1'))
    expect(res.status).toBe(401)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('returns 401 when the Bearer token differs only in length', async () => {
    // Same prefix, different length → timingSafeEqual would throw, route catches it
    const res = await GET(makeReq(`Bearer ${SECRET}x`))
    expect(res.status).toBe(401)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('returns 401 when CRON_SECRET is not set', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(makeReq(`Bearer ${SECRET}`))
    expect(res.status).toBe(401)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('returns 500 when the RPC fails', async () => {
    rpcMock.mockResolvedValue({ error: { message: 'db kaboom' } })
    const res = await GET(makeReq(`Bearer ${SECRET}`))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })
})
