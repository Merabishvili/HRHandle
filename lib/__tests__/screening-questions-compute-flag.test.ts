import { describe, it, expect } from 'vitest'

import { computeIsKnockoutFlag } from '@/lib/screening-questions/compute-flag'

describe('computeIsKnockoutFlag', () => {
  it('never flags when is_knockout=false', () => {
    expect(
      computeIsKnockoutFlag({ is_knockout: false, knockout_answer: 'yes' }, 'no'),
    ).toBe(false)
    expect(
      computeIsKnockoutFlag({ is_knockout: false, knockout_answer: null }, ''),
    ).toBe(false)
  })

  it('flags when knockout answer does not match', () => {
    expect(
      computeIsKnockoutFlag({ is_knockout: true, knockout_answer: 'yes' }, 'no'),
    ).toBe(true)
  })

  it('does not flag when knockout answer matches (case-insensitive, trimmed)', () => {
    expect(
      computeIsKnockoutFlag({ is_knockout: true, knockout_answer: 'yes' }, 'YES'),
    ).toBe(false)
    expect(
      computeIsKnockoutFlag({ is_knockout: true, knockout_answer: 'yes' }, '  Yes  '),
    ).toBe(false)
  })

  it('flags when the answer is missing or empty', () => {
    expect(
      computeIsKnockoutFlag({ is_knockout: true, knockout_answer: 'yes' }, null),
    ).toBe(true)
    expect(
      computeIsKnockoutFlag({ is_knockout: true, knockout_answer: 'yes' }, undefined),
    ).toBe(true)
    expect(
      computeIsKnockoutFlag({ is_knockout: true, knockout_answer: 'yes' }, ''),
    ).toBe(true)
    expect(
      computeIsKnockoutFlag({ is_knockout: true, knockout_answer: 'yes' }, '   '),
    ).toBe(true)
  })

  it('does not flag when knockout_answer is null defensively', () => {
    expect(
      computeIsKnockoutFlag({ is_knockout: true, knockout_answer: null }, 'anything'),
    ).toBe(false)
  })
})
