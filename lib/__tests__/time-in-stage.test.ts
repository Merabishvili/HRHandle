import { describe, it, expect } from 'vitest'
import { timeInStage } from '@/lib/pipeline/time-in-stage'

describe('timeInStage', () => {
  const now = new Date('2026-07-15T12:00:00Z')

  it('renders "Just now" inside the first hour', () => {
    const result = timeInStage('2026-07-15T11:45:00Z', now)
    expect(result.label).toBe('Just now')
    expect(result.isStale).toBe(false)
    expect(result.hours).toBe(0)
  })

  it('renders "Nh" between 1h and 24h', () => {
    const r1 = timeInStage('2026-07-15T11:00:00Z', now)
    expect(r1.label).toBe('1h')

    const r16 = timeInStage('2026-07-14T20:00:00Z', now)
    expect(r16.label).toBe('16h')
    expect(r16.isStale).toBe(false)
  })

  it('renders "Nd" once past 24h, rounded down to whole days', () => {
    const r1d = timeInStage('2026-07-14T12:00:00Z', now)
    expect(r1d.label).toBe('1d')

    // 2d 5h since stage entry — still "2d", not "2.5d" or rounded up.
    const r2d5h = timeInStage('2026-07-13T07:00:00Z', now)
    expect(r2d5h.label).toBe('2d')
  })

  it('flags stale at exactly 5d (the design threshold)', () => {
    const r5d = timeInStage('2026-07-10T12:00:00Z', now)
    expect(r5d.label).toBe('5d')
    expect(r5d.isStale).toBe(true)

    const r4d23h = timeInStage('2026-07-10T13:30:00Z', now)
    // 4 days 22.5 hours → 119h → not stale yet
    expect(r4d23h.isStale).toBe(false)
  })

  it('clamps negative durations (future since-date) to zero', () => {
    const r = timeInStage('2027-01-01T00:00:00Z', now)
    expect(r.hours).toBe(0)
    expect(r.label).toBe('Just now')
    expect(r.isStale).toBe(false)
  })

  it('accepts a Date object as the since input', () => {
    const r = timeInStage(new Date('2026-07-14T20:00:00Z'), now)
    expect(r.label).toBe('16h')
  })
})
