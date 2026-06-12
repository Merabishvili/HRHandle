'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, checkPlanLimit, type ActionResult } from './index'
import { CandidateSchema, type CandidateInput } from '@/lib/validations/candidate'
import { ApplicationSchema } from '@/lib/validations/application'
import { writeAuditLog } from '@/lib/audit-log'
import { buildCandidateDeleteAuditDetails } from '@/lib/candidate-delete-cascade'

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
    const { data: vacancyCheck } = await ctx.supabase
      .from('vacancies')
      .select('id')
      .eq('id', linkedVacancyId)
      .eq('organization_id', ctx.orgId)
      .is('deleted_at', null)
      .single()

    if (vacancyCheck) {
      const { data: appliedStatus } = await ctx.supabase
        .from('application_statuses')
        .select('id')
        .eq('code', 'applied')
        .single()

      const appParsed = ApplicationSchema.safeParse({
        candidate_id: data.id,
        vacancy_id: linkedVacancyId,
      })
      if (appParsed.success) {
        await ctx.supabase.from('applications').insert({
          ...appParsed.data,
          organization_id: ctx.orgId,
          created_by: ctx.userId,
          status_id: appliedStatus?.id ?? null,
          applied_at: new Date().toISOString(),
          // Candidate-facing status page token (G-016) — same as other insert paths.
          public_token: crypto.randomUUID().replace(/-/g, ''),
          source_type: 'manual',
        })
      }
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
    .is('deleted_at', null)

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
    .is('deleted_at', null)

  if (error) return { success: false, error: 'Failed to update status' }

  revalidatePath('/candidates')
  revalidatePath(`/candidates/${id}`)
  return { success: true, data: undefined }
}

/** Lightweight pre-confirm read used by the delete dialog so the recruiter
 * sees the impact before they click. Returns the count of non-deleted
 * applications attached to the candidate, org-scoped. */
export async function getCandidateDeleteImpact(
  candidateId: string,
): Promise<ActionResult<{ activeApplicationCount: number }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { count, error } = await ctx.supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('candidate_id', candidateId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)

  if (error) return { success: false, error: 'Failed to load delete impact' }

  return { success: true, data: { activeApplicationCount: count ?? 0 } }
}

export async function deleteCandidate(id: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const now = new Date().toISOString()

  // Cascade-soft-delete the candidate's active applications FIRST. If we
  // soft-delete the candidate first and the application UPDATE fails, the
  // vacancy pipelines briefly show "Unknown candidate" zombie rows (BL-007).
  // The UPDATE ... RETURNING gives us the IDs that were actually changed,
  // which we record in the audit log so a future restore action can put them
  // back. Filtering on `deleted_at IS NULL` makes the action idempotent — a
  // second invocation does not double-count.
  const { data: cascadedApps, error: appsError } = await ctx.supabase
    .from('applications')
    .update({ deleted_at: now })
    .eq('candidate_id', id)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .select('id')

  if (appsError) {
    return { success: false, error: 'Failed to delete candidate applications' }
  }

  const { error } = await ctx.supabase
    .from('candidates')
    .update({ deleted_at: now })
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)

  if (error) return { success: false, error: 'Failed to delete candidate' }

  const applicationIds = (cascadedApps ?? []).map((a) => a.id as string)
  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'candidate',
    entityId: id,
    action: 'candidate_deleted',
    message:
      applicationIds.length === 0
        ? 'candidate soft-deleted'
        : `candidate soft-deleted with ${applicationIds.length} application(s)`,
    details: buildCandidateDeleteAuditDetails(applicationIds),
  })

  revalidatePath('/candidates')
  // Vacancy pipelines may show the candidate's applications — refresh those too.
  revalidatePath('/vacancies/[id]', 'page')
  return { success: true, data: undefined }
}

export async function searchCandidatesForVacancy(
  vacancyId: string,
  query: string
): Promise<ActionResult<{ id: string; first_name: string; last_name: string; email: string | null; current_position: string | null }[]>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const trimmed = query.trim()

  // Get candidate IDs already applied to this vacancy
  const { data: existing } = await ctx.supabase
    .from('applications')
    .select('candidate_id')
    .eq('vacancy_id', vacancyId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)

  const excludeIds = (existing || []).map((a) => a.candidate_id)

  let q = ctx.supabase
    .from('candidates')
    .select('id, first_name, last_name, email, current_position')
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .order('first_name', { ascending: true })
    .limit(20)

  if (excludeIds.length > 0) {
    q = q.not('id', 'in', `(${excludeIds.join(',')})`)
  }

  if (trimmed) {
    q = q.or(
      `first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%`
    )
  }

  const { data, error } = await q

  if (error) return { success: false, error: 'Search failed' }

  return { success: true, data: data || [] }
}
