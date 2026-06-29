import { describe, it, expect } from 'vitest'
import { vacancyRecencyLabel } from '@/lib/vacancy-age'

const DAY = 1000 * 60 * 60 * 24
const now = new Date('2026-06-29T12:00:00Z')

describe('vacancyRecencyLabel', () => {
  it('says "opened Nd ago" for a published vacancy', () => {
    const created = new Date(now.getTime() - 12 * DAY).toISOString()
    expect(vacancyRecencyLabel(created, false, now)).toBe('opened 12d ago')
  })

  it('says "created Nd ago" for a draft', () => {
    const created = new Date(now.getTime() - 3 * DAY).toISOString()
    expect(vacancyRecencyLabel(created, true, now)).toBe('created 3d ago')
  })

  it('uses "today" under a full day (no "0d ago")', () => {
    const created = new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString() // 5h
    expect(vacancyRecencyLabel(created, false, now)).toBe('opened today')
    expect(vacancyRecencyLabel(created, true, now)).toBe('created today')
  })

  it('floors partial days (1.9 days → 1d)', () => {
    const created = new Date(now.getTime() - 1.9 * DAY).toISOString()
    expect(vacancyRecencyLabel(created, false, now)).toBe('opened 1d ago')
  })

  it('clamps a future created_at to "today" instead of going negative', () => {
    const created = new Date(now.getTime() + 2 * DAY).toISOString()
    expect(vacancyRecencyLabel(created, false, now)).toBe('opened today')
  })
})
