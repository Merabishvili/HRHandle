'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from '../index'
import { sendApplicationRejectionEmail } from '@/lib/email'
import { fetchOrgContentLocale } from '@/lib/i18n/org-locale'
import { isDefaultTemplateContent } from '@/lib/email-template-utils'
import { APPLICATION_STATUS, CANDIDATE_STATUS } from '@/lib/types/constants'
import {
  resolvePipelineStageId,
  type LegacyStatusCode,
} from '@/lib/pipeline-stages/resolve'
import { mapPipelineStageToBucket } from '@/lib/pipeline-stages/bucket'
import { unwrapRelation, type StageRelation } from '../applications-shared'

export async function rejectApplication(input: {
  applicationId: string
  statusId: string
  rejectionReasonId: string | null
  templateId: string | null
  sendEmail: boolean
  customSubject?: string | null
  customBody?: string | null
  /**
   * Wave 2.6 Slice 2b — specific per-vacancy `pipeline_stages.id` the
   * recruiter dropped onto (e.g. a custom "Closed - not a fit" stage).
   * When set, this overrides the bucket-mapped default so the app
   * lands on the recruiter's exact stage choice. When null, the legacy
   * status's per-vacancy default stage (resolved via `resolvePipelineStageId`)
   * is used.
   */
  targetPipelineStageId?: string | null
}): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data: application } = await ctx.supabase
    .from('applications')
    .select('id, candidate_id, vacancy_id')
    .eq('id', input.applicationId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()

  if (!application) return { success: false, error: 'Application not found' }

  // Wave 2.6 Slice 1 — resolve the per-vacancy 'Rejected' stage. We
  // look up the legacy status's code so this works for any rejection
  // status_id the caller passes, not just the default 'rejected'.
  // Slice 2b adds the override: if the caller passed a specific
  // pipeline_stage_id (drop on a custom rejection stage), trust it.
  const { data: targetStatusRow } = await ctx.supabase
    .from('application_statuses')
    .select('code')
    .eq('id', input.statusId)
    .single()
  const targetCode = (targetStatusRow?.code as LegacyStatusCode | undefined) ?? 'rejected'
  const defaultPipelineStageId = await resolvePipelineStageId(
    ctx.supabase,
    application.vacancy_id,
    targetCode,
  )
  const targetPipelineStageId = input.targetPipelineStageId ?? defaultPipelineStageId

  // Wave 2.6 Slice 4 — status_id is gone; only pipeline_stage_id is set.
  const rejectPayload: Record<string, unknown> = {
    rejection_reason_id: input.rejectionReasonId ?? null,
    rejection_template_id: input.templateId ?? null,
    last_status_changed_at: new Date().toISOString(),
  }
  if (targetPipelineStageId) {
    rejectPayload.pipeline_stage_id = targetPipelineStageId
  }

  const { error: updateError } = await ctx.supabase
    .from('applications')
    .update(rejectPayload)
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
    .select('id, pipeline_stages ( type, name, is_terminal )')
    .eq('candidate_id', application.candidate_id)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .neq('id', input.applicationId)

  type AppWithStage = { id: string; pipeline_stages: StageRelation | StageRelation[] | null }
  const hasOtherHired = ((hiredApps as AppWithStage[] | null) ?? []).some((a) => {
    const row = unwrapRelation(a.pipeline_stages)
    return row ? mapPipelineStageToBucket(row) === APPLICATION_STATUS.HIRED : false
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

      // If the resolved subject/body are still the built-in English default —
      // i.e. the untouched seeded "General" template — drop them so the sender
      // falls back to the localized default for the org's content language.
      if (finalSubject && finalBody && isDefaultTemplateContent('rejection', finalSubject, finalBody)) {
        finalSubject = undefined
        finalBody = undefined
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
          contentLocale: await fetchOrgContentLocale(ctx.supabase, ctx.orgId),
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

