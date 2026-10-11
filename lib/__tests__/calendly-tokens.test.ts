import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/calendly/oauth', () => ({ refreshAccessToken: vi.fn() }))

import { isTokenExpired } from '@/lib/calendly/tokens'

describe('isTokenExpired', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-10T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('treats a token without an expiry as expired', () => {
    expect(isTokenExpired(null)).toBe(true)
  })

  it('keeps a token that is valid for more than a minute', () => {
    expect(isTokenExpired('2026-10-10T13:00:00Z')).toBe(false)
  })

  it('refreshes a token that runs out within the minute of skew', () => {
    expect(isTokenExpired('2026-10-10T12:00:30Z')).toBe(true)
    expect(isTokenExpired('2026-10-10T11:00:00Z')).toBe(true)
  })
})
