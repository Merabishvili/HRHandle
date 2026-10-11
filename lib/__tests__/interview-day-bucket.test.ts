import { describe, it, expect } from 'vitest'
import { interviewDayBucket } from '@/lib/interviews/day-bucket'

// 2026-07-01 is a Wednesday; its week (Monday start) runs Jun 29 – Jul 5.
const now = new Date(2026, 6, 1, 12, 0, 0)
const on = (month: number, day: number, h = 10) => new Date(2026, month, day, h, 0, 0)

describe('interviewDayBucket', () => {
  it('keeps every interview of today together, earlier ones too', () => {
    expect(interviewDayBucket(on(6, 1, 9), now)).toBe('today')
    expect(interviewDayBucket(on(6, 1, 15), now)).toBe('today')
  })

  it('puts the coming days in order', () => {
    expect(interviewDayBucket(on(6, 2), now)).toBe('tomorrow')
    expect(interviewDayBucket(on(6, 4), now)).toBe('this_week')
    expect(interviewDayBucket(on(6, 6), now)).toBe('later')
  })

  it('files anything already in the past under past — earlier this week included', () => {
    expect(interviewDayBucket(on(5, 30), now)).toBe('past')
    expect(interviewDayBucket(on(5, 21), now)).toBe('past')
  })
})
