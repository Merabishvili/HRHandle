import { describe, it, expect } from 'vitest'
import { percentile, summarize, byVacancy, formatDays, type TimeToHireSample } from '@/lib/reports/time-to-hire'

describe('percentile', () => {
  it('returns null on empty', () => {
    expect(percentile([], 0.5)).toBe(null)
  })

  it('returns the sole value when length 1', () => {
    expect(percentile([42], 0.5)).toBe(42)
    expect(percentile([42], 0.95)).toBe(42)
  })

  it('interpolates between two adjacent values', () => {
    expect(percentile([0, 100], 0.5)).toBe(50)
    expect(percentile([10, 20], 0.5)).toBe(15)
  })

  it('returns the exact value on bucket boundaries', () => {
    expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1)
    expect(percentile([1, 2, 3, 4, 5], 1)).toBe(5)
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3)
  })

  it('p25 and p75 work for a longer sample', () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const p25 = percentile(xs, 0.25)
    const p75 = percentile(xs, 0.75)
    expect(p25).toBeCloseTo(3.25, 5)
    expect(p75).toBeCloseTo(7.75, 5)
  })
})

const samples = (days: number[]): TimeToHireSample[] =>
  days.map((d, i) => ({
    applicationId: `a${i}`,
    vacancyId: 'v1',
    vacancyTitle: 'Vacancy 1',
    daysToHire: d,
  }))

describe('summarize', () => {
  it('returns all-null stats for empty', () => {
    const s = summarize([])
    expect(s).toEqual({
      count: 0,
      median: null,
      p25: null,
      p75: null,
      mean: null,
      min: null,
      max: null,
    })
  })

  it('computes median / mean / min / max', () => {
    const s = summarize(samples([1, 2, 3, 4, 5]))
    expect(s.count).toBe(5)
    expect(s.median).toBe(3)
    expect(s.min).toBe(1)
    expect(s.max).toBe(5)
    expect(s.mean).toBe(3)
  })

  it('is robust to unsorted input', () => {
    const s = summarize(samples([5, 1, 3, 2, 4]))
    expect(s.min).toBe(1)
    expect(s.max).toBe(5)
    expect(s.median).toBe(3)
  })
})

describe('byVacancy', () => {
  it('groups by vacancyId and computes per-vacancy median', () => {
    const s: TimeToHireSample[] = [
      { applicationId: 'a', vacancyId: 'v1', vacancyTitle: 'V1', daysToHire: 10 },
      { applicationId: 'b', vacancyId: 'v1', vacancyTitle: 'V1', daysToHire: 20 },
      { applicationId: 'c', vacancyId: 'v2', vacancyTitle: 'V2', daysToHire: 5 },
    ]
    const out = byVacancy(s)
    expect(out).toEqual([
      { vacancyId: 'v1', vacancyTitle: 'V1', count: 2, median: 15 },
      { vacancyId: 'v2', vacancyTitle: 'V2', count: 1, median: 5 },
    ])
  })

  it('skips samples with no vacancyId', () => {
    const s: TimeToHireSample[] = [
      { applicationId: 'a', vacancyId: null, vacancyTitle: null, daysToHire: 10 },
      { applicationId: 'b', vacancyId: 'v1', vacancyTitle: 'V1', daysToHire: 20 },
    ]
    const out = byVacancy(s)
    expect(out).toHaveLength(1)
    expect(out[0].vacancyId).toBe('v1')
  })

  it('sorts by hire count desc then title asc', () => {
    const s: TimeToHireSample[] = [
      { applicationId: '1', vacancyId: 'v1', vacancyTitle: 'B', daysToHire: 5 },
      { applicationId: '2', vacancyId: 'v2', vacancyTitle: 'A', daysToHire: 5 },
      { applicationId: '3', vacancyId: 'v2', vacancyTitle: 'A', daysToHire: 7 },
    ]
    const out = byVacancy(s)
    expect(out.map((r) => r.vacancyTitle)).toEqual(['A', 'B'])
  })
})

describe('formatDays', () => {
  it('formats to one decimal with d suffix', () => {
    expect(formatDays(5)).toBe('5.0d')
    expect(formatDays(12.345)).toBe('12.3d')
    expect(formatDays(0)).toBe('0.0d')
  })
  it('returns em-dash for null', () => {
    expect(formatDays(null)).toBe('—')
  })
})
