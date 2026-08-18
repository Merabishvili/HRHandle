import { describe, it, expect } from 'vitest'
import {
  sanitizeForFitAnalysis,
  redactFreeText,
  type RawFitInput,
} from '@/lib/ai/cv-sanitizer'

describe('redactFreeText', () => {
  it('redacts the candidate own name (case-insensitive, word-boundary)', () => {
    const r = redactFreeText('Jane Doe led the team; JANE shipped it.', 'Jane', 'Doe')
    expect(r.text).toBe('[name] [name] led the team; [name] shipped it.')
    expect(r.found).toContain('name')
  })
  it('does not over-redact a longer word that starts with the name', () => {
    // "Jan" should not nuke "January"
    const r = redactFreeText('Started in January', 'Jan', null)
    expect(r.text).toBe('Started in January')
    expect(r.found).not.toContain('name')
  })
  it('skips 1-character name tokens', () => {
    const r = redactFreeText('A great analyst', 'A', null)
    expect(r.text).toBe('A great analyst')
  })
  it('redacts emails, phones, and URLs as contact_details', () => {
    const r = redactFreeText('Reach me at jane@x.com or +1 555 123 4567, see linkedin.com/in/jane', null, null)
    expect(r.text).toContain('[email]')
    expect(r.text).toContain('[phone]')
    expect(r.text).toContain('[link]')
    expect(r.found).toContain('contact_details')
  })
  it('leaves clean job text untouched', () => {
    const r = redactFreeText('Led process modelling and stakeholder workshops in fintech.', 'Jane', 'Doe')
    expect(r.text).toBe('Led process modelling and stakeholder workshops in fintech.')
    expect(r.found).toEqual([])
  })
})

const base: RawFitInput = {
  firstName: 'Jane',
  lastName: 'Doe',
  yearsOfExperience: 8,
  languages: ['English', 'Georgian'],
  experience: [
    { company: 'TBC Bank', title: 'Business Analyst', start_date: '2018-01', end_date: null, is_current: true, description: 'Jane led process modelling; contact jane@x.com' },
  ],
  education: [
    { institution: 'ISU', degree: 'BSc', field_of_study: 'Economics', start_year: 2012, end_year: 2016 },
  ],
  screeningAnswers: [{ label: 'Salary expectation', answer: '$4.5k — reach me at +1 555 000 1111' }],
  cvText: 'Jane Doe — Senior BA. jane@x.com',
}

describe('sanitizeForFitAnalysis', () => {
  it('keeps only job-relevant structured fields (identity impossible by type)', () => {
    const out = sanitizeForFitAnalysis(base)
    // The output shape has no name/email/phone/photo/location keys at all.
    expect(Object.keys(out).sort()).toEqual(
      ['cvExcerpt', 'education', 'experience', 'languages', 'redactedCategories', 'screeningAnswers', 'yearsOfExperience'].sort(),
    )
    expect(out.yearsOfExperience).toBe(8)
    expect(out.languages).toEqual(['English', 'Georgian'])
    expect(out.education[0]).toMatchObject({ institution: 'ISU', degree: 'BSc', field_of_study: 'Economics' })
  })

  it('redacts name + contact details out of experience descriptions', () => {
    const out = sanitizeForFitAnalysis(base)
    const desc = out.experience[0]?.description ?? ''
    expect(desc).not.toMatch(/Jane/i)
    expect(desc).not.toContain('jane@x.com')
    expect(desc).toContain('[name]')
    expect(desc).toContain('[email]')
  })

  it('redacts screening answers + the CV excerpt', () => {
    const out = sanitizeForFitAnalysis(base)
    expect(out.screeningAnswers[0]?.answer).toContain('[phone]')
    expect(out.screeningAnswers[0]?.answer).toContain('$4.5k') // salary is job-relevant, kept
    expect(out.cvExcerpt).not.toMatch(/Jane/i)
    expect(out.cvExcerpt).toContain('[email]')
  })

  it('reports the categories it stripped for the transparency banner', () => {
    const out = sanitizeForFitAnalysis(base)
    expect(out.redactedCategories).toContain('name')
    expect(out.redactedCategories).toContain('contact_details')
  })

  it('notes name redaction even when the name never appears in free text', () => {
    const out = sanitizeForFitAnalysis({ firstName: 'Giorgi', lastName: 'K', experience: [], cvText: 'clean text' })
    expect(out.redactedCategories).toContain('name')
  })

  it('handles empty / null input without throwing', () => {
    const out = sanitizeForFitAnalysis({})
    expect(out).toMatchObject({
      yearsOfExperience: null,
      languages: [],
      experience: [],
      education: [],
      screeningAnswers: [],
      cvExcerpt: null,
      redactedCategories: [],
    })
  })
})
