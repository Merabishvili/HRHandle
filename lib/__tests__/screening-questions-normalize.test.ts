import { describe, it, expect } from 'vitest'

import { normalizeScreeningQuestionEntries } from '@/lib/screening-questions/normalize'

describe('normalizeScreeningQuestionEntries', () => {
  it('trims labels and drops empty entries', () => {
    const out = normalizeScreeningQuestionEntries([
      { label: '  Eligible to work here?  ', knockout: true },
      { label: '   ' },
      { label: '' },
      { label: 'Notice period?' },
    ])

    expect(out).toEqual([
      {
        label: 'Eligible to work here?',
        answer_type: 'yes_no',
        is_knockout: true,
        knockout_answer: 'yes',
        options: null,
      },
      {
        label: 'Notice period?',
        answer_type: 'yes_no',
        is_knockout: false,
        knockout_answer: null,
        options: null,
      },
    ])
  })

  it('drops labels longer than 500 chars', () => {
    const tooLong = 'x'.repeat(501)
    const out = normalizeScreeningQuestionEntries([
      { label: 'OK', knockout: true },
      { label: tooLong, knockout: true },
    ])

    expect(out).toHaveLength(1)
    expect(out[0]?.label).toBe('OK')
  })

  it('treats missing knockout as false', () => {
    const out = normalizeScreeningQuestionEntries([{ label: 'Anything?' }])
    expect(out[0]?.is_knockout).toBe(false)
    expect(out[0]?.knockout_answer).toBeNull()
  })

  it('returns an empty array when every entry is invalid', () => {
    const out = normalizeScreeningQuestionEntries([{ label: '   ' }, { label: '' }])
    expect(out).toEqual([])
  })

  it('defaults answer_type to yes_no when omitted', () => {
    const out = normalizeScreeningQuestionEntries([
      { label: 'A', knockout: true },
      { label: 'B', knockout: false },
    ])
    expect(out.every((e) => e.answer_type === 'yes_no')).toBe(true)
  })

  it('forces is_knockout=false for short_text type', () => {
    const out = normalizeScreeningQuestionEntries([
      { label: 'Tell us about you', answerType: 'short_text', knockout: true },
    ])
    expect(out[0]).toEqual({
      label: 'Tell us about you',
      answer_type: 'short_text',
      is_knockout: false,
      knockout_answer: null,
      options: null,
    })
  })

  it('number without a passing condition stays informational', () => {
    const out = normalizeScreeningQuestionEntries([
      { label: 'Years of experience?', answerType: 'number', knockout: true },
    ])
    expect(out[0]?.is_knockout).toBe(false)
    expect(out[0]?.knockout_answer).toBeNull()
  })

  it('serialises a number range condition into knockout_answer', () => {
    const out = normalizeScreeningQuestionEntries([
      {
        label: 'Desired salary?',
        answerType: 'number',
        knockout: true,
        knockoutCondition: { kind: 'number', op: 'lte', value: 10000 },
      },
    ])
    expect(out[0]?.is_knockout).toBe(true)
    expect(out[0]?.knockout_answer).toBe('{"op":"lte","value":10000}')
  })

  it('honours the chosen Yes/No passing answer', () => {
    const out = normalizeScreeningQuestionEntries([
      {
        label: 'Any criminal record?',
        answerType: 'yes_no',
        knockout: true,
        knockoutCondition: { kind: 'yes_no', passingAnswer: 'no' },
      },
    ])
    expect(out[0]?.knockout_answer).toBe('no')
  })

  it('cleans select options and serialises the passing subset', () => {
    const out = normalizeScreeningQuestionEntries([
      {
        label: 'Work authorization?',
        answerType: 'select',
        knockout: true,
        options: ['  Citizen ', '', 'Permanent Resident', '   ', 'Visa needed'],
        knockoutCondition: {
          kind: 'select',
          passingOptions: ['Citizen', 'Permanent Resident'],
        },
      },
    ])
    expect(out[0]).toEqual({
      label: 'Work authorization?',
      answer_type: 'select',
      is_knockout: true,
      knockout_answer: '["Citizen","Permanent Resident"]',
      options: ['Citizen', 'Permanent Resident', 'Visa needed'],
    })
  })

  it('select knockout with no condition falls back to the first option', () => {
    const out = normalizeScreeningQuestionEntries([
      {
        label: 'Work authorization?',
        answerType: 'select',
        knockout: true,
        options: ['Citizen', 'Visa needed'],
      },
    ])
    expect(out[0]?.knockout_answer).toBe('["Citizen"]')
  })

  it('drops select entries with no usable options', () => {
    const out = normalizeScreeningQuestionEntries([
      { label: 'A', answerType: 'select', options: ['  ', ''] },
      { label: 'B', answerType: 'select' },
    ])
    expect(out).toEqual([])
  })

  it('select non-knockout sets knockout_answer to null', () => {
    const out = normalizeScreeningQuestionEntries([
      {
        label: 'Preferred shift?',
        answerType: 'select',
        knockout: false,
        options: ['Morning', 'Evening', 'Night'],
      },
    ])
    expect(out[0]?.is_knockout).toBe(false)
    expect(out[0]?.knockout_answer).toBeNull()
    expect(out[0]?.options).toEqual(['Morning', 'Evening', 'Night'])
  })

  it('drops option strings longer than 200 chars but keeps the rest', () => {
    const longOption = 'x'.repeat(201)
    const out = normalizeScreeningQuestionEntries([
      {
        label: 'Pick one',
        answerType: 'select',
        options: ['Short', longOption, 'Also short'],
      },
    ])
    expect(out[0]?.options).toEqual(['Short', 'Also short'])
  })
})
