'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, checkPlanLimit, type ActionResult } from './index'
import { CandidateSchema, type CandidateInput } from '@/lib/validations/candidate'
import { ApplicationSchema } from '@/lib/validations/application'

export async function createCandidate(
  input: CandidateInput,
  linkedVacancyId?: string | null
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const limitError = await checkPlanLimit(ctx, 'candidate')
  if (limitError) return { success: false, error: limitError }

  const parsed = CandidateSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  const { linked_vacancy_ids: _, ...candidateData } = parsed.data

  const { data, error } = await ctx.supabase
    .from('candidates')
    .insert({
      ...candidateData,
      email: candidateData.email || null,
      linkedin_profile_url: candidateData.linkedin_profile_url || null,
      organization_id: ctx.orgId,
      created_by: ctx.userId,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: 'Failed to create candidate' }

  if (linkedVacancyId) {
    const appParsed = ApplicationSchema.safeParse({
      candidate_id: data.id,
      vacancy_id: linkedVacancyId,
    })
    if (appParsed.success) {
      await ctx.supabase.from('applications').insert({
        ...appParsed.data,
        organization_id: ctx.orgId,
        created_by: ctx.userId,
      })
    }
  }

  revalidatePath('/candidates')
  return { success: true, data: { id: data.id } }
}

export async function updateCandidate(
  id: string,
  input: CandidateInput
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const parsed = CandidateSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  const { linked_vacancy_ids: _, ...candidateData } = parsed.data

  const { error } = await ctx.supabase
    .from('candidates')
    .update({
      ...candidateData,
      email: candidateData.email || null,
      linkedin_profile_url: candidateData.linkedin_profile_url || null,
    })
    .eq('id', id)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to update candidate' }

  revalidatePath('/candidates')
  revalidatePath(`/candidates/${id}`)
  return { success: true, data: undefined }
}

export async function updateCandidateStatus(
  id: string,
  generalStatusId: string
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { error } = await ctx.supabase
    .from('candidates')
    .update({ general_status_id: generalStatusId })
    .eq('id', id)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to update status' }

  revalidatePath('/candidates')
  revalidatePath(`/candidates/${id}`)
  return { success: true, data: undefined }
}

export async function deleteCandidate(id: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { error } = await ctx.supabase
    .from('candidates')
    .delete()
    .eq('id', id)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to delete candidate' }

  revalidatePath('/candidates')
  return { success: true, data: undefined }
}
