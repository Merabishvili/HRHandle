import { describe, it, expect } from 'vitest'
import { parsePeriod, periodToRange, DEFAULT_PERIOD, isPeriod, PERIODS } from '@/lib/reports/period'

describe('parsePeriod', () => {
  it('returns the default for unknown / missing values', () => {
    expect(parsePeriod(undefined)).toBe(DEFAULT_PERIOD)
    expect(parsePeriod(null)).toBe(DEFAULT_PERIOD)
    expect(parsePeriod('')).toBe(DEFAULT_PERIOD)
    expect(parsePeriod('garbage')).toBe(DEFAULT_PERIOD)
  })

  it('accepts every declared period', () => {
    for (const p of PERIODS) {
      expect(parsePeriod(p)).toBe(p)
    }
  })

  it('is type-safe via isPeriod', () => {
    expect(isPeriod('30d')).toBe(true)
    expect(isPeriod('bogus')).toBe(false)
    expect(isPeriod(null)).toBe(false)
  })
})

describe('periodToRange', () => {
  const now = new Date('2026-06-22T12:00:00Z')

  it('returns start=null for "all"', () => {
    expect(periodToRange('all', now).start).toBe(null)
    expect(periodToRange('all', now).end).toEqual(now)
  })

  it('returns the correct window for 7d / 30d / 90d / 365d', () => {
    const seven = periodToRange('7d', now)
    expect(seven.end).toEqual(now)
    expect(now.getTime() - (seven.start as Date).getTime()).toBe(7 * 24 * 60 * 60 * 1000)

    const ninety = periodToRange('90d', now)
    expect(now.getTime() - (ninety.start as Date).getTime()).toBe(90 * 24 * 60 * 60 * 1000)

    const year = periodToRange('365d', now)
    expect(now.getTime() - (year.start as Date).getTime()).toBe(365 * 24 * 60 * 60 * 1000)
  })

  it('uses Date.now() by default when no time provided', () => {
    const before = Date.now()
    const r = periodToRange('30d')
    const after = Date.now()
    expect(r.end.getTime()).toBeGreaterThanOrEqual(before)
    expect(r.end.getTime()).toBeLessThanOrEqual(after)
  })
})
