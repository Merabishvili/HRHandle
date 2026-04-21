import { z } from 'zod'

export const ApplicationSchema = z.object({
  candidate_id: z.string().uuid('Invalid candidate'),
  vacancy_id: z.string().uuid('Invalid vacancy'),
  status_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export type ApplicationInput = z.infer<typeof ApplicationSchema>
