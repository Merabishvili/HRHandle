import { describe, it, expect } from 'vitest'
import { isOfferExpired } from '@/lib/offers/expiry'

describe('isOfferExpired', () => {
  it('returns false when expiryDate is null/undefined', () => {
    const today = new Date('2026-07-15T12:00:00Z')
    expect(isOfferExpired(null, today)).toBe(false)
    expect(isOfferExpired(undefined, today)).toBe(false)
  })

  it('returns true when the expiry is strictly before today (string input)', () => {
    const today = new Date('2026-07-15T12:00:00Z')
    expect(isOfferExpired('2026-07-14', today)).toBe(true)
    expect(isOfferExpired('2025-12-31', today)).toBe(true)
  })

  it('returns false when the expiry is today or later (string input)', () => {
    const today = new Date('2026-07-15T12:00:00Z')
    expect(isOfferExpired('2026-07-15', today)).toBe(false)
    expect(isOfferExpired('2026-07-16', today)).toBe(false)
    expect(isOfferExpired('2027-01-01', today)).toBe(false)
  })

  it('compares calendar dates, not timestamps (TZ-stable)', () => {
    // Postgres DATE comes back as YYYY-MM-DD; that's what the recruiter and
    // candidate both see. We must not turn the comparison into something the
    // timezone of the runtime can flip.
    const lateNight = new Date('2026-07-15T23:59:00Z')
    expect(isOfferExpired('2026-07-15', lateNight)).toBe(false)
    const earlyNext = new Date('2026-07-16T00:01:00Z')
    expect(isOfferExpired('2026-07-15', earlyNext)).toBe(true)
  })

  it('accepts a Date object as expiryDate', () => {
    const today = new Date('2026-07-15T12:00:00Z')
    expect(isOfferExpired(new Date('2026-07-14T00:00:00Z'), today)).toBe(true)
    expect(isOfferExpired(new Date('2026-07-15T00:00:00Z'), today)).toBe(false)
    expect(isOfferExpired(new Date('2026-07-16T00:00:00Z'), today)).toBe(false)
  })

  it('ignores time portion when the database returns an ISO timestamp string', () => {
    // Postgres `DATE` is usually returned as YYYY-MM-DD but a join with
    // CURRENT_TIMESTAMP-derived columns might come back longer. Slice the
    // first 10 chars to stay date-only.
    const today = new Date('2026-07-15T12:00:00Z')
    expect(isOfferExpired('2026-07-14T08:00:00Z', today)).toBe(true)
    expect(isOfferExpired('2026-07-15T08:00:00Z', today)).toBe(false)
  })
})
