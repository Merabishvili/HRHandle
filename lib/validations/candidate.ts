import { z } from 'zod'

export const CandidateSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  date_of_birth: z.string().nullable().optional(),
  email: z
    .string()
    .email('Invalid email address')
    .nullable()
    .optional()
    .or(z.literal('')),
  phone: z.string().max(30).nullable().optional(),
  current_company: z.string().max(200).nullable().optional(),
  current_position: z.string().max(200).nullable().optional(),
  years_of_experience: z.number().min(0).max(60).nullable().optional(),
  linkedin_profile_url: z
    .string()
    .url('Invalid LinkedIn URL')
    .nullable()
    .optional()
    .or(z.literal('')),
  source: z.string().max(100).nullable().optional(),
  general_status_id: z.string().uuid().nullable().optional(),
  linked_vacancy_ids: z.array(z.string().uuid()).optional(),
}).refine(
  (data) => {
    if (!data.date_of_birth) return true
    const dob = new Date(data.date_of_birth)
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 16)
    return dob <= cutoff
  },
  { message: 'Candidate must be at least 16 years old', path: ['date_of_birth'] }
)

export type CandidateInput = z.infer<typeof CandidateSchema>
