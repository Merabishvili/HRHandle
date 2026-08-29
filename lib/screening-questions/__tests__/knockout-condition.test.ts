import { describe, it, expect } from 'vitest'
import {
  evaluateKnockoutPass,
  encodeKnockoutAnswer,
  describeKnockoutAnswer,
  formatKnockoutExpected,
} from '@/lib/screening-questions/knockout-condition'

describe('evaluateKnockoutPass — general', () => {
  it('passes when there is no knockout condition', () => {
    expect(evaluateKnockoutPass('yes_no', null, 'anything')).toBe(true)
    expect(evaluateKnockoutPass('yes_no', undefined, '')).toBe(true)
  })
  it('a blank answer to a real knockout never passes (flags)', () => {
    expect(evaluateKnockoutPass('yes_no', 'yes', '')).toBe(false)
    expect(evaluateKnockoutPass('yes_no', 'yes', '   ')).toBe(false)
    expect(evaluateKnockoutPass('yes_no', 'yes', null)).toBe(false)
  })
})

describe('evaluateKnockoutPass — yes_no', () => {
  it('passes on a case-insensitive exact match', () => {
    expect(evaluateKnockoutPass('yes_no', 'yes', 'Yes')).toBe(true)
    expect(evaluateKnockoutPass('yes_no', 'no', 'NO')).toBe(true)
  })
  it('flags on the wrong answer', () => {
    expect(evaluateKnockoutPass('yes_no', 'yes', 'no')).toBe(false)
  })
})

describe('evaluateKnockoutPass — number', () => {
  it('lte passes at or below the threshold', () => {
    const c = JSON.stringify({ op: 'lte', value: 3 })
    expect(evaluateKnockoutPass('number', c, '3')).toBe(true)
    expect(evaluateKnockoutPass('number', c, '2')).toBe(true)
    expect(evaluateKnockoutPass('number', c, '4')).toBe(false)
  })
  it('gte passes at or above the threshold', () => {
    const c = JSON.stringify({ op: 'gte', value: 5 })
    expect(evaluateKnockoutPass('number', c, '5')).toBe(true)
    expect(evaluateKnockoutPass('number', c, '4')).toBe(false)
  })
  it('between passes inside the inclusive range', () => {
    const c = JSON.stringify({ op: 'between', value: 2, value2: 5 })
    expect(evaluateKnockoutPass('number', c, '2')).toBe(true)
    expect(evaluateKnockoutPass('number', c, '5')).toBe(true)
    expect(evaluateKnockoutPass('number', c, '6')).toBe(false)
  })
  it('a non-numeric answer flags', () => {
    expect(evaluateKnockoutPass('number', JSON.stringify({ op: 'lte', value: 3 }), 'abc')).toBe(false)
  })
  it('an uninterpretable condition passes (under-flag)', () => {
    expect(evaluateKnockoutPass('number', 'not-json', '3')).toBe(true)
  })
})

describe('evaluateKnockoutPass — select', () => {
  it('passes when the answer is one of the passing options (case-insensitive)', () => {
    const c = JSON.stringify(['Remote', 'Hybrid'])
    expect(evaluateKnockoutPass('select', c, 'remote')).toBe(true)
    expect(evaluateKnockoutPass('select', c, 'Onsite')).toBe(false)
  })
  it('treats a legacy plain-string condition as a single passing option', () => {
    expect(evaluateKnockoutPass('select', 'Remote', 'remote')).toBe(true)
  })
})

describe('encodeKnockoutAnswer', () => {
  it('encodes yes_no as the literal passing answer', () => {
    expect(encodeKnockoutAnswer('yes_no', { kind: 'yes_no', passingAnswer: 'no' })).toBe('no')
  })
  it('encodes number lte/gte', () => {
    expect(encodeKnockoutAnswer('number', { kind: 'number', op: 'lte', value: 3 })).toBe(JSON.stringify({ op: 'lte', value: 3 }))
  })
  it('sorts a between range low..high', () => {
    expect(encodeKnockoutAnswer('number', { kind: 'number', op: 'between', value: 9, value2: 2 }))
      .toBe(JSON.stringify({ op: 'between', value: 2, value2: 9 }))
  })
  it('returns null for an incomplete condition', () => {
    expect(encodeKnockoutAnswer('select', { kind: 'select', passingOptions: ['  ', ''] })).toBeNull()
    expect(encodeKnockoutAnswer('number', { kind: 'number', op: 'between', value: 2, value2: null })).toBeNull()
    expect(encodeKnockoutAnswer('yes_no', null)).toBeNull()
  })
})

describe('describeKnockoutAnswer', () => {
  it('summarises each answer type', () => {
    expect(describeKnockoutAnswer('yes_no', 'yes')).toBe('passes when = yes')
    expect(describeKnockoutAnswer('number', JSON.stringify({ op: 'gte', value: 5 }))).toBe('passes when ≥ 5')
    expect(describeKnockoutAnswer('select', JSON.stringify(['A', 'B']))).toBe('passes: A, B')
    expect(describeKnockoutAnswer('yes_no', null)).toBeNull()
  })
})

describe('formatKnockoutExpected', () => {
  it('decodes the number condition to a concise operator form (no raw JSON)', () => {
    expect(formatKnockoutExpected('number', JSON.stringify({ op: 'lte', value: 2 }))).toBe('≤ 2')
    expect(formatKnockoutExpected('number', JSON.stringify({ op: 'gte', value: 5 }))).toBe('≥ 5')
    expect(formatKnockoutExpected('number', JSON.stringify({ op: 'between', value: 2, value2: 5 }))).toBe('2–5')
  })
  it('joins select options', () => {
    expect(formatKnockoutExpected('select', JSON.stringify(['Remote', 'Hybrid']))).toBe('Remote, Hybrid')
  })
  it('returns the raw value for yes_no/short_text (caller localizes) and null when unset', () => {
    expect(formatKnockoutExpected('yes_no', 'yes')).toBe('yes')
    expect(formatKnockoutExpected('number', null)).toBeNull()
  })
})
