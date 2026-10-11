import { describe, it, expect } from 'vitest'
import { dateFnsLocale, formatShortDate, formatShortDateTime } from '@/lib/i18n/date-locale'

const day = new Date(2026, 8, 20, 12, 0, 0)

describe('formatShortDate', () => {
  it('keeps the English month-first form', () => {
    expect(formatShortDate(day, dateFnsLocale('en'))).toBe('Sep 20, 2026')
  })

  it('puts the day first in Georgian and Russian', () => {
    expect(formatShortDate(day, dateFnsLocale('ka'))).toBe('20 სექ 2026')
    expect(formatShortDate(day, dateFnsLocale('ru'))).toBe('20 сент. 2026')
  })

  it('accepts ISO strings and defaults to English', () => {
    expect(formatShortDate('2026-09-20T12:00:00')).toBe('Sep 20, 2026')
  })
})

describe('formatShortDateTime', () => {
  const at = new Date(2026, 8, 20, 15, 5, 0)
  it('uses a 12-hour clock in English and a 24-hour clock in Georgian and Russian', () => {
    expect(formatShortDateTime(at, dateFnsLocale('en'))).toBe('Sep 20, 2026, 3:05 PM')
    expect(formatShortDateTime(at, dateFnsLocale('ru'))).toBe('20 сент. 2026, 15:05')
    expect(formatShortDateTime(at, dateFnsLocale('ka'))).toBe('20 სექ 2026, 15:05')
  })
})
