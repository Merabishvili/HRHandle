'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import { ExperienceEntrySchema, EducationEntrySchema, type ExperienceEntryInput, type EducationEntryInput } from '@/lib/validations/candidate-background'
import type { CandidateExperience, CandidateEducation } from '@/lib/types/candidate'

// Pads "YYYY-MM" dates (from CV parsing / month inputs) to "YYYY-MM-DD" for PostgreSQL DATE columns.
function padDate(date: string | null | undefined): string | null {
  if (!date) return null
  return /^\d{4}-\d{2}$/.test(date) ? `${date}-01` : date
}

// ── Experience ────────────────────────────────────────────────────────────────

export async function getCandidateExperience(
  candidateId: string
): Promise<ActionResult<CandidateExperience[]>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data, error } = await ctx.supabase
    .from('candidate_experience')
    .select('*')
    .eq('candidate_id', candidateId)
    .eq('organization_id', ctx.orgId)
    .order('start_date', { ascending: false, nullsFirst: false })

  if (error) return { success: false, error: 'Failed to load experience' }
  return { success: true, data: data as CandidateExperience[] }
}

export async function createExperienceEntry(
  candidateId: string,
  input: ExperienceEntryInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const parsed = ExperienceEntrySchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  const { data, error } = await ctx.supabase
    .from('candidate_experience')
    .insert({
      organization_id: ctx.orgId,
      candidate_id: candidateId,
      company: parsed.data.company,
      title: parsed.data.title,
      start_date: padDate(parsed.data.start_date),
      end_date: padDate(parsed.data.end_date),
      is_current: parsed.data.is_current,
      description: parsed.data.description ?? null,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: 'Failed to add experience' }

  revalidatePath(`/candidates/${candidateId}`)
  return { success: true, data: { id: data.id } }
}

export async function updateExperienceEntry(
  id: string,
  candidateId: string,
  input: ExperienceEntryInput
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const parsed = ExperienceEntrySchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  const { error } = await ctx.supabase
    .from('candidate_experience')
    .update({
      company: parsed.data.company,
      title: parsed.data.title,
      start_date: padDate(parsed.data.start_date),
      end_date: padDate(parsed.data.end_date),
      is_current: parsed.data.is_current,
      description: parsed.data.description ?? null,
    })
    .eq('id', id)
    .eq('candidate_id', candidateId)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to update experience' }

  revalidatePath(`/candidates/${candidateId}`)
  return { success: true, data: undefined }
}

export async function deleteExperienceEntry(
  id: string,
  candidateId: string
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { error } = await ctx.supabase
    .from('candidate_experience')
    .delete()
    .eq('id', id)
    .eq('candidate_id', candidateId)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to delete experience' }

  revalidatePath(`/candidates/${candidateId}`)
  return { success: true, data: undefined }
}

export async function bulkCreateExperienceEntries(
  candidateId: string,
  entries: ExperienceEntryInput[]
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  // Skip the schema's refine (which requires end_date for non-current entries) because CV-parsed
  // data often has no end_date for past positions. Just require company + title to be non-empty,
  // and pad "YYYY-MM" dates to "YYYY-MM-DD" for PostgreSQL DATE columns.
  const rows = entries
    .filter((e) => e.company?.trim() && e.title?.trim())
    .map((e) => ({
      organization_id: ctx.orgId,
      candidate_id: candidateId,
      company: e.company.trim(),
      title: e.title.trim(),
      start_date: padDate(e.start_date),
      end_date: padDate(e.end_date),
      is_current: e.is_current ?? false,
      description: e.description ?? null,
    }))

  if (rows.length === 0) return { success: true, data: undefined }

  const { error } = await ctx.supabase.from('candidate_experience').insert(rows)
  if (error) return { success: false, error: 'Failed to save experience' }

  revalidatePath(`/candidates/${candidateId}`)
  return { success: true, data: undefined }
}

// ── Education ─────────────────────────────────────────────────────────────────

export async function getCandidateEducation(
  candidateId: string
): Promise<ActionResult<CandidateEducation[]>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data, error } = await ctx.supabase
    .from('candidate_education')
    .select('*')
    .eq('candidate_id', candidateId)
    .eq('organization_id', ctx.orgId)
    .order('start_year', { ascending: false, nullsFirst: false })

  if (error) return { success: false, error: 'Failed to load education' }
  return { success: true, data: data as CandidateEducation[] }
}

export async function createEducationEntry(
  candidateId: string,
  input: EducationEntryInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const parsed = EducationEntrySchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  const { data, error } = await ctx.supabase
    .from('candidate_education')
    .insert({
      organization_id: ctx.orgId,
      candidate_id: candidateId,
      institution: parsed.data.institution,
      degree: parsed.data.degree ?? null,
      field_of_study: parsed.data.field_of_study ?? null,
      start_year: parsed.data.start_year ?? null,
      end_year: parsed.data.end_year ?? null,
      is_ongoing: parsed.data.is_ongoing,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: 'Failed to add education' }

  revalidatePath(`/candidates/${candidateId}`)
  return { success: true, data: { id: data.id } }
}

export async function updateEducationEntry(
  id: string,
  candidateId: string,
  input: EducationEntryInput
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const parsed = EducationEntrySchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  const { error } = await ctx.supabase
    .from('candidate_education')
    .update({
      institution: parsed.data.institution,
      degree: parsed.data.degree ?? null,
      field_of_study: parsed.data.field_of_study ?? null,
      start_year: parsed.data.start_year ?? null,
      end_year: parsed.data.end_year ?? null,
      is_ongoing: parsed.data.is_ongoing,
    })
    .eq('id', id)
    .eq('candidate_id', candidateId)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to update education' }

  revalidatePath(`/candidates/${candidateId}`)
  return { success: true, data: undefined }
}

export async function deleteEducationEntry(
  id: string,
  candidateId: string
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { error } = await ctx.supabase
    .from('candidate_education')
    .delete()
    .eq('id', id)
    .eq('candidate_id', candidateId)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to delete education' }

  revalidatePath(`/candidates/${candidateId}`)
  return { success: true, data: undefined }
}

export async function bulkCreateEducationEntries(
  candidateId: string,
  entries: EducationEntryInput[]
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const rows = entries
    .map((e) => EducationEntrySchema.safeParse(e))
    .filter((r) => r.success)
    .map((r) => ({
      organization_id: ctx.orgId,
      candidate_id: candidateId,
      institution: r.data!.institution,
      degree: r.data!.degree ?? null,
      field_of_study: r.data!.field_of_study ?? null,
      start_year: r.data!.start_year ?? null,
      end_year: r.data!.end_year ?? null,
      is_ongoing: r.data!.is_ongoing,
    }))

  if (rows.length === 0) return { success: true, data: undefined }

  const { error } = await ctx.supabase.from('candidate_education').insert(rows)
  if (error) return { success: false, error: 'Failed to save education' }

  revalidatePath(`/candidates/${candidateId}`)
  return { success: true, data: undefined }
}
