import { describe, it, expect } from 'vitest'
import { extractRestoreImpact, daysUntilPurge } from '@/lib/trash/impact'

describe('extractRestoreImpact', () => {
  it('returns empty array for nullish details', () => {
    expect(extractRestoreImpact(null).cascadedApplicationIds).toEqual([])
    expect(extractRestoreImpact(undefined).cascadedApplicationIds).toEqual([])
  })

  it('returns empty array when application_ids is missing', () => {
    expect(extractRestoreImpact({}).cascadedApplicationIds).toEqual([])
    expect(extractRestoreImpact({ cascaded_applications: 3 }).cascadedApplicationIds).toEqual([])
  })

  it('extracts string ids', () => {
    expect(
      extractRestoreImpact({ application_ids: ['a1', 'a2', 'a3'] }).cascadedApplicationIds,
    ).toEqual(['a1', 'a2', 'a3'])
  })

  it('filters empties and non-strings out', () => {
    expect(
      extractRestoreImpact({ application_ids: ['a1', '', null, 0, false, 'a2'] }).cascadedApplicationIds,
    ).toEqual(['a1', 'a2'])
  })

  it('ignores application_ids when it is not an array', () => {
    expect(
      extractRestoreImpact({ application_ids: 'not-an-array' }).cascadedApplicationIds,
    ).toEqual([])
    expect(
      extractRestoreImpact({ application_ids: { 0: 'a1' } }).cascadedApplicationIds,
    ).toEqual([])
  })
})

describe('daysUntilPurge', () => {
  const NOW = new Date('2026-07-15T12:00:00Z')

  it('returns the full window when deletedAt is null', () => {
    expect(daysUntilPurge(null, NOW)).toBe(30)
  })

  it('returns the full window for a row deleted today', () => {
    expect(daysUntilPurge('2026-07-15T11:00:00Z', NOW)).toBe(30)
  })

  it('counts elapsed whole days down from 30', () => {
    expect(daysUntilPurge('2026-07-14T12:00:00Z', NOW)).toBe(29)
    expect(daysUntilPurge('2026-07-01T12:00:00Z', NOW)).toBe(16)
  })

  it('clamps at zero when threshold has passed', () => {
    expect(daysUntilPurge('2026-06-10T12:00:00Z', NOW)).toBe(0)
    expect(daysUntilPurge('2025-01-01T00:00:00Z', NOW)).toBe(0)
  })

  it('falls through to the full window on malformed input', () => {
    expect(daysUntilPurge('not-a-date', NOW)).toBe(30)
  })

  it('honours a custom threshold', () => {
    expect(daysUntilPurge('2026-07-01T12:00:00Z', NOW, 14)).toBe(0)
    expect(daysUntilPurge('2026-07-10T12:00:00Z', NOW, 14)).toBe(9)
  })
})
