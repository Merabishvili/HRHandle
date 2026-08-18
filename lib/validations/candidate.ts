import { z } from 'zod'

export const CandidateSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name:  z.string().min(1, 'Last name is required').max(100),
  email: z
    .string()
    .email('Invalid email address')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  phone: z.string().max(30).nullable().optional(),
  linkedin_profile_url: z
    .string()
    .url('Invalid LinkedIn URL')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  current_position:   z.string().max(200).nullable().optional(),
  current_company:    z.string().max(200).nullable().optional(),
  location:           z.string().max(200).nullable().optional(),
  timezone:           z.string().max(100).nullable().optional(),
  languages:          z.array(z.string()).optional(),
  salary_expectation: z.string().max(200).nullable().optional(),
  notice_period:      z.string().max(100).nullable().optional(),
  source:             z.string().max(100).nullable().optional(),
  linked_vacancy_ids: z.array(z.string().uuid()).optional(),
})

export type CandidateInput = z.infer<typeof CandidateSchema>

/**
 * Form-facing schema for the candidate **edit / create** form (react-hook-form).
 *
 * Like `VacancyFormSchema`, this mirrors what the live controls emit: every
 * optional field is a `''`-based string (never `null`), and `languages` is a
 * string array. The submit handler converts `''` → `null` for the server
 * payload (which `CandidateSchema` then validates). Email + LinkedIn are only
 * format-checked when non-empty, matching the server's `.email()` / `.url()`.
 */
export const CandidateFormSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(100),
  last_name: z.string().trim().min(1, 'Last name is required').max(100),
  email: z
    .string()
    .trim()
    .refine((v) => v === '' || z.string().email().safeParse(v).success, 'Invalid email address'),
  phone: z.string().max(30),
  linkedin_profile_url: z
    .string()
    .trim()
    .refine((v) => v === '' || z.string().url().safeParse(v).success, 'Invalid LinkedIn URL'),
  current_position: z.string().max(200),
  current_company: z.string().max(200),
  location: z.string().max(200),
  timezone: z.string().max(100),
  languages: z.array(z.string()),
  salary_expectation: z.string().max(200),
  notice_period: z.string().max(100),
  source: z.string().max(100),
})

export type CandidateFormValues = z.infer<typeof CandidateFormSchema>
