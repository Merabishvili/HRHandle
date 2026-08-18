import { describe, it, expect } from 'vitest'
import { isOfferExpired, offerCountdown } from '@/lib/offers/expiry'

const today = new Date('2026-06-30T12:00:00Z')

describe('isOfferExpired', () => {
  it('is false for a null/undefined expiry (open-ended)', () => {
    expect(isOfferExpired(null, today)).toBe(false)
    expect(isOfferExpired(undefined, today)).toBe(false)
  })
  it('is false when expiry is today (last valid day)', () => {
    expect(isOfferExpired('2026-06-30', today)).toBe(false)
  })
  it('is false when expiry is in the future', () => {
    expect(isOfferExpired('2026-07-01', today)).toBe(false)
  })
  it('is true when expiry was yesterday', () => {
    expect(isOfferExpired('2026-06-29', today)).toBe(true)
  })
  it('treats a full timestamp string as its date part (YMD-stable)', () => {
    expect(isOfferExpired('2026-06-29T23:59:59Z', today)).toBe(true)
    expect(isOfferExpired('2026-06-30T00:00:00Z', today)).toBe(false)
  })
  it('accepts a Date expiry', () => {
    expect(isOfferExpired(new Date('2026-06-29T00:00:00Z'), today)).toBe(true)
  })
})

describe('offerCountdown', () => {
  it('returns null for no expiry and for an already-expired offer', () => {
    expect(offerCountdown(null, today)).toBeNull()
    expect(offerCountdown('2026-06-29', today)).toBeNull()
  })
  it('says "Expires today" (urgent) when 0 days left', () => {
    expect(offerCountdown('2026-06-30', today)).toMatchObject({ daysLeft: 0, label: 'Expires today', urgency: 'urgent' })
  })
  it('says "1 day left" (urgent) at 1 day', () => {
    expect(offerCountdown('2026-07-01', today)).toMatchObject({ daysLeft: 1, label: '1 day left', urgency: 'urgent' })
  })
  it('is "soon" for 2..7 days', () => {
    expect(offerCountdown('2026-07-05', today)).toMatchObject({ daysLeft: 5, urgency: 'soon' })
    expect(offerCountdown('2026-07-07', today)).toMatchObject({ daysLeft: 7, urgency: 'soon' })
  })
  it('is "normal" beyond 7 days', () => {
    expect(offerCountdown('2026-07-15', today)).toMatchObject({ urgency: 'normal' })
  })
})
