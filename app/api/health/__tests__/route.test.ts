import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the admin client. The factory must capture no outer state, so each test
// overrides the mock implementation as needed.
const fromMock = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: fromMock }),
}))

import { GET } from '@/app/api/health/route'

describe('GET /api/health', () => {
  beforeEach(() => {
    fromMock.mockReset()
  })

  it('returns 200 + status="ok" when the DB query succeeds', async () => {
    fromMock.mockReturnValue({
      select: () => ({
        limit: () => Promise.resolve({ data: [], error: null }),
      }),
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.checks.database).toBe('ok')
    expect(typeof body.timestamp).toBe('string')
  })

  it('returns 503 + status="degraded" when the DB query reports an error', async () => {
    fromMock.mockReturnValue({
      select: () => ({
        limit: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
      }),
    })

    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.status).toBe('degraded')
    expect(body.checks.database).toBe('error')
  })

  it('returns 503 when the DB client throws', async () => {
    fromMock.mockImplementation(() => {
      throw new Error('connection refused')
    })

    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.checks.database).toBe('error')
  })

  it('queries the organizations table for connectivity', async () => {
    const select = vi.fn().mockReturnValue({
      limit: () => Promise.resolve({ data: [], error: null }),
    })
    fromMock.mockReturnValue({ select })

    await GET()
    expect(fromMock).toHaveBeenCalledWith('organizations')
    expect(select).toHaveBeenCalledWith('id')
  })
})
