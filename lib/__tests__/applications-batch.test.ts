import { describe, it, expect } from 'vitest'
import {
  partitionByOutcome,
  summaryToString,
  type RowResult,
} from '@/lib/applications/batch'

describe('partitionByOutcome', () => {
  it('returns all-zero counts + zero total for an empty array', () => {
    expect(partitionByOutcome([])).toEqual({
      moved: 0,
      skipped: 0,
      failed: 0,
      total: 0,
    })
  })

  it('counts a single outcome of each type', () => {
    const rows: RowResult[] = [
      { applicationId: 'a1', outcome: 'moved' },
      { applicationId: 'a2', outcome: 'skipped' },
      { applicationId: 'a3', outcome: 'failed' },
    ]
    expect(partitionByOutcome(rows)).toEqual({
      moved: 1,
      skipped: 1,
      failed: 1,
      total: 3,
    })
  })

  it('aggregates many rows', () => {
    const rows: RowResult[] = [
      { applicationId: '1', outcome: 'moved' },
      { applicationId: '2', outcome: 'moved' },
      { applicationId: '3', outcome: 'moved' },
      { applicationId: '4', outcome: 'skipped' },
      { applicationId: '5', outcome: 'failed' },
    ]
    expect(partitionByOutcome(rows)).toEqual({
      moved: 3,
      skipped: 1,
      failed: 1,
      total: 5,
    })
  })

  it('ignores unknown outcomes defensively', () => {
    const rows: ReadonlyArray<RowResult> = [
      { applicationId: '1', outcome: 'moved' },
      // @ts-expect-error — deliberately bad outcome to confirm the guard
      { applicationId: '2', outcome: 'mystery' },
    ]
    expect(partitionByOutcome(rows)).toEqual({
      moved: 1,
      skipped: 0,
      failed: 0,
      total: 2,
    })
  })
})

describe('summaryToString', () => {
  it('returns a no-op string when nothing happened', () => {
    expect(summaryToString({ moved: 0, skipped: 0, failed: 0, total: 0 }, 'Interview')).toBe(
      'No changes.',
    )
  })

  it('renders moved-only', () => {
    expect(summaryToString({ moved: 3, skipped: 0, failed: 0, total: 3 }, 'Interview')).toBe(
      '3 moved to Interview.',
    )
  })

  it('joins multiple parts with the divider', () => {
    expect(summaryToString({ moved: 3, skipped: 1, failed: 0, total: 4 }, 'Interview')).toBe(
      '3 moved to Interview · 1 skipped.',
    )
    expect(summaryToString({ moved: 3, skipped: 1, failed: 2, total: 6 }, 'Interview')).toBe(
      '3 moved to Interview · 1 skipped · 2 failed.',
    )
  })

  it('renders failed-only when nothing succeeded', () => {
    expect(summaryToString({ moved: 0, skipped: 0, failed: 5, total: 5 }, 'Interview')).toBe(
      '5 failed.',
    )
  })
})
