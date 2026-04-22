import { z } from 'zod'

export const ProfileSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').max(100),
  phone: z.string().max(30).nullable().optional(),
})

export const OrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(200),
})

export type ProfileInput = z.infer<typeof ProfileSchema>
export type OrganizationInput = z.infer<typeof OrganizationSchema>
