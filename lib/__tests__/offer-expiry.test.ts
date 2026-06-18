import { describe, it, expect } from 'vitest'
import { isOfferExpired, offerCountdown } from '@/lib/offers/expiry'

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

describe('offerCountdown', () => {
  const today = new Date('2026-07-15T12:00:00Z')

  it('returns null when no expiry date is set', () => {
    expect(offerCountdown(null, today)).toBeNull()
    expect(offerCountdown(undefined, today)).toBeNull()
  })

  it('returns null when the offer is already expired', () => {
    expect(offerCountdown('2026-07-14', today)).toBeNull()
    expect(offerCountdown('2025-12-31', today)).toBeNull()
  })

  it('marks "Expires today" + urgent when daysLeft === 0', () => {
    const view = offerCountdown('2026-07-15', today)
    expect(view).not.toBeNull()
    expect(view?.daysLeft).toBe(0)
    expect(view?.urgency).toBe('urgent')
    expect(view?.label).toBe('Expires today')
  })

  it('marks "1 day left" + urgent when daysLeft === 1 (singular)', () => {
    const view = offerCountdown('2026-07-16', today)
    expect(view?.daysLeft).toBe(1)
    expect(view?.urgency).toBe('urgent')
    expect(view?.label).toBe('1 day left')
  })

  it('marks "N days left" + soon for daysLeft 2–7', () => {
    const view2 = offerCountdown('2026-07-17', today)
    expect(view2?.daysLeft).toBe(2)
    expect(view2?.urgency).toBe('soon')
    expect(view2?.label).toBe('2 days left')

    const view7 = offerCountdown('2026-07-22', today)
    expect(view7?.daysLeft).toBe(7)
    expect(view7?.urgency).toBe('soon')
    expect(view7?.label).toBe('7 days left')
  })

  it('marks "N days left" + normal for daysLeft > 7', () => {
    const view8 = offerCountdown('2026-07-23', today)
    expect(view8?.daysLeft).toBe(8)
    expect(view8?.urgency).toBe('normal')
    expect(view8?.label).toBe('8 days left')
  })

  it('is timezone-stable at the day boundary (same comparison as isOfferExpired)', () => {
    // 23:59 UTC vs 00:01 next-day UTC should give the same "days left" as
    // mid-day comparisons — both sides snap to YMD before diffing.
    const lateNight = new Date('2026-07-15T23:59:00Z')
    expect(offerCountdown('2026-07-15', lateNight)?.daysLeft).toBe(0)
    const earlyNext = new Date('2026-07-16T00:01:00Z')
    expect(offerCountdown('2026-07-15', earlyNext)).toBeNull()
  })

  it('accepts a Date object as expiryDate', () => {
    expect(offerCountdown(new Date('2026-07-22T00:00:00Z'), today)?.daysLeft).toBe(7)
    expect(offerCountdown(new Date('2026-07-15T00:00:00Z'), today)?.daysLeft).toBe(0)
  })

  it('ignores time portion of a longer ISO timestamp string', () => {
    expect(offerCountdown('2026-07-22T08:00:00Z', today)?.daysLeft).toBe(7)
  })
})
