import { describe, it, expect } from 'vitest'
import { blankQuestion, supportsKnockout } from '@/components/vacancies/wizard/scorecard-shared'

describe('supportsKnockout', () => {
  it('allows knockout for yes_no / number / select', () => {
    expect(supportsKnockout('yes_no')).toBe(true)
    expect(supportsKnockout('number')).toBe(true)
    expect(supportsKnockout('select')).toBe(true)
  })
  it('disallows knockout for short_text', () => {
    expect(supportsKnockout('short_text')).toBe(false)
  })
})

describe('blankQuestion', () => {
  it('creates an informational (non-knockout) question by default', () => {
    const q = blankQuestion('Do you have a driving licence?', 'yes_no')
    expect(q.knockout).toBe(false)
    expect(q.label).toBe('Do you have a driving licence?')
    expect(q.answerType).toBe('yes_no')
    expect(q.passYesNo).toBe('yes')
    expect(q.passOptions).toEqual([])
  })

  it('leaves passOptions empty for a non-select question even if options are passed', () => {
    expect(blankQuestion('x', 'number', ['a', 'b']).passOptions).toEqual([])
  })

  it('seeds passOptions with the first option for a select question', () => {
    const q = blankQuestion('Location?', 'select', ['Remote', 'Onsite'])
    expect(q.options).toEqual(['Remote', 'Onsite'])
    expect(q.passOptions).toEqual(['Remote'])
  })

  it('leaves passOptions empty for a select question with no options', () => {
    expect(blankQuestion('x', 'select').passOptions).toEqual([])
    expect(blankQuestion('x', 'select', []).passOptions).toEqual([])
  })
})
