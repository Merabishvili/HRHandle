import { describe, it, expect } from 'vitest'
import {
  getStageStyle,
  isTerminalStage,
  TERMINAL_STAGE_CODES,
  STALE_DAYS,
} from '@/lib/pipeline/stage-style'

describe('getStageStyle', () => {
  it('returns a distinct style for each known stage code', () => {
    for (const code of ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected']) {
      const style = getStageStyle(code)
      expect(style.columnBg).toBeTruthy()
      expect(style.pillBg).toBeTruthy()
      expect(style.spine).toBeTruthy()
    }
  })

  it('gives applied and interview different spines', () => {
    expect(getStageStyle('applied').spine).not.toBe(getStageStyle('interview').spine)
  })

  it('falls back to the neutral style for an unknown code', () => {
    const neutral = getStageStyle('__nope__')
    expect(neutral).toEqual(getStageStyle('withdrawn')) // withdrawn maps to NEUTRAL_STYLE
  })

  it('falls back to the neutral style for null / undefined / empty', () => {
    const neutral = getStageStyle('__nope__')
    expect(getStageStyle(null)).toEqual(neutral)
    expect(getStageStyle(undefined)).toEqual(neutral)
    expect(getStageStyle('')).toEqual(neutral)
  })
})

describe('isTerminalStage', () => {
  it('is true for hired / rejected / withdrawn', () => {
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

  it('is false for null / undefined / unknown', () => {
    expect(isTerminalStage(null)).toBe(false)
    expect(isTerminalStage(undefined)).toBe(false)
    expect(isTerminalStage('mystery')).toBe(false)
  })

  it('the terminal set matches the three canonical terminal codes', () => {
    expect([...TERMINAL_STAGE_CODES].sort()).toEqual(['hired', 'rejected', 'withdrawn'])
  })
})

describe('STALE_DAYS', () => {
  it('is a positive integer threshold', () => {
    expect(Number.isInteger(STALE_DAYS)).toBe(true)
    expect(STALE_DAYS).toBeGreaterThan(0)
  })
})
