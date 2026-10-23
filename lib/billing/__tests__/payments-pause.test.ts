import { describe, it, expect } from 'vitest'
import { parsePausedUntil } from '../payments-pause'

const NOW = new Date('2026-10-23T12:00:00Z')

describe('parsePausedUntil', () => {
  it('reads a future date as the end of that day (UTC)', () => {
    expect(parsePausedUntil('2026-11-01', NOW)?.toISOString()).toBe('2026-11-01T23:59:59.000Z')
  })
  it('counts today as still paused', () => {
    expect(parsePausedUntil('2026-10-23', NOW)).not.toBeNull()
  })
  it('ignores past, empty and invalid values', () => {
    expect(parsePausedUntil('2026-10-01', NOW)).toBeNull()
    expect(parsePausedUntil('', NOW)).toBeNull()
    expect(parsePausedUntil(undefined, NOW)).toBeNull()
    expect(parsePausedUntil('soon', NOW)).toBeNull()
  })
})
