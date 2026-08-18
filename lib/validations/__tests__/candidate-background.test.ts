import { describe, it, expect } from 'vitest'
import {
  ExperienceEntrySchema,
  EducationEntrySchema,
  ParsedCVSchema,
} from '@/lib/validations/candidate-background'

// ─── ExperienceEntrySchema ─────────────────────────────────────────────────────

describe('ExperienceEntrySchema — required fields', () => {
  it('accepts minimal valid input (company + title only)', () => {
    const result = ExperienceEntrySchema.safeParse({ company: 'Acme', title: 'Engineer' })
    expect(result.success).toBe(true)
  })

  it('rejects empty company', () => {
    const result = ExperienceEntrySchema.safeParse({ company: '', title: 'Engineer' })
    expect(result.success).toBe(false)
  })

  it('rejects empty title', () => {
    const result = ExperienceEntrySchema.safeParse({ company: 'Acme', title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing company', () => {
    const result = ExperienceEntrySchema.safeParse({ title: 'Engineer' })
    expect(result.success).toBe(false)
  })
})

describe('ExperienceEntrySchema — is_current defaults', () => {
  it('defaults is_current to false when omitted', () => {
    const result = ExperienceEntrySchema.safeParse({ company: 'Acme', title: 'Dev' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.is_current).toBe(false)
  })

  it('accepts is_current: true', () => {
    const result = ExperienceEntrySchema.safeParse({ company: 'Acme', title: 'Dev', is_current: true })
    expect(result.success).toBe(true)
  })
})

describe('ExperienceEntrySchema — end_date refine', () => {
  it('passes when is_current is true and end_date is missing', () => {
    const result = ExperienceEntrySchema.safeParse({
      company: 'Acme',
      title: 'Dev',
      start_date: '2020-01',
      is_current: true,
    })
    expect(result.success).toBe(true)
  })

  it('fails when start_date is set but end_date is missing and is_current is false', () => {
    const result = ExperienceEntrySchema.safeParse({
      company: 'Acme',
      title: 'Dev',
      start_date: '2020-01',
      is_current: false,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('end_date')
    }
  })

  it('passes when start_date and end_date are both set', () => {
    const result = ExperienceEntrySchema.safeParse({
      company: 'Acme',
      title: 'Dev',
      start_date: '2020-01',
      end_date: '2022-06',
    })
    expect(result.success).toBe(true)
  })

  it('passes when start_date is null (no dates at all)', () => {
    const result = ExperienceEntrySchema.safeParse({
      company: 'Acme',
      title: 'Dev',
      start_date: null,
    })
    expect(result.success).toBe(true)
  })
})

describe('ExperienceEntrySchema — string length limits', () => {
  it('rejects company over 200 chars', () => {
    const result = ExperienceEntrySchema.safeParse({ company: 'A'.repeat(201), title: 'Dev' })
    expect(result.success).toBe(false)
  })

  it('accepts company of exactly 200 chars', () => {
    const result = ExperienceEntrySchema.safeParse({ company: 'A'.repeat(200), title: 'Dev' })
    expect(result.success).toBe(true)
  })

  it('rejects description over 1000 chars', () => {
    const result = ExperienceEntrySchema.safeParse({
      company: 'Acme',
      title: 'Dev',
      description: 'x'.repeat(1001),
    })
    expect(result.success).toBe(false)
  })
})

// ─── EducationEntrySchema ─────────────────────────────────────────────────────

describe('EducationEntrySchema — required fields', () => {
  it('accepts minimal valid input (institution only)', () => {
    const result = EducationEntrySchema.safeParse({ institution: 'MIT' })
    expect(result.success).toBe(true)
  })

  it('rejects empty institution', () => {
    const result = EducationEntrySchema.safeParse({ institution: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing institution', () => {
    const result = EducationEntrySchema.safeParse({ degree: 'BSc' })
    expect(result.success).toBe(false)
  })
})

describe('EducationEntrySchema — is_ongoing defaults', () => {
  it('defaults is_ongoing to false when omitted', () => {
    const result = EducationEntrySchema.safeParse({ institution: 'MIT' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.is_ongoing).toBe(false)
  })
})

describe('EducationEntrySchema — end_year refine', () => {
  it('fails when start_year is set but end_year is missing and is_ongoing is false', () => {
    const result = EducationEntrySchema.safeParse({ institution: 'MIT', start_year: 2015, is_ongoing: false })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('end_year')
    }
  })

  it('passes when is_ongoing is true and end_year is missing', () => {
    const result = EducationEntrySchema.safeParse({ institution: 'MIT', start_year: 2020, is_ongoing: true })
    expect(result.success).toBe(true)
  })

  it('fails when end_year is before start_year', () => {
    const result = EducationEntrySchema.safeParse({ institution: 'MIT', start_year: 2020, end_year: 2018 })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('end_year')
    }
  })

  it('passes when end_year equals start_year', () => {
    const result = EducationEntrySchema.safeParse({ institution: 'MIT', start_year: 2020, end_year: 2020 })
    expect(result.success).toBe(true)
  })
})

describe('EducationEntrySchema — year bounds', () => {
  it('rejects start_year below 1900', () => {
    const result = EducationEntrySchema.safeParse({ institution: 'MIT', start_year: 1899, end_year: 1905 })
    expect(result.success).toBe(false)
  })

  it('accepts start_year of 1900 (boundary)', () => {
    const result = EducationEntrySchema.safeParse({ institution: 'MIT', start_year: 1900, end_year: 1905 })
    expect(result.success).toBe(true)
  })
})

// ─── ParsedCVSchema ────────────────────────────────────────────────────────────

describe('ParsedCVSchema — complete valid payload', () => {
  it('accepts a full parsed CV payload', () => {
    const result = ParsedCVSchema.safeParse({
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      phone: '+1-555-0100',
      linkedin_profile_url: 'https://linkedin.com/in/johndoe',
      current_position: 'Software Engineer',
      current_company: 'Acme Corp',
      experience: [
        {
          company: 'Acme Corp',
          title: 'Engineer',
          start_date: '2020-01',
          end_date: null,
          is_current: true,
          description: 'Backend development',
        },
      ],
      education: [
        {
          institution: 'MIT',
          degree: "Bachelor's",
          field_of_study: 'Computer Science',
          start_year: 2016,
          end_year: 2020,
          is_ongoing: false,
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('defaults experience and education to empty arrays when omitted', () => {
    const result = ParsedCVSchema.safeParse({
      first_name: null,
      last_name: null,
      email: null,
      phone: null,
      linkedin_profile_url: null,
      current_position: null,
      current_company: null,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.experience).toEqual([])
      expect(result.data.education).toEqual([])
    }
  })
})

describe('ParsedCVSchema — graceful handling of invalid values', () => {
  it('coerces invalid email to null (Gemini returns bad value)', () => {
    const result = ParsedCVSchema.safeParse({
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'not-an-email',
      phone: null,
      linkedin_profile_url: null,
      current_position: null,
      current_company: null,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBeNull()
  })

  it('coerces invalid linkedin URL to null', () => {
    const result = ParsedCVSchema.safeParse({
      first_name: null,
      last_name: null,
      email: null,
      phone: null,
      linkedin_profile_url: 'not-a-url',
      current_position: null,
      current_company: null,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.linkedin_profile_url).toBeNull()
  })

  it('coerces invalid start_year string to null in education array', () => {
    const result = ParsedCVSchema.safeParse({
      first_name: null,
      last_name: null,
      email: null,
      phone: null,
      linkedin_profile_url: null,
      current_position: null,
      current_company: null,
      education: [{ institution: 'MIT', degree: null, field_of_study: null, start_year: 'invalid', end_year: null, is_ongoing: false }],
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.education[0]!.start_year).toBeNull()
  })
})
