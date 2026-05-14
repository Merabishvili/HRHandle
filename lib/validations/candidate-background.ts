import { z } from 'zod'

export const ExperienceEntrySchema = z.object({
  company: z.string().min(1, 'Company is required').max(200),
  title: z.string().min(1, 'Title is required').max(200),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  is_current: z.boolean().default(false),
  description: z.string().max(1000).nullable().optional(),
}).refine(
  (d) => d.is_current || d.end_date || !d.start_date,
  { message: 'End date required unless this is a current position', path: ['end_date'] }
)

export const EducationEntrySchema = z.object({
  institution: z.string().min(1, 'Institution is required').max(200),
  degree: z.string().max(100).nullable().optional(),
  field_of_study: z.string().max(200).nullable().optional(),
  start_year: z.number().int().min(1900).max(new Date().getFullYear()).nullable().optional(),
  end_year: z.number().int().min(1900).max(new Date().getFullYear() + 10).nullable().optional(),
  is_ongoing: z.boolean().default(false),
}).refine(
  (d) => d.is_ongoing || d.end_year || !d.start_year,
  { message: 'End year required unless ongoing', path: ['end_year'] }
).refine(
  (d) => !d.start_year || !d.end_year || d.end_year >= d.start_year,
  { message: 'End year must be after start year', path: ['end_year'] }
)

// Schema used by the parse-cv API response validator
export const ParsedCVSchema = z.object({
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  email: z.string().email().nullable().catch(null),
  phone: z.string().nullable(),
  linkedin_profile_url: z.string().url().nullable().catch(null),
  current_position: z.string().nullable(),
  current_company: z.string().nullable(),
  experience: z.array(
    z.object({
      company: z.string().nullable(),
      title: z.string().nullable(),
      start_date: z.string().nullable(),
      end_date: z.string().nullable(),
      is_current: z.boolean().default(false),
      description: z.string().nullable(),
    })
  ).default([]),
  education: z.array(
    z.object({
      institution: z.string().nullable(),
      degree: z.string().nullable(),
      field_of_study: z.string().nullable(),
      start_year: z.number().int().nullable().catch(null),
      end_year: z.number().int().nullable().catch(null),
      is_ongoing: z.boolean().default(false),
    })
  ).default([]),
})

export type ExperienceEntryInput = z.infer<typeof ExperienceEntrySchema>
export type EducationEntryInput = z.infer<typeof EducationEntrySchema>
export type ParsedCVInput = z.infer<typeof ParsedCVSchema>
