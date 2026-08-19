import { describe, it, expect } from 'vitest'
import { sourceLabel } from '@/lib/pipeline/source-i18n'

const t = (key: string) => `T:${key}`

describe('sourceLabel', () => {
  it('maps the app-generated public-apply source', () => {
    expect(sourceLabel(t, 'Public Form')).toBe('T:source.publicForm')
    expect(sourceLabel(t, 'public apply')).toBe('T:source.publicForm')
  })

  it('maps LinkedIn / CSV / manual / website / job board', () => {
    expect(sourceLabel(t, 'LinkedIn')).toBe('T:source.linkedin')
    expect(sourceLabel(t, 'CSV import')).toBe('T:source.csv')
    expect(sourceLabel(t, 'Manual')).toBe('T:source.manual')
    expect(sourceLabel(t, 'Company website')).toBe('T:source.website')
    expect(sourceLabel(t, 'Job board')).toBe('T:source.jobBoard')
  })

  it('passes free-text sources through unchanged', () => {
    expect(sourceLabel(t, 'Referral from Nino')).toBe('Referral from Nino')
  })

  it('returns empty string for null/empty', () => {
    expect(sourceLabel(t, null)).toBe('')
    expect(sourceLabel(t, '  ')).toBe('')
  })
})
