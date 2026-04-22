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
    hiring_manager_name: z.string().max(100).nullable().optional(),
    salary_min: z.number().min(0).nullable().optional(),
    salary_max: z.number().min(0).nullable().optional(),
    salary_currency: z.string().length(3).default('USD'),
    openings_count: z.number().int().min(1).default(1),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().nullable().optional(),
    description: z.string().min(1, 'Description is required'),
    requirements: z.string().nullable().optional(),
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
