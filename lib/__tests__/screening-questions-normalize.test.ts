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
      },
      {
        label: 'Notice period?',
        answer_type: 'yes_no',
        is_knockout: false,
        knockout_answer: null,
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

  it('always defaults answer_type to yes_no in Slice 2a', () => {
    const out = normalizeScreeningQuestionEntries([
      { label: 'A', knockout: true },
      { label: 'B', knockout: false },
    ])
    expect(out.every((e) => e.answer_type === 'yes_no')).toBe(true)
  })
})
