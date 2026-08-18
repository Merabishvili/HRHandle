import { describe, it, expect } from 'vitest'
import { isTerminalStage, STALE_DAYS } from '@/lib/pipeline/stage-style'
import { timeInStage } from '@/lib/pipeline/time-in-stage'

describe('isTerminalStage', () => {
  it('is true for the closed outcomes', () => {
    expect(isTerminalStage('hired')).toBe(true)
    expect(isTerminalStage('rejected')).toBe(true)
    expect(isTerminalStage('withdrawn')).toBe(true)
  })

  it('is false for active stages', () => {
    expect(isTerminalStage('applied')).toBe(false)
    expect(isTerminalStage('screening')).toBe(false)
    expect(isTerminalStage('interview')).toBe(false)
    expect(isTerminalStage('offer')).toBe(false)
  })

  it('is false for null / unknown codes', () => {
    expect(isTerminalStage(null)).toBe(false)
    expect(isTerminalStage(undefined)).toBe(false)
    expect(isTerminalStage('nonsense')).toBe(false)
  })
})

describe('stale gating on terminal stages', () => {
  // A card well past the stale threshold...
  const longAgo = new Date(Date.now() - (STALE_DAYS + 7) * 24 * 60 * 60 * 1000).toISOString()

  it('time-in-stage alone flags an old card as stale', () => {
    expect(timeInStage(longAgo).isStale).toBe(true)
  })

  it('...but a hired card is not stale once gated on stage', () => {
    const rawStale = timeInStage(longAgo).isStale
    const gated = rawStale && !isTerminalStage('hired')
    expect(gated).toBe(false)
  })

  it('an old active card stays stale after gating', () => {
    const rawStale = timeInStage(longAgo).isStale
    const gated = rawStale && !isTerminalStage('applied')
    expect(gated).toBe(true)
  })
})
