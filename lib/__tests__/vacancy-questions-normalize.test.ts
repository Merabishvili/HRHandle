import { describe, it, expect } from 'vitest'

import { normalizeVacancyQuestionEntries } from '@/lib/vacancy-questions/normalize'

describe('normalizeVacancyQuestionEntries', () => {
  it('trims labels and drops empty entries', () => {
    const out = normalizeVacancyQuestionEntries([
      { label: '  Communication  ', type: 'score' },
      { label: '   ', type: 'score' },
      { label: '', type: 'text' },
      { label: 'Tell us about a hard project', type: 'text' },
    ])

    expect(out).toEqual([
      { label: 'Communication', type: 'score', mustHave: false },
      { label: 'Tell us about a hard project', type: 'text', mustHave: false },
    ])
  })

  it('drops labels longer than 500 chars', () => {
    const tooLong = 'x'.repeat(501)
    const out = normalizeVacancyQuestionEntries([
      { label: 'OK', type: 'score' },
      { label: tooLong, type: 'score' },
    ])

    expect(out).toHaveLength(1)
    expect(out[0]?.label).toBe('OK')
  })

  it('forces mustHave=false for text-type rows', () => {
    const out = normalizeVacancyQuestionEntries([
      { label: 'Notes about candidate', type: 'text', mustHave: true },
      { label: 'Stakeholder communication', type: 'score', mustHave: true },
    ])

    expect(out).toEqual([
      { label: 'Notes about candidate', type: 'text', mustHave: false },
      { label: 'Stakeholder communication', type: 'score', mustHave: true },
    ])
  })

  it('treats missing mustHave as false', () => {
    const out = normalizeVacancyQuestionEntries([
      { label: 'A', type: 'score' },
      { label: 'B', type: 'text' },
    ])

    expect(out.every((e) => e.mustHave === false)).toBe(true)
  })

  it('returns an empty array when every entry is invalid', () => {
    const out = normalizeVacancyQuestionEntries([
      { label: '   ', type: 'score' },
      { label: '', type: 'text' },
    ])

    expect(out).toEqual([])
  })
})
