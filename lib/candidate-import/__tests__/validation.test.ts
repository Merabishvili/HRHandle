import { describe, it, expect } from 'vitest'
import {
  validateFields,
  validateDataset,
  toCandidateInsert,
  isValidLinkedin,
  isValidSalary,
  type ImportValues,
  type DraftRow,
} from '@/lib/candidate-import/validation'

function values(over: Partial<ImportValues>): ImportValues {
  const base = Object.fromEntries(
    [
      'first_name', 'last_name', 'email', 'phone', 'current_company',
      'current_position', 'years_of_experience', 'linkedin_url', 'location',
      'source', 'languages', 'salary_expectation', 'notice_period',
    ].map((k) => [k, null]),
  ) as ImportValues
  return { ...base, first_name: 'Jane', last_name: 'Doe', ...over }
}

const codes = (errs: { code: string }[]) => errs.map((e) => e.code)

describe('validateFields — required', () => {
  it('flags missing first and last name', () => {
    const errs = validateFields(values({ first_name: null, last_name: '  ' }))
    expect(codes(errs)).toEqual(['firstNameRequired', 'lastNameRequired'])
  })
})

describe('validateFields — email is OPTIONAL', () => {
  it('accepts an empty email', () => {
    expect(validateFields(values({ email: null }))).toEqual([])
  })
  it('rejects a malformed email when present', () => {
    expect(codes(validateFields(values({ email: 'not-an-email' })))).toContain('emailInvalid')
  })
})

describe('validateFields — optional field rules', () => {
  it('phone must have ≥9 digits when present', () => {
    expect(codes(validateFields(values({ phone: '12345' })))).toContain('phoneInvalid')
    expect(validateFields(values({ phone: '+995 599 12 34 56' }))).toEqual([])
  })
  it('years of experience must be an integer 0–60', () => {
    expect(codes(validateFields(values({ years_of_experience: '5.5' })))).toContain('yoeInvalid')
    expect(codes(validateFields(values({ years_of_experience: '99' })))).toContain('yoeInvalid')
    expect(validateFields(values({ years_of_experience: '8' }))).toEqual([])
  })
  it('collects multiple errors on one row', () => {
    const errs = validateFields(values({ first_name: '', phone: '1', years_of_experience: 'x' }))
    expect(codes(errs).sort()).toEqual(['firstNameRequired', 'phoneInvalid', 'yoeInvalid'].sort())
  })
})

describe('isValidLinkedin / isValidSalary', () => {
  it('accepts full URLs and in/handle shape', () => {
    expect(isValidLinkedin('https://www.linkedin.com/in/janedoe/')).toBe(true)
    expect(isValidLinkedin('in/janedoe')).toBe(true)
    expect(isValidLinkedin('linkedin.com/in/x')).toBe(true)
    expect(isValidLinkedin('not a url')).toBe(false)
  })
  it('accepts number + optional currency', () => {
    expect(isValidSalary('4500 GEL')).toBe(true)
    expect(isValidSalary('$5000')).toBe(true)
    expect(isValidSalary('80000')).toBe(true)
    expect(isValidSalary('competitive')).toBe(false)
  })
})

describe('validateDataset — duplicates (only for rows with an email)', () => {
  const rows: DraftRow[] = [
    { csvRow: 1, values: values({ email: 'a@x.com' }) },
    { csvRow: 2, values: values({ email: 'a@x.com' }) }, // in-file dup of row 1
    { csvRow: 3, values: values({ email: 'taken@x.com' }) }, // already in DB
    { csvRow: 4, values: values({ email: null }) }, // no email → never a dup
  ]

  it('flags in-file duplicates on BOTH rows and existing-DB duplicates', () => {
    const out = validateDataset(rows, new Set(['taken@x.com']))
    expect(out[0]!.errors.map((e) => e.code)).toContain('dupInFile')
    expect(out[1]!.errors.map((e) => e.code)).toContain('dupInFile')
    expect(out[2]!.errors.map((e) => e.code)).toContain('dupExisting')
    expect(out[3]!.status).toBe('ready') // email-less row is fine
  })
})

describe('toCandidateInsert', () => {
  it('coerces types for the candidates insert', () => {
    const row = toCandidateInsert(
      values({ email: 'JANE@X.com', years_of_experience: '7', languages: 'English; German', linkedin_url: 'in/jane' }),
      { organization_id: 'org', created_by: 'user', import_id: 'job' },
    )
    expect(row.email).toBe('jane@x.com')
    expect(row.years_of_experience).toBe(7)
    expect(row.languages).toEqual(['English', 'German'])
    expect(row.linkedin_profile_url).toBe('in/jane')
    expect(row.import_id).toBe('job')
  })
})
