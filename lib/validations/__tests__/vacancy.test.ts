import { describe, it, expect } from 'vitest'
import { VacancySchema } from '@/lib/validations/vacancy'

// Future date helpers
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0]
const dayAfterTomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().split('T')[0]
const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]

const base = {
  title: 'Software Engineer',
  description: 'Build great things.',
  salary_currency: 'USD',
  openings_count: 1,
  start_date: tomorrow,
}

// ─── Required fields ──────────────────────────────────────────────────────────

describe('VacancySchema — required fields', () => {
  it('accepts minimal valid input', () => {
    expect(VacancySchema.safeParse(base).success).toBe(true)
  })

  it('rejects empty title', () => {
    const result = VacancySchema.safeParse({ ...base, title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing title', () => {
    const { title: _, ...rest } = base
    expect(VacancySchema.safeParse(rest).success).toBe(false)
  })

  it('rejects empty description', () => {
    const result = VacancySchema.safeParse({ ...base, description: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing start_date', () => {
    const { start_date: _, ...rest } = base
    expect(VacancySchema.safeParse(rest).success).toBe(false)
  })
})

// ─── Title length ─────────────────────────────────────────────────────────────

describe('VacancySchema — title length', () => {
  it('accepts title of exactly 200 characters (boundary max)', () => {
    const result = VacancySchema.safeParse({ ...base, title: 'A'.repeat(200) })
    expect(result.success).toBe(true)
  })

  it('rejects title of 201 characters', () => {
    const result = VacancySchema.safeParse({ ...base, title: 'A'.repeat(201) })
    expect(result.success).toBe(false)
  })
})

// ─── Salary refinement ────────────────────────────────────────────────────────

describe('VacancySchema — salary_min / salary_max refinement', () => {
  it('accepts salary_min < salary_max', () => {
    const result = VacancySchema.safeParse({ ...base, salary_min: 1000, salary_max: 5000 })
    expect(result.success).toBe(true)
  })

  it('accepts salary_min === salary_max (boundary equal)', () => {
    const result = VacancySchema.safeParse({ ...base, salary_min: 5000, salary_max: 5000 })
    expect(result.success).toBe(true)
  })

  it('rejects salary_min > salary_max', () => {
    const result = VacancySchema.safeParse({ ...base, salary_min: 5000, salary_max: 4999 })
    expect(result.success).toBe(false)
  })

  it('refinement error reported on salary_max path', () => {
    const result = VacancySchema.safeParse({ ...base, salary_min: 10000, salary_max: 1000 })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('salary_max')
    }
  })

  it('accepts when only salary_min is set (max is null)', () => {
    const result = VacancySchema.safeParse({ ...base, salary_min: 5000, salary_max: null })
    expect(result.success).toBe(true)
  })

  it('accepts when only salary_max is set (min is null)', () => {
    const result = VacancySchema.safeParse({ ...base, salary_min: null, salary_max: 10000 })
    expect(result.success).toBe(true)
  })

  it('accepts when both salary values are null', () => {
    const result = VacancySchema.safeParse({ ...base, salary_min: null, salary_max: null })
    expect(result.success).toBe(true)
  })

  it('rejects negative salary_min', () => {
    const result = VacancySchema.safeParse({ ...base, salary_min: -1 })
    expect(result.success).toBe(false)
  })
})

// ─── Openings count ───────────────────────────────────────────────────────────

describe('VacancySchema — openings_count', () => {
  it('accepts 1 (minimum and default)', () => {
    const result = VacancySchema.safeParse({ ...base, openings_count: 1 })
    expect(result.success).toBe(true)
  })

  it('accepts 10', () => {
    const result = VacancySchema.safeParse({ ...base, openings_count: 10 })
    expect(result.success).toBe(true)
  })

  it('rejects 0', () => {
    const result = VacancySchema.safeParse({ ...base, openings_count: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects negative value', () => {
    const result = VacancySchema.safeParse({ ...base, openings_count: -1 })
    expect(result.success).toBe(false)
  })

  it('defaults to 1 when omitted', () => {
    const { openings_count: _, ...rest } = base
    const result = VacancySchema.safeParse(rest)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.openings_count).toBe(1)
  })
})

// ─── Date range refinement ────────────────────────────────────────────────────

describe('VacancySchema — start_date / end_date refinement', () => {
  it('accepts end_date after start_date', () => {
    const result = VacancySchema.safeParse({
      ...base,
      start_date: tomorrow,
      end_date: dayAfterTomorrow,
    })
    expect(result.success).toBe(true)
  })

  it('accepts end_date equal to start_date (boundary)', () => {
    const result = VacancySchema.safeParse({
      ...base,
      start_date: tomorrow,
      end_date: tomorrow,
    })
    expect(result.success).toBe(true)
  })

  it('rejects end_date before start_date', () => {
    const result = VacancySchema.safeParse({
      ...base,
      start_date: tomorrow,
      end_date: yesterday,
    })
    expect(result.success).toBe(false)
  })

  it('refinement error reported on end_date path', () => {
    const result = VacancySchema.safeParse({
      ...base,
      start_date: dayAfterTomorrow,
      end_date: yesterday,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('end_date')
    }
  })

  it('accepts null end_date (optional)', () => {
    const result = VacancySchema.safeParse({ ...base, end_date: null })
    expect(result.success).toBe(true)
  })

  it('accepts omitted end_date (optional)', () => {
    const result = VacancySchema.safeParse(base)
    expect(result.success).toBe(true)
  })
})

// ─── show_on_public_page ──────────────────────────────────────────────────────

describe('VacancySchema — show_on_public_page', () => {
  it('defaults to false when omitted', () => {
    const result = VacancySchema.safeParse(base)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.show_on_public_page).toBe(false)
  })

  it('accepts true', () => {
    const result = VacancySchema.safeParse({ ...base, show_on_public_page: true })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.show_on_public_page).toBe(true)
  })

  it('accepts false explicitly', () => {
    const result = VacancySchema.safeParse({ ...base, show_on_public_page: false })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.show_on_public_page).toBe(false)
  })
})

// ─── employment_type enum ─────────────────────────────────────────────────────

describe('VacancySchema — employment_type', () => {
  it('accepts full_time', () => {
    expect(VacancySchema.safeParse({ ...base, employment_type: 'full_time' }).success).toBe(true)
  })

  it('accepts part_time', () => {
    expect(VacancySchema.safeParse({ ...base, employment_type: 'part_time' }).success).toBe(true)
  })

  it('accepts contract', () => {
    expect(VacancySchema.safeParse({ ...base, employment_type: 'contract' }).success).toBe(true)
  })

  it('accepts internship', () => {
    expect(VacancySchema.safeParse({ ...base, employment_type: 'internship' }).success).toBe(true)
  })

  it('accepts null employment_type (optional)', () => {
    expect(VacancySchema.safeParse({ ...base, employment_type: null }).success).toBe(true)
  })

  it('rejects invalid employment_type value', () => {
    expect(VacancySchema.safeParse({ ...base, employment_type: 'freelance' }).success).toBe(false)
  })
})

// ─── salary_currency ──────────────────────────────────────────────────────────

describe('VacancySchema — salary_currency', () => {
  it('defaults to USD when omitted', () => {
    const { salary_currency: _, ...rest } = base
    const result = VacancySchema.safeParse(rest)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.salary_currency).toBe('USD')
  })

  it('accepts a 3-character currency code', () => {
    const result = VacancySchema.safeParse({ ...base, salary_currency: 'EUR' })
    expect(result.success).toBe(true)
  })

  it('rejects a currency code that is not 3 characters', () => {
    const result = VacancySchema.safeParse({ ...base, salary_currency: 'US' })
    expect(result.success).toBe(false)
  })
})
