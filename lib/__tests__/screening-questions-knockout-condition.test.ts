import { describe, it, expect } from 'vitest'
import {
  encodeKnockoutAnswer,
  evaluateKnockoutPass,
  describeKnockoutAnswer,
} from '@/lib/screening-questions/knockout-condition'

describe('encodeKnockoutAnswer', () => {
  it('yes_no → the literal passing answer', () => {
    expect(encodeKnockoutAnswer('yes_no', { kind: 'yes_no', passingAnswer: 'yes' })).toBe('yes')
    expect(encodeKnockoutAnswer('yes_no', { kind: 'yes_no', passingAnswer: 'no' })).toBe('no')
  })

  it('number → JSON op/value, sorting a between range', () => {
    expect(encodeKnockoutAnswer('number', { kind: 'number', op: 'gte', value: 3 })).toBe(
      '{"op":"gte","value":3}',
    )
    expect(
      encodeKnockoutAnswer('number', { kind: 'number', op: 'between', value: 50, value2: 10 }),
    ).toBe('{"op":"between","value":10,"value2":50}')
  })

  it('number with no/!valid value → null (informational)', () => {
    expect(encodeKnockoutAnswer('number', { kind: 'number', op: 'lte', value: Number.NaN })).toBeNull()
    expect(
      encodeKnockoutAnswer('number', { kind: 'number', op: 'between', value: 5, value2: null }),
    ).toBeNull()
  })

  it('select → JSON array of trimmed passing options; empty → null', () => {
    expect(
      encodeKnockoutAnswer('select', { kind: 'select', passingOptions: [' A ', 'B', ''] }),
    ).toBe('["A","B"]')
    expect(encodeKnockoutAnswer('select', { kind: 'select', passingOptions: ['  '] })).toBeNull()
  })
})

describe('evaluateKnockoutPass', () => {
  it('yes_no passes only on the configured answer (case-insensitive)', () => {
    expect(evaluateKnockoutPass('yes_no', 'yes', 'Yes')).toBe(true)
    expect(evaluateKnockoutPass('yes_no', 'yes', 'no')).toBe(false)
    expect(evaluateKnockoutPass('yes_no', 'no', 'No')).toBe(true)
  })

  it('number ≤ / ≥ / between', () => {
    expect(evaluateKnockoutPass('number', '{"op":"lte","value":10000}', '8000')).toBe(true)
    expect(evaluateKnockoutPass('number', '{"op":"lte","value":10000}', '12000')).toBe(false)
    expect(evaluateKnockoutPass('number', '{"op":"gte","value":3}', '5')).toBe(true)
    expect(evaluateKnockoutPass('number', '{"op":"between","value":2,"value2":5}', '4')).toBe(true)
    expect(evaluateKnockoutPass('number', '{"op":"between","value":2,"value2":5}', '6')).toBe(false)
  })

  it('number with a non-numeric answer fails', () => {
    expect(evaluateKnockoutPass('number', '{"op":"lte","value":10}', 'abc')).toBe(false)
  })

  it('select passes on any of the passing options', () => {
    const cond = '["Citizen","Permanent Resident"]'
    expect(evaluateKnockoutPass('select', cond, 'Permanent Resident')).toBe(true)
    expect(evaluateKnockoutPass('select', cond, 'Visa needed')).toBe(false)
  })

  it('legacy single-string select answer still works', () => {
    expect(evaluateKnockoutPass('select', 'Citizen', 'Citizen')).toBe(true)
    expect(evaluateKnockoutPass('select', 'Citizen', 'Visa needed')).toBe(false)
  })

  it('missing/blank answer never passes; missing condition always passes', () => {
    expect(evaluateKnockoutPass('yes_no', 'yes', '')).toBe(false)
    expect(evaluateKnockoutPass('yes_no', 'yes', null)).toBe(false)
    expect(evaluateKnockoutPass('number', null, '5')).toBe(true)
  })
})

describe('describeKnockoutAnswer', () => {
  it('summarises conditions for the UI', () => {
    expect(describeKnockoutAnswer('number', '{"op":"lte","value":10000}')).toBe('passes when ≤ 10000')
    expect(describeKnockoutAnswer('select', '["A","B"]')).toBe('passes: A, B')
    expect(describeKnockoutAnswer('yes_no', 'no')).toBe('passes when = no')
  })
})
