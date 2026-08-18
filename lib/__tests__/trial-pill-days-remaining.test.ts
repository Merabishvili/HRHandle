import { describe, it, expect } from 'vitest'
import { daysRemaining } from '@/components/dashboard/trial-pill'

const MS_PER_DAY = 1000 * 60 * 60 * 24

describe('daysRemaining', () => {
  const now = new Date('2026-06-15T12:00:00Z').getTime()

  it('returns 7 for a trial ending in 7 full days', () => {
    const end = new Date(now + 7 * MS_PER_DAY).toISOString()
    expect(daysRemaining(end, now)).toBe(7)
  })

  it('rounds partial days up (1.5 days remaining → 2)', () => {
    const end = new Date(now + 1.5 * MS_PER_DAY).toISOString()
    expect(daysRemaining(end, now)).toBe(2)
  })

  it('returns 1 for less than a day remaining', () => {
    const end = new Date(now + 2 * 60 * 60 * 1000).toISOString() // 2 hours
    expect(daysRemaining(end, now)).toBe(1)
  })

  it('returns 0 exactly at expiry', () => {
    const end = new Date(now).toISOString()
    expect(daysRemaining(end, now)).toBe(0)
  })

  it('clamps to 0 for past-due trials (no negative readings)', () => {
    const end = new Date(now - 3 * MS_PER_DAY).toISOString()
    expect(daysRemaining(end, now)).toBe(0)
  })

  it('reads Date.now() when no override is supplied', () => {
    // Hard to make this deterministic without mocking; just confirm the
    // function runs and returns a number for a far-future timestamp.
    const end = new Date(Date.now() + 30 * MS_PER_DAY).toISOString()
    const result = daysRemaining(end)
    expect(result).toBeGreaterThan(28)
    expect(result).toBeLessThanOrEqual(30)
  })
})
