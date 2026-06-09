'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import { sendApplicationRejectionEmail } from '@/lib/email'
import { writeAuditLog } from '@/lib/audit-log'
import { createOrgNotifications } from '@/lib/actions/notifications'
import {
  MAX_ACTIVE_APPLICATIONS_PER_CANDIDATE,
  APPLICATION_STATUS,
  ACTIVE_APPLICATION_STATUS_CODES,
  CANDIDATE_STATUS,
} from '@/lib/types/constants'

/**
 * A-003: PostgREST's relation embedding sometimes returns a single row as an
 * object and sometimes wrapped in an array (depending on whether the FK is
 * `!inner` and on PostgREST's join inference). This predicate normalises both
 * shapes to a single object so callers can branchlessly compare `.code`.
 */
function unwrapStatusRelation<T extends { code: string }>(
  rel: T | T[] | null | undefined
): T | null {
  if (!rel) return null
  return Array.isArray(rel) ? rel[0] ?? null : rel
}

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

    if (newStatus.code === APPLICATION_STATUS.HIRED) {
      // Moving to Hired → set candidate status to Hired
      const hiredId = statusMap.get(CANDIDATE_STATUS.HIRED)
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
      const hasOtherHired = (hiredApps as AppWithStatus[] || []).some(
        (a) => unwrapStatusRelation(a.application_statuses)?.code === APPLICATION_STATUS.HIRED
      )

      if (!hasOtherHired) {
        const activeId = statusMap.get(CANDIDATE_STATUS.ACTIVE)
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

          if (currentCode === CANDIDATE_STATUS.HIRED) {
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
  if (generalCode && generalCode !== CANDIDATE_STATUS.ACTIVE) {
    return { success: false, error: 'Only active candidates can be added to a vacancy.' }
  }

  // Resolve active application status IDs
  const { data: activeStatusesRaw } = await ctx.supabase
    .from('application_statuses')
    .select('id, code')
    .in('code', ACTIVE_APPLICATION_STATUS_CODES)

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
  const appliedStatus = (activeStatusesRaw || []).find((s) => s.code === APPLICATION_STATUS.APPLIED)
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
  const hasOtherHired = (hiredApps as AppWithStatus[] || []).some(
    (a) => unwrapStatusRelation(a.application_statuses)?.code === APPLICATION_STATUS.HIRED
  )

  if (!hasOtherHired) {
    const { data: candidate } = await ctx.supabase
      .from('candidates')
      .select('general_status_id')
      .eq('id', application.candidate_id)
      .single()

    const currentCode = (candidateStatuses || []).find(
      (s) => s.id === candidate?.general_status_id
    )?.code

    if (currentCode === CANDIDATE_STATUS.HIRED) {
      const activeId = statusMap.get(CANDIDATE_STATUS.ACTIVE)
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

/**
 * Reject multiple applications in one batch — used by the bulk-action toolbar
 * on a vacancy's Candidates tab. Same per-row behaviour as `rejectApplication`
 * (status update, rejection_reason_id + rejection_template_id stamped on the
 * row, candidate's general status synced, optional templated email sent), just
 * iterated. Each application is processed independently, so a failure on one
 * does not block the rest — the caller receives counts of {succeeded, failed}.
 *
 * Implementation note: applications are processed serially rather than in
 * parallel, because the candidate_statuses join inside `rejectApplication`
 * fans out a handful of DB reads per call. At typical batch sizes (5-30
 * applications) the serial latency is fine and we keep the request pattern
 * predictable. If batch sizes grow into the hundreds, this is the obvious
 * place to switch to a chunked Promise.all.
 */
export async function rejectApplicationsBatch(input: {
  applicationIds: string[]
  statusId: string
  rejectionReasonId: string | null
  templateId: string | null
  sendEmail: boolean
}): Promise<
  ActionResult<{ succeeded: number; failed: number; failures: { id: string; error: string }[] }>
> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (input.applicationIds.length === 0) {
    return { success: false, error: 'No applications selected' }
  }

  // De-duplicate the input — if the UI ever double-counts a selection, we
  // shouldn't double-process the rejection.
  const uniqueIds = Array.from(new Set(input.applicationIds))

  let succeeded = 0
  const failures: { id: string; error: string }[] = []

  for (const applicationId of uniqueIds) {
    const result = await rejectApplication({
      applicationId,
      statusId: input.statusId,
      rejectionReasonId: input.rejectionReasonId,
      templateId: input.templateId,
      sendEmail: input.sendEmail,
    })
    if (result.success) {
      succeeded++
    } else {
      failures.push({ id: applicationId, error: result.error })
    }
  }

  // Each rejectApplication call already revalidates the relevant paths, so
  // we don't add another revalidate here — that would just thrash the cache.
  return {
    success: true,
    data: { succeeded, failed: failures.length, failures },
  }
}
