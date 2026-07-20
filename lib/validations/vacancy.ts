import { z } from 'zod'

export const VacancySchema = z
  .object({
    title: z.string().min(1, 'Job title is required').max(200),
    sector_id: z.string().uuid('Invalid sector').nullable().optional(),
    status_id: z.string().uuid('Invalid status').nullable().optional(),
    department: z.string().max(100).nullable().optional(),
    location: z.string().max(100).nullable().optional(),
    employment_type: z
      .enum(['full_time', 'part_time', 'contract', 'internship'])
      .nullable()
      .optional(),
    work_mode: z.enum(['remote', 'hybrid', 'onsite']).nullable().optional(),
    hiring_manager_name: z.string().max(100).nullable().optional(),
    salary_min: z.number().min(0).nullable().optional(),
    salary_max: z.number().min(0).nullable().optional(),
    salary_currency: z.string().length(3).default('USD'),
    openings_count: z.number().int().min(1).default(1),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().nullable().optional(),
    description: z.string().min(1, 'About the job is required').max(10000),
    responsibilities: z.string().max(5000).nullable().optional(),
    requirements: z.string().max(5000).nullable().optional(),
    show_on_public_page: z.boolean().optional().default(false),
  })
  .refine(
    (data) =>
      data.salary_min == null ||
      data.salary_max == null ||
      data.salary_max >= data.salary_min,
    { message: 'Maximum salary must be ≥ minimum salary', path: ['salary_max'] }
  )
  .refine(
    (data) =>
      !data.end_date ||
      !data.start_date ||
      new Date(data.end_date) >= new Date(data.start_date),
    { message: 'End date cannot be before start date', path: ['end_date'] }
  )

export type VacancyInput = z.infer<typeof VacancySchema>

/**
 * Sentinel select value for "no work mode chosen". The `work_mode` <Select>
 * can't hold an empty string as an item value (Radix forbids it), so the form
 * uses this token and the submit handler maps it back to `null`.
 */
export const WORK_MODE_NONE = '__none'

/**
 * Form-facing schema for the vacancy **edit** form (react-hook-form).
 *
 * Differs from `VacancySchema` (which shapes the server payload) in two ways:
 *  1. The UI requires a sector + status, so those are non-empty here.
 *  2. Text/select/date fields work in `''`/sentinel terms (an unselected
 *     control is `''`, not `null`) because that's what the inputs emit. The
 *     submit handler converts `''`/`WORK_MODE_NONE` back to `null` for the
 *     server payload.
 *
 * Kept as a separate schema (not derived from `VacancySchema`) because the two
 * genuinely describe different shapes — the server payload is nullable, the
 * live form is string-based.
 */
export const VacancyFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Job title is required').max(200),
    sector_id: z.string().min(1, 'Sector is required'),
    status_id: z.string().min(1, 'Status is required'),
    department: z.string().max(100),
    location: z.string().max(100),
    employment_type: z.enum(['full_time', 'part_time', 'contract', 'internship']),
    work_mode: z.enum(['remote', 'hybrid', 'onsite', WORK_MODE_NONE]),
    hiring_manager_name: z.string().max(100),
    salary_min: z.number().min(0).nullable(),
    salary_max: z.number().min(0).nullable(),
    salary_currency: z.string().length(3),
    openings_count: z.number().int().min(1, 'Openings count must be at least 1'),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().nullable(),
    description: z.string().trim().min(1, 'About the job is required').max(10000),
    responsibilities: z.string().max(5000),
    requirements: z.string().max(5000),
    show_on_public_page: z.boolean(),
  })
  .refine(
    (d) => d.salary_min == null || d.salary_max == null || d.salary_max >= d.salary_min,
    { message: 'Maximum salary must be greater than or equal to minimum salary.', path: ['salary_max'] }
  )
  .refine(
    (d) => !d.end_date || !d.start_date || new Date(d.end_date) >= new Date(d.start_date),
    { message: 'End date cannot be earlier than start date.', path: ['end_date'] }
  )

export type VacancyFormValues = z.infer<typeof VacancyFormSchema>
