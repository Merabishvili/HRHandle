import { describe, it, expect } from 'vitest'
import { deriveCurrentRole, backfillCurrentRole } from '@/lib/cv-parser'
import type { ParsedCVInput } from '@/lib/validations/candidate-background'

type Exp = ParsedCVInput['experience'][number]

function exp(partial: Partial<Exp>): Exp {
  return {
    company: null,
    title: null,
    start_date: null,
    end_date: null,
    is_current: false,
    description: null,
    ...partial,
  }
}

function baseData(partial: Partial<ParsedCVInput>): ParsedCVInput {
  return {
    first_name: null,
    last_name: null,
    email: null,
    phone: null,
    linkedin_profile_url: null,
    location: null,
    timezone: null,
    languages: [],
    salary_expectation: null,
    notice_period: null,
    current_position: null,
    current_company: null,
    experience: [],
    education: [],
    ...partial,
  }
}

describe('deriveCurrentRole', () => {
  it('prefers an explicitly current entry over a more-recently-ended one', () => {
    const result = deriveCurrentRole([
      exp({ title: 'Junior', company: 'Old Co', end_date: '2020-01' }),
      exp({ title: 'Senior', company: 'New Co', is_current: true }),
    ])
    expect(result).toEqual({ title: 'Senior', company: 'New Co' })
  })

  it('picks the latest end date when none is flagged current', () => {
    const result = deriveCurrentRole([
      exp({ title: 'A', company: 'X', end_date: '2019-06' }),
      exp({ title: 'B', company: 'Y', end_date: '2022-03' }),
    ])
    expect(result).toEqual({ title: 'B', company: 'Y' })
  })

  it('treats a missing end date as ongoing (sorts newest)', () => {
    const result = deriveCurrentRole([
      exp({ title: 'A', company: 'X', end_date: '2021-01' }),
      exp({ title: 'B', company: 'Y', end_date: null }),
    ])
    expect(result).toEqual({ title: 'B', company: 'Y' })
  })

  it('falls back to the first-listed entry on ties / missing dates', () => {
    const result = deriveCurrentRole([
      exp({ title: 'First', company: 'F' }),
      exp({ title: 'Second', company: 'S' }),
    ])
    expect(result).toEqual({ title: 'First', company: 'F' })
  })

  it('returns null when there is no usable experience', () => {
    expect(deriveCurrentRole([])).toBeNull()
    expect(deriveCurrentRole([exp({})])).toBeNull()
  })
})

describe('backfillCurrentRole', () => {
  it('fills only the missing field, never overwriting a model value', () => {
    const out = backfillCurrentRole(
      baseData({
        current_position: 'Kept Title',
        current_company: null,
        experience: [exp({ title: 'Derived', company: 'Derived Co', is_current: true })],
      }),
    )
    expect(out.current_position).toBe('Kept Title')
    expect(out.current_company).toBe('Derived Co')
  })

  it('leaves data untouched when both fields are already set', () => {
    const input = baseData({
      current_position: 'T',
      current_company: 'C',
      experience: [exp({ title: 'Other', company: 'Other Co', is_current: true })],
    })
    expect(backfillCurrentRole(input)).toBe(input)
  })

  it('leaves nulls when there is no experience to derive from', () => {
    const out = backfillCurrentRole(baseData({ experience: [] }))
    expect(out.current_position).toBeNull()
    expect(out.current_company).toBeNull()
  })
})
