import { z } from 'zod'

export const InterviewSchema = z
  .object({
    candidate_id: z.string().uuid('Invalid candidate'),
    vacancy_id: z.string().uuid('Invalid vacancy'),
    application_id: z.string().uuid().nullable().optional(),
    interviewer_id: z.string().uuid().nullable().optional(),
    scheduled_at: z.string().min(1, 'Scheduled date/time is required'),
    duration_minutes: z.number().int().min(15).max(480).default(60),
    type: z.enum(['phone', 'video', 'onsite']),
  })
  .refine(
    (data) => new Date(data.scheduled_at) > new Date(),
    { message: 'Interview must be scheduled in the future', path: ['scheduled_at'] }
  )

export type InterviewInput = z.infer<typeof InterviewSchema>
