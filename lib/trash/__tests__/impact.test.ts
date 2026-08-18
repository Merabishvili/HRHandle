import { describe, it, expect } from 'vitest'
import { extractRestoreImpact, daysUntilPurge } from '@/lib/trash/impact'

describe('extractRestoreImpact', () => {
  it('returns the cascaded application ids from the audit details', () => {
    expect(extractRestoreImpact({ application_ids: ['a', 'b'] })).toEqual({ cascadedApplicationIds: ['a', 'b'] })
  })
  it('filters out non-string / empty ids', () => {
    expect(extractRestoreImpact({ application_ids: ['a', '', 123, null] })).toEqual({ cascadedApplicationIds: ['a'] })
  })
  it('returns [] for missing / non-array / non-object details', () => {
    expect(extractRestoreImpact({ foo: 1 })).toEqual({ cascadedApplicationIds: [] })
    expect(extractRestoreImpact(null)).toEqual({ cascadedApplicationIds: [] })
    expect(extractRestoreImpact('nope')).toEqual({ cascadedApplicationIds: [] })
  })
})

describe('daysUntilPurge', () => {
  const now = new Date('2026-07-01T00:00:00Z')
  it('returns the full threshold when there is no delete date', () => {
    expect(daysUntilPurge(null, now)).toBe(30)
    expect(daysUntilPurge('not-a-date', now)).toBe(30)
  })
  it('counts down from the 30-day threshold', () => {
    expect(daysUntilPurge('2026-06-21T00:00:00Z', now)).toBe(20) // 10 days elapsed
  })
  it('clamps to 0 once past the threshold', () => {
    expect(daysUntilPurge('2026-05-01T00:00:00Z', now)).toBe(0)
  })
  it('honours a custom threshold', () => {
    expect(daysUntilPurge('2026-06-29T00:00:00Z', now, 7)).toBe(5) // 2 elapsed of 7
  })
})
