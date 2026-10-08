import { describe, it, expect } from 'vitest'
import { buildRecurringData, RECURRING_HORIZON_YEARS } from '../recurring'

describe('buildRecurringData', () => {
  it('always sends quantity — Flitt requires quantity or end_time (else 2008)', () => {
    const monthly = buildRecurringData({ every: 1, period: 'month', amountMinor: 4900 })
    expect(monthly.quantity).toBe(12 * RECURRING_HORIZON_YEARS)

    const annual = buildRecurringData({ every: 12, period: 'month', amountMinor: 47000 })
    expect(annual.quantity).toBe(RECURRING_HORIZON_YEARS)
  })

  it('locks auto-renew on the checkout page and carries the charge amount', () => {
    const data = buildRecurringData({ every: 1, period: 'month', amountMinor: 4900 })
    expect(data).toMatchObject({ every: 1, period: 'month', amount: 4900, state: 'shown_readonly' })
  })

  it('omits start_time unless given (schedule anchors to the first approval)', () => {
    expect(buildRecurringData({ every: 1, period: 'month', amountMinor: 1 })).not.toHaveProperty('start_time')
    expect(
      buildRecurringData({ every: 1, period: 'month', amountMinor: 1, startDate: '2026-11-09' }).start_time,
    ).toBe('2026-11-09')
  })
})
