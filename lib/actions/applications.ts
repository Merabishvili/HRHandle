'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'

export async function updateApplicationStatus(
  applicationId: string,
  newStatusId: string
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  // Fetch application to get candidate_id
  const { data: application } = await ctx.supabase
    .from('applications')
    .select('id, candidate_id, status_id')
    .eq('id', applicationId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()

  if (!application) return { success: false, error: 'Application not found' }

  const { error } = await ctx.supabase
    .from('applications')
    .update({
      status_id: newStatusId,
      last_status_changed_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)

  if (error) return { success: false, error: 'Failed to update application status' }

  // Sync candidate general_status based on application pipeline stage
  const { data: newStatus } = await ctx.supabase
    .from('application_statuses')
    .select('code')
    .eq('id', newStatusId)
    .single()

  if (newStatus) {
    const { data: candidateStatuses } = await ctx.supabase
      .from('candidate_statuses')
      .select('id, code')

    const statusMap = new Map((candidateStatuses || []).map((s) => [s.code, s.id]))

    if (newStatus.code === 'hired') {
      // Moving to Hired → set candidate status to Hired
      const hiredId = statusMap.get('hired')
      if (hiredId) {
        await ctx.supabase
          .from('candidates')
          .update({ general_status_id: hiredId })
          .eq('id', application.candidate_id)
          .eq('organization_id', ctx.orgId)
      }
    } else {
      // Moving away from any stage → check if candidate has any other hired application
      const { data: hiredApps } = await ctx.supabase
        .from('applications')
        .select('id, application_statuses!inner(code)')
        .eq('candidate_id', application.candidate_id)
        .eq('organization_id', ctx.orgId)
        .is('deleted_at', null)
        .neq('id', applicationId)

      type AppWithStatus = { id: string; application_statuses: { code: string } | { code: string }[] | null }
      const hasOtherHired = (hiredApps as AppWithStatus[] || []).some((a) => {
        const s = a.application_statuses
        return s && (Array.isArray(s) ? s[0]?.code === 'hired' : s.code === 'hired')
      })

      if (!hasOtherHired) {
        const activeId = statusMap.get('active')
        if (activeId) {
          // Only revert if currently hired (don't override archived)
          const { data: candidate } = await ctx.supabase
            .from('candidates')
            .select('general_status_id')
            .eq('id', application.candidate_id)
            .single()

          const currentCode = (candidateStatuses || []).find(
            (s) => s.id === candidate?.general_status_id
          )?.code

          if (currentCode === 'hired') {
            await ctx.supabase
              .from('candidates')
              .update({ general_status_id: activeId })
              .eq('id', application.candidate_id)
              .eq('organization_id', ctx.orgId)
          }
        }
      }
    }
  }

  revalidatePath('/vacancies/[id]/pipeline', 'page')
  revalidatePath('/candidates', 'page')
  return { success: true, data: undefined }
}

export async function createApplication(input: {
  candidateId: string
  vacancyId: string
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  // Resolve active application status IDs
  const { data: activeStatusesRaw } = await ctx.supabase
    .from('application_statuses')
    .select('id, code')
    .in('code', ['applied', 'screening', 'interview', 'offer'])

  const activeStatusIds = (activeStatusesRaw || []).map((s) => s.id)

  // Count existing active applications for this candidate
  const { count } = await ctx.supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('candidate_id', input.candidateId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .in('status_id', activeStatusIds)

  if ((count ?? 0) >= 5) {
    return { success: false, error: 'This candidate is already being considered for 5 vacancies. Move or close one before adding a new one.' }
  }

  // Prevent duplicate application to the same vacancy
  const { data: existing } = await ctx.supabase
    .from('applications')
    .select('id')
    .eq('candidate_id', input.candidateId)
    .eq('vacancy_id', input.vacancyId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (existing) return { success: false, error: 'This candidate is already being considered for this vacancy.' }

  // Get the "applied" status id
  const appliedStatus = (activeStatusesRaw || []).find((s) => s.code === 'applied')
  if (!appliedStatus) return { success: false, error: 'Application status configuration missing.' }

  const { data, error } = await ctx.supabase
    .from('applications')
    .insert({
      candidate_id: input.candidateId,
      vacancy_id: input.vacancyId,
      organization_id: ctx.orgId,
      status_id: appliedStatus.id,
      applied_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: 'Failed to create application.' }

  revalidatePath(`/candidates/${input.candidateId}`)
  revalidatePath(`/vacancies/${input.vacancyId}`)
  return { success: true, data: { id: data.id } }
}
