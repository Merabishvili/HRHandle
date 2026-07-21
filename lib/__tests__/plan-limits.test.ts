import { describe, it, expect } from 'vitest'
import { justCrossedLimit } from '@/lib/plan-limits'

describe('justCrossedLimit', () => {
  it('is true only at exactly limit + 1 (the crossing)', () => {
    expect(justCrossedLimit(101, 100)).toBe(true)
  })
  it('is false at or below the limit', () => {
    expect(justCrossedLimit(100, 100)).toBe(false)
    expect(justCrossedLimit(50, 100)).toBe(false)
  })
  it('is false when already well past the limit (fires once, not repeatedly)', () => {
    expect(justCrossedLimit(102, 100)).toBe(false)
    expect(justCrossedLimit(200, 100)).toBe(false)
  })
  it('is false when there is no cap (null / 0 / undefined limit)', () => {
    expect(justCrossedLimit(101, null)).toBe(false)
    expect(justCrossedLimit(101, 0)).toBe(false)
    expect(justCrossedLimit(101, undefined)).toBe(false)
  })
})
