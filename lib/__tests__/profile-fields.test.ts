import { describe, it, expect } from 'vitest'
import { parseProfileFields, EMPTY_PROFILE_FIELDS } from '@/lib/candidates/profile-fields'

describe('parseProfileFields', () => {
  it('parses a full parsed-CV profile blob', () => {
    const json = JSON.stringify({
      current_position: 'Senior Engineer',
      current_company: 'Acme',
      salary_expectation: '5000 GEL/month',
      notice_period: '1 month',
      location: 'Tbilisi, Georgia',
      timezone: 'GMT+4',
      languages: ['English', 'Georgian'],
    })
    expect(parseProfileFields(json)).toEqual({
      current_position: 'Senior Engineer',
      current_company: 'Acme',
      salary_expectation: '5000 GEL/month',
      notice_period: '1 month',
      location: 'Tbilisi, Georgia',
      timezone: 'GMT+4',
      languages: ['English', 'Georgian'],
    })
  })

  it('trims empty strings to null and drops blank languages', () => {
    const json = JSON.stringify({
      current_position: '  ',
      current_company: '',
      salary_expectation: '  4000  ',
      languages: ['English', '  ', ''],
    })
    const out = parseProfileFields(json)
    expect(out.current_position).toBeNull()
    expect(out.current_company).toBeNull()
    expect(out.salary_expectation).toBe('4000')
    expect(out.languages).toEqual(['English'])
    expect(out.location).toBeNull()
  })

  it('degrades bad JSON / wrong types to empty defaults (never throws)', () => {
    expect(parseProfileFields('not json')).toEqual(EMPTY_PROFILE_FIELDS)
    expect(parseProfileFields('{}')).toEqual(EMPTY_PROFILE_FIELDS)
    expect(parseProfileFields(JSON.stringify({ languages: 'oops', current_position: 123 }))).toEqual(EMPTY_PROFILE_FIELDS)
  })

  it('drops over-length values to null (catch on max)', () => {
    const out = parseProfileFields(JSON.stringify({ current_position: 'x'.repeat(300) }))
    expect(out.current_position).toBeNull()
  })
})
