import { describe, it, expect } from 'vitest'
import { defaultBusinessTime } from '@/lib/interviews/default-time'

const at = (h: number, m: number) => new Date(2026, 6, 1, h, m, 0)

describe('defaultBusinessTime', () => {
  it('rounds up to the next half-hour within business hours', () => {
    expect(defaultBusinessTime(at(10, 23))).toBe('10:30')
    expect(defaultBusinessTime(at(10, 45))).toBe('11:00')
    expect(defaultBusinessTime(at(10, 0))).toBe('10:00')
    expect(defaultBusinessTime(at(17, 15))).toBe('17:30')
  })

  it('clamps before-hours to 09:00 (no arbitrary current minute)', () => {
    expect(defaultBusinessTime(at(5, 23))).toBe('09:00')
    expect(defaultBusinessTime(at(8, 59))).toBe('09:00')
  })

  it('clamps after-hours to 09:00', () => {
    expect(defaultBusinessTime(at(18, 15))).toBe('09:00')
    expect(defaultBusinessTime(at(17, 45))).toBe('09:00')
  })
})
