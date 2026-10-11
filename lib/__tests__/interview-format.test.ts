import { describe, it, expect } from 'vitest'
import { formatInterviewDate, formatInterviewTime, formatInterviewWhen } from '@/lib/interviews/format'

const at = new Date(2026, 9, 11, 15, 0, 0)

describe('interview date and time', () => {
  it('keeps the English month-first, 12-hour form', () => {
    expect(formatInterviewDate(at, 'en')).toBe('Oct 11, 2026')
    expect(formatInterviewTime(at, 'en')).toBe('3:00 PM')
  })

  it('uses day-first dates with month names and a 24-hour clock in Georgian and Russian', () => {
    expect(formatInterviewDate(at, 'ka')).toBe('11 ოქტ 2026')
    expect(formatInterviewDate(at, 'ru')).toBe('11 окт. 2026')
    expect(formatInterviewTime(at, 'ka')).toBe('15:00')
    expect(formatInterviewTime(at, 'ru')).toBe('15:00')
  })
})

describe('interview summary "When"', () => {
  it('reads naturally in each language', () => {
    expect(formatInterviewWhen(at, 'en')).toBe('Sun, Oct 11, 3:00 PM')
    expect(formatInterviewWhen(at, 'ru')).toBe('вск, 11 окт., 15:00')
    expect(formatInterviewWhen(at, 'ka')).toBe('კვი, 11 ოქტ, 15:00')
  })
})
