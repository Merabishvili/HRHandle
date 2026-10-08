import { describe, it, expect } from 'vitest'
import { buildRecurringData } from '../recurring'

// 2026-10-08 20:53 UTC = 2026-10-09 00:53 in Tbilisi (UTC+4) — the moment the
// 2008 decline was reproduced: UTC and the merchant calendar disagree.
const LATE_NIGHT = new Date('2026-10-08T20:53:00Z')

describe('buildRecurringData', () => {
  it('starts the schedule at the next billing date in Tbilisi time (not UTC)', () => {
    const monthly = buildRecurringData({ every: 1, period: 'month', amountMinor: 4900, now: LATE_NIGHT })
    expect(monthly.start_time).toBe('2026-11-09')
    expect(monthly.end_time).toBe('2036-11-09')

    const annual = buildRecurringData({ every: 12, period: 'month', amountMinor: 47000, now: LATE_NIGHT })
    expect(annual.start_time).toBe('2027-10-09')
    expect(annual.end_time).toBe('2037-10-09')
  })

  it('never sends a start date in the past, even after a one-day shift', () => {
    const data = buildRecurringData({ every: 1, period: 'month', amountMinor: 4900, now: LATE_NIGHT })
    const shifted = new Date(`${data.start_time as string}T00:00:00Z`).getTime() - 24 * 60 * 60 * 1000
    expect(shifted).toBeGreaterThan(LATE_NIGHT.getTime())
  })

  it('clamps month-end dates (Jan 31 + 1 month → Feb 28)', () => {
    const data = buildRecurringData({
      every: 1,
      period: 'month',
      amountMinor: 4900,
      now: new Date('2027-01-31T10:00:00Z'),
    })
    expect(data.start_time).toBe('2027-02-28')
  })

  it('sends end_time instead of quantity, and locks auto-renew on checkout', () => {
    const data = buildRecurringData({ every: 1, period: 'month', amountMinor: 4900, now: LATE_NIGHT })
    expect(data).not.toHaveProperty('quantity')
    expect(data).toMatchObject({ every: 1, period: 'month', amount: 4900, state: 'shown_readonly' })
  })

  it('honours an explicit start date', () => {
    const data = buildRecurringData({ every: 1, period: 'month', amountMinor: 1, startDate: '2026-12-01' })
    expect(data.start_time).toBe('2026-12-01')
    expect(data.end_time).toBe('2036-12-01')
  })
})
