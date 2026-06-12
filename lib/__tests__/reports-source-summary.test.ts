import { describe, it, expect } from 'vitest'
import {
  buildSourceSummary,
  labelForSource,
  formatPercent,
  type SourceRow,
} from '@/lib/reports/source-summary'

describe('labelForSource', () => {
  it('maps known source keys to friendly labels', () => {
    expect(labelForSource('public_form')).toBe('Public apply form')
    expect(labelForSource('manual')).toBe('Manual entry')
    expect(labelForSource('csv_import')).toBe('CSV import')
  })

  it('passes unknown raw values through as-is', () => {
    expect(labelForSource('referral_partner_x')).toBe('referral_partner_x')
  })

  it('collapses null / empty to "Unknown"', () => {
    expect(labelForSource(null)).toBe('Unknown')
    expect(labelForSource(undefined)).toBe('Unknown')
    expect(labelForSource('')).toBe('Unknown')
  })
})

describe('buildSourceSummary', () => {
  it('returns [] for an empty input', () => {
    expect(buildSourceSummary([])).toEqual([])
  })

  it('counts applications and hires per source', () => {
    const rows: SourceRow[] = [
      { sourceType: 'public_form', hired: false },
      { sourceType: 'public_form', hired: true },
      { sourceType: 'manual', hired: true },
      { sourceType: 'manual', hired: false },
      { sourceType: 'manual', hired: false },
    ]
    const out = buildSourceSummary(rows)
    expect(out).toEqual([
      { key: 'manual', label: 'Manual entry', applications: 3, hires: 1, conversion: 1 / 3 },
      { key: 'public_form', label: 'Public apply form', applications: 2, hires: 1, conversion: 0.5 },
    ])
  })

  it('collapses null source_type into a single "unknown" bucket', () => {
    const rows: SourceRow[] = [
      { sourceType: null, hired: false },
      { sourceType: null, hired: true },
    ]
    const out = buildSourceSummary(rows)
    expect(out).toEqual([
      { key: 'unknown', label: 'Unknown', applications: 2, hires: 1, conversion: 0.5 },
    ])
  })

  it('sorts by application count desc then label asc', () => {
    const rows: SourceRow[] = [
      { sourceType: 'b', hired: false },
      { sourceType: 'b', hired: false },
      { sourceType: 'a', hired: false },
      { sourceType: 'a', hired: false },
      { sourceType: 'c', hired: false },
    ]
    const out = buildSourceSummary(rows)
    expect(out.map((r) => r.key)).toEqual(['a', 'b', 'c'])
  })
})

describe('formatPercent', () => {
  it('formats as percentage with one decimal', () => {
    expect(formatPercent(0.5)).toBe('50.0%')
    expect(formatPercent(0.123456)).toBe('12.3%')
    expect(formatPercent(1)).toBe('100.0%')
  })
  it('returns em-dash for null', () => {
    expect(formatPercent(null)).toBe('—')
  })
})
