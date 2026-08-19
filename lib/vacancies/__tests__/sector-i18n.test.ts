import { describe, it, expect } from 'vitest'
import { sectorLabel, SECTOR_I18N_KEY } from '@/lib/vacancies/sector-i18n'

// Fake translator: echoes the key so we can assert the right key was requested.
const t = (key: string) => `T:${key}`

describe('sectorLabel', () => {
  it('maps each known sector name to its i18n key', () => {
    expect(sectorLabel(t, 'Financial')).toBe('T:sector.financial')
    expect(sectorLabel(t, 'IT')).toBe('T:sector.it')
    expect(sectorLabel(t, 'Customer Support')).toBe('T:sector.customerSupport')
  })

  it('every mapped key is translated (not left as raw name)', () => {
    for (const name of Object.keys(SECTOR_I18N_KEY)) {
      expect(sectorLabel(t, name)).toBe(`T:${SECTOR_I18N_KEY[name]}`)
    }
  })

  it('falls back to the raw name for an unknown/custom sector', () => {
    expect(sectorLabel(t, 'Aerospace')).toBe('Aerospace')
  })

  it('returns empty string for null/undefined so callers can add a placeholder', () => {
    expect(sectorLabel(t, null)).toBe('')
    expect(sectorLabel(t, undefined)).toBe('')
  })
})
