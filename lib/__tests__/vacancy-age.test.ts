import { describe, it, expect } from 'vitest'
import { vacancyRecencyLabel } from '@/lib/vacancy-age'

const DAY = 1000 * 60 * 60 * 24
const now = new Date('2026-06-29T12:00:00Z')

describe('vacancyRecencyLabel', () => {
  it('says "opened Nd ago" for a published vacancy', () => {
    const created = new Date(now.getTime() - 12 * DAY).toISOString()
    expect(vacancyRecencyLabel(created, false, now)).toEqual({ key: 'vacAge.openedAgo', days: 12 })
  })

  it('says "created Nd ago" for a draft', () => {
    const created = new Date(now.getTime() - 3 * DAY).toISOString()
    expect(vacancyRecencyLabel(created, true, now)).toEqual({ key: 'vacAge.createdAgo', days: 3 })
  })

  it('uses "today" under a full day (no "0d ago")', () => {
    const created = new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString() // 5h
    expect(vacancyRecencyLabel(created, false, now)).toEqual({ key: 'vacAge.openedToday', days: 0 })
    expect(vacancyRecencyLabel(created, true, now)).toEqual({ key: 'vacAge.createdToday', days: 0 })
  })

  it('floors partial days (1.9 days → 1d)', () => {
    const created = new Date(now.getTime() - 1.9 * DAY).toISOString()
    expect(vacancyRecencyLabel(created, false, now)).toEqual({ key: 'vacAge.openedAgo', days: 1 })
  })

  it('clamps a future created_at to "today" instead of going negative', () => {
    const created = new Date(now.getTime() + 2 * DAY).toISOString()
    expect(vacancyRecencyLabel(created, false, now)).toEqual({ key: 'vacAge.openedToday', days: 0 })
  })
})
