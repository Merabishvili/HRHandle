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
  location:           z.string().max(200).nullable().optional(),
  timezone:           z.string().max(100).nullable().optional(),
  languages:          z.array(z.string()).optional(),
  salary_expectation: z.string().max(200).nullable().optional(),
  notice_period:      z.string().max(100).nullable().optional(),
  source:             z.string().max(100).nullable().optional(),
  general_status_id:  z.string().uuid().nullable().optional(),
  linked_vacancy_ids: z.array(z.string().uuid()).optional(),
})

export type CandidateInput = z.infer<typeof CandidateSchema>
