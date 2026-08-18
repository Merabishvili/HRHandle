import { describe, it, expect } from 'vitest'
import { computeIsKnockoutFlag } from '@/lib/screening-questions/compute-flag'

describe('computeIsKnockoutFlag', () => {
  it('never flags an informational (non-knockout) question', () => {
    expect(computeIsKnockoutFlag({ is_knockout: false, knockout_answer: 'yes' }, 'no')).toBe(false)
  })

  it('never flags a knockout with no stored condition (defensive)', () => {
    expect(computeIsKnockoutFlag({ is_knockout: true, knockout_answer: null }, 'no')).toBe(false)
  })

  it('flags when a knockout answer fails the condition', () => {
    expect(computeIsKnockoutFlag({ is_knockout: true, knockout_answer: 'yes', answer_type: 'yes_no' }, 'no')).toBe(true)
  })

  it('does not flag when the knockout answer passes', () => {
    expect(computeIsKnockoutFlag({ is_knockout: true, knockout_answer: 'yes', answer_type: 'yes_no' }, 'yes')).toBe(false)
  })

  it('flags a missing answer to a knockout question', () => {
    expect(computeIsKnockoutFlag({ is_knockout: true, knockout_answer: 'yes', answer_type: 'yes_no' }, null)).toBe(true)
  })

  it('defaults to yes_no when answer_type is omitted', () => {
    expect(computeIsKnockoutFlag({ is_knockout: true, knockout_answer: 'yes' }, 'no')).toBe(true)
  })

  it('works for a number knockout condition', () => {
    const q = { is_knockout: true, knockout_answer: JSON.stringify({ op: 'gte', value: 5 }), answer_type: 'number' as const }
    expect(computeIsKnockoutFlag(q, '3')).toBe(true) // 3 < 5 → fails → flags
    expect(computeIsKnockoutFlag(q, '6')).toBe(false)
  })
})
