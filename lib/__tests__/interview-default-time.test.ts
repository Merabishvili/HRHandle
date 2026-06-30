import { describe, it, expect } from 'vitest'
import { defaultBusinessTime, nextBusinessSlot } from '@/lib/interviews/default-time'

// 2026-07-01 is a Wednesday.
const at = (h: number, m: number, day = 1) => new Date(2026, 6, day, h, m, 0)

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

describe('nextBusinessSlot', () => {
  it('keeps the same weekday when within business hours', () => {
    expect(nextBusinessSlot(at(10, 23))).toEqual({ date: '2026-07-01', time: '10:30' })
  })

  it('rolls to the next day when after hours', () => {
    // Wed 18:15 → Thu 09:00
    expect(nextBusinessSlot(at(18, 15))).toEqual({ date: '2026-07-02', time: '09:00' })
  })

  it('skips weekends to Monday morning', () => {
    // 2026-07-04 is a Saturday → Monday 2026-07-06 09:00
    expect(nextBusinessSlot(at(14, 0, 4))).toEqual({ date: '2026-07-06', time: '09:00' })
    // Friday 2026-07-03 after hours → Monday
    expect(nextBusinessSlot(at(18, 0, 3))).toEqual({ date: '2026-07-06', time: '09:00' })
  })

  it('before-hours stays the same day at 09:00', () => {
    expect(nextBusinessSlot(at(5, 23))).toEqual({ date: '2026-07-01', time: '09:00' })
  })
})
