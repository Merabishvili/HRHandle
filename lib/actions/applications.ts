'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import { sendApplicationRejectionEmail } from '@/lib/email'
import { writeAuditLog } from '@/lib/audit-log'
import { createOrgNotifications } from '@/lib/actions/notifications'
import { MAX_ACTIVE_APPLICATIONS_PER_CANDIDATE } from '@/lib/types/constants'

export async function updateApplicationStatus(
  applicationId: string,
  newStatusId: string
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  // Fetch application to get candidate_id + previous status code for audit log
  const { data: application } = await ctx.supabase
    .from('applications')
    .select('id, candidate_id, status_id, application_statuses ( code )')
    .eq('id', applicationId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()

  if (!application) return { success: false, error: 'Application not found' }

  type StatusJoin = { code: string } | { code: string }[] | null
  const beforeJoin = application.application_statuses as StatusJoin
  const beforeCode = Array.isArray(beforeJoin) ? beforeJoin[0]?.code : beforeJoin?.code

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

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'application',
    entityId: applicationId,
    action: 'status_changed',
    message:
      beforeCode && newStatus?.code
        ? `${beforeCode} → ${newStatus.code}`
        : `status changed to ${newStatus?.code ?? 'unknown'}`,
    details: {
      candidate_id: application.candidate_id,
      before: beforeCode ?? null,
      after: newStatus?.code ?? null,
    },
  })

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

      // Notify org owners + admins that a candidate was hired (the meaningful
      // stage transition — other stages would be too noisy to ping on every
      // change). Best-effort: failures are logged but never break the action.
      try {
        const [{ data: candidate }, { data: appWithVacancy }, { data: members }] =
          await Promise.all([
            ctx.supabase
              .from('candidates')
              .select('first_name, last_name')
              .eq('id', application.candidate_id)
              .single(),
            ctx.supabase
              .from('applications')
              .select('vacancies ( id, title )')
              .eq('id', applicationId)
              .single(),
            ctx.supabase
              .from('profiles')
              .select('id')
              .eq('organization_id', ctx.orgId)
              .in('role', ['owner', 'admin'])
              .neq('id', ctx.userId),
          ])

        type VacJoin = { id: string; title: string } | { id: string; title: string }[] | null
        const vac = appWithVacancy?.vacancies as VacJoin
        const vacRow = Array.isArray(vac) ? vac[0] : vac

        const recipientIds = (members || []).map((m) => m.id)
        if (recipientIds.length > 0 && candidate) {
          await createOrgNotifications(ctx.orgId, recipientIds, {
            type: 'candidate_hired',
            title: `Candidate hired: ${candidate.first_name} ${candidate.last_name}`,
            body: vacRow?.title ? `For ${vacRow.title}` : undefined,
            link: vacRow?.id ? `/vacancies/${vacRow.id}?tab=applications` : undefined,
          })
        }
      } catch (err) {
        console.error('[applications] candidate-hired notification failed:', err)
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
            .eq('organization_id', ctx.orgId)
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

  // Only active candidates can be linked to a vacancy
  const { data: candidateCheck } = await ctx.supabase
    .from('candidates')
    .select('general_status_id, candidate_statuses(code)')
    .eq('id', input.candidateId)
    .eq('organization_id', ctx.orgId)
    .single()

  const statusesRaw = candidateCheck?.candidate_statuses as { code: string }[] | { code: string } | null
  const generalCode = Array.isArray(statusesRaw) ? statusesRaw[0]?.code : (statusesRaw as { code: string } | null)?.code
  if (generalCode && generalCode !== 'active') {
    return { success: false, error: 'Only active candidates can be added to a vacancy.' }
  }

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

  if ((count ?? 0) >= MAX_ACTIVE_APPLICATIONS_PER_CANDIDATE) {
    return {
      success: false,
      error: `This candidate is already active on ${MAX_ACTIVE_APPLICATIONS_PER_CANDIDATE} vacancies. Move one to Hired or Rejected, or archive it, before adding a new one.`,
    }
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

export async function removeApplication(applicationId: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { error } = await ctx.supabase
    .from('applications')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', applicationId)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to remove application' }

  revalidatePath('/vacancies/[id]', 'page')
  revalidatePath('/candidates/[id]', 'page')
  revalidatePath('/candidates', 'page')
  return { success: true, data: undefined }
}

export async function rejectApplication(input: {
  applicationId: string
  statusId: string
  rejectionReasonId: string | null
  templateId: string | null
  sendEmail: boolean
  customSubject?: string | null
  customBody?: string | null
}): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data: application } = await ctx.supabase
    .from('applications')
    .select('id, candidate_id, vacancy_id, status_id')
    .eq('id', input.applicationId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()

  if (!application) return { success: false, error: 'Application not found' }

  const { error: updateError } = await ctx.supabase
    .from('applications')
    .update({
      status_id: input.statusId,
      rejection_reason_id: input.rejectionReasonId ?? null,
      rejection_template_id: input.templateId ?? null,
      last_status_changed_at: new Date().toISOString(),
    })
    .eq('id', input.applicationId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)

  if (updateError) return { success: false, error: 'Failed to update application status' }

  // Sync candidate general_status (rejected → keep as active unless hired)
  const { data: candidateStatuses } = await ctx.supabase
    .from('candidate_statuses')
    .select('id, code')

  const statusMap = new Map((candidateStatuses || []).map((s) => [s.code, s.id]))

  const { data: hiredApps } = await ctx.supabase
    .from('applications')
    .select('id, application_statuses!inner(code)')
    .eq('candidate_id', application.candidate_id)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .neq('id', input.applicationId)

  type AppWithStatus = { id: string; application_statuses: { code: string } | { code: string }[] | null }
  const hasOtherHired = (hiredApps as AppWithStatus[] || []).some((a) => {
    const s = a.application_statuses
    return s && (Array.isArray(s) ? s[0]?.code === 'hired' : s.code === 'hired')
  })

  if (!hasOtherHired) {
    const { data: candidate } = await ctx.supabase
      .from('candidates')
      .select('general_status_id')
      .eq('id', application.candidate_id)
      .single()

    const currentCode = (candidateStatuses || []).find(
      (s) => s.id === candidate?.general_status_id
    )?.code

    if (currentCode === 'hired') {
      const activeId = statusMap.get('active')
      if (activeId) {
        await ctx.supabase
          .from('candidates')
          .update({ general_status_id: activeId })
          .eq('id', application.candidate_id)
          .eq('organization_id', ctx.orgId)
      }
    }
  }

  if (input.sendEmail) {
    try {
      const [{ data: candidateData }, { data: vacancyData }, { data: orgData }, { data: profileData }] =
        await Promise.all([
          ctx.supabase
            .from('candidates')
            .select('first_name, last_name, email')
            .eq('id', application.candidate_id)
            .eq('organization_id', ctx.orgId)
            .single(),
          ctx.supabase
            .from('vacancies')
            .select('title')
            .eq('id', application.vacancy_id)
            .eq('organization_id', ctx.orgId)
            .single(),
          ctx.supabase
            .from('organizations')
            .select('name')
            .eq('id', ctx.orgId)
            .single(),
          ctx.supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', ctx.userId)
            .single(),
        ])

      // Resolve subject/body: custom override > stored template > built-in default
      let finalSubject: string | undefined = input.customSubject ?? undefined
      let finalBody: string | undefined = input.customBody ?? undefined

      if ((!finalSubject || !finalBody) && input.templateId) {
        const { data: templateData } = await ctx.supabase
          .from('rejection_templates')
          .select('subject, body')
          .eq('id', input.templateId)
          .eq('organization_id', ctx.orgId)
          .single()
        if (templateData) {
          finalSubject = finalSubject ?? templateData.subject
          finalBody = finalBody ?? templateData.body
        }
      }

      if (candidateData?.email && vacancyData && orgData) {
        await sendApplicationRejectionEmail({
          to: candidateData.email,
          candidateName: `${candidateData.first_name} ${candidateData.last_name}`.trim(),
          vacancyTitle: vacancyData.title,
          organizationName: orgData.name,
          senderName: profileData?.full_name ?? orgData.name,
          senderEmail: profileData?.email ?? '',
          customSubject: finalSubject,
          customBody: finalBody,
        })
      }
    } catch (err) {
      // Email failure is non-fatal; status was already updated. Log so the
      // operator can investigate Resend / template / SMTP issues.
      console.error('[applications] rejection email send failed:', err)
    }
  }

  revalidatePath('/vacancies/[id]/pipeline', 'page')
  revalidatePath('/candidates', 'page')
  return { success: true, data: undefined }
}
