import { describe, it, expect } from 'vitest'
import { VacancySchema, VacancyFormSchema, WORK_MODE_NONE } from '@/lib/validations/vacancy'

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

  // #9 — hiring_manager_id is the real FK link behind the name picker.
  it('accepts a uuid hiring_manager_id', () => {
    const result = VacancySchema.safeParse({
      ...base,
      hiring_manager_id: '11111111-1111-1111-1111-111111111111',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a null / omitted hiring_manager_id', () => {
    expect(VacancySchema.safeParse({ ...base, hiring_manager_id: null }).success).toBe(true)
    expect(VacancySchema.safeParse(base).success).toBe(true)
  })

  it('rejects a non-uuid hiring_manager_id', () => {
    const result = VacancySchema.safeParse({ ...base, hiring_manager_id: 'not-a-uuid' })
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

// ─── VacancyFormSchema (react-hook-form edit form) ────────────────────────────

// The form schema treats optional text/select fields as ''-based strings and
// additionally requires sector + status (the UI enforces both).
const formBase = {
  title: 'Software Engineer',
  sector_id: '11111111-1111-1111-1111-111111111111',
  status_id: '22222222-2222-2222-2222-222222222222',
  department: '',
  location: '',
  employment_type: 'full_time' as const,
  work_mode: WORK_MODE_NONE,
  hiring_manager_name: '',
  salary_min: null,
  salary_max: null,
  salary_currency: 'USD',
  openings_count: 1,
  start_date: tomorrow,
  end_date: null,
  description: 'Build great things.',
  responsibilities: '',
  requirements: '',
  show_on_public_page: false,
}

describe('VacancyFormSchema — required fields', () => {
  it('accepts a minimal valid form', () => {
    expect(VacancyFormSchema.safeParse(formBase).success).toBe(true)
  })

  it('requires a sector (rejects empty sector_id)', () => {
    expect(VacancyFormSchema.safeParse({ ...formBase, sector_id: '' }).success).toBe(false)
  })

  it('requires a status (rejects empty status_id)', () => {
    expect(VacancyFormSchema.safeParse({ ...formBase, status_id: '' }).success).toBe(false)
  })

  it('rejects an empty title', () => {
    expect(VacancyFormSchema.safeParse({ ...formBase, title: '' }).success).toBe(false)
  })

  it('rejects a whitespace-only title (trimmed to empty)', () => {
    expect(VacancyFormSchema.safeParse({ ...formBase, title: '   ' }).success).toBe(false)
  })

  it('rejects an empty start_date', () => {
    expect(VacancyFormSchema.safeParse({ ...formBase, start_date: '' }).success).toBe(false)
  })

  it('rejects an empty description', () => {
    expect(VacancyFormSchema.safeParse({ ...formBase, description: '' }).success).toBe(false)
  })

  it('trims the title on parse', () => {
    const result = VacancyFormSchema.safeParse({ ...formBase, title: '  Engineer  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.title).toBe('Engineer')
  })
})

describe('VacancyFormSchema — work_mode', () => {
  it('accepts the "none" sentinel', () => {
    expect(VacancyFormSchema.safeParse({ ...formBase, work_mode: WORK_MODE_NONE }).success).toBe(true)
  })

  it.each(['remote', 'hybrid', 'onsite'])('accepts %s', (mode) => {
    expect(VacancyFormSchema.safeParse({ ...formBase, work_mode: mode }).success).toBe(true)
  })

  it('rejects an unknown work mode', () => {
    expect(VacancyFormSchema.safeParse({ ...formBase, work_mode: 'anywhere' }).success).toBe(false)
  })
})

describe('VacancyFormSchema — refinements carried over', () => {
  it('rejects salary_max < salary_min on the salary_max path', () => {
    const result = VacancyFormSchema.safeParse({ ...formBase, salary_min: 5000, salary_max: 4000 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path.join('.'))).toContain('salary_max')
    }
  })

  it('rejects end_date before start_date on the end_date path', () => {
    const result = VacancyFormSchema.safeParse({ ...formBase, start_date: tomorrow, end_date: yesterday })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path.join('.'))).toContain('end_date')
    }
  })

  it('rejects openings_count below 1', () => {
    expect(VacancyFormSchema.safeParse({ ...formBase, openings_count: 0 }).success).toBe(false)
  })
})
