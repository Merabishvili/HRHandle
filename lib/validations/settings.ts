import { z } from 'zod'

export const ProfileSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').max(100),
  phone: z.string().max(30).nullable().optional(),
  language: z.string().max(10).nullable().optional(),
})

export const OrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(200),
  logo_url: z.string().url().nullable().optional(),
  public_page_slug: z
    .string()
    .min(3, 'Public URL must be at least 3 characters')
    .max(60, 'Public URL must be 60 characters or less')
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Only lowercase letters, numbers, and hyphens allowed. Must start and end with a letter or number.')
    .optional(),
})

export type ProfileInput = z.infer<typeof ProfileSchema>
export type OrganizationInput = z.infer<typeof OrganizationSchema>
