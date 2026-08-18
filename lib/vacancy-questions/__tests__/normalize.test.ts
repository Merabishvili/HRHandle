import { describe, it, expect } from 'vitest'
import { normalizeVacancyQuestionEntries } from '@/lib/vacancy-questions/normalize'

describe('normalizeVacancyQuestionEntries', () => {
  it('trims labels and drops empty ones', () => {
    const out = normalizeVacancyQuestionEntries([
      { label: '  Tell us about a project  ', type: 'text' },
      { label: '   ', type: 'score' },
    ])
    expect(out).toEqual([{ label: 'Tell us about a project', type: 'text', mustHave: false }])
  })

  it('drops labels longer than 500 chars', () => {
    expect(normalizeVacancyQuestionEntries([{ label: 'a'.repeat(501), type: 'score' }])).toEqual([])
    expect(normalizeVacancyQuestionEntries([{ label: 'a'.repeat(500), type: 'score' }])).toHaveLength(1)
  })

  it('forces mustHave false for text questions regardless of input', () => {
    expect(normalizeVacancyQuestionEntries([{ label: 'q', type: 'text', mustHave: true }])[0]?.mustHave).toBe(false)
  })

  it('keeps mustHave for score questions', () => {
    expect(normalizeVacancyQuestionEntries([{ label: 'q', type: 'score', mustHave: true }])[0]?.mustHave).toBe(true)
    expect(normalizeVacancyQuestionEntries([{ label: 'q', type: 'score' }])[0]?.mustHave).toBe(false)
  })
})
