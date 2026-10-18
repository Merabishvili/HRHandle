'use server'

import { getAuthContext, type ActionResult } from '../index'
import { isOrgAdmin } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit-log'
import { defaultTemplate, localizeRejectionTemplateRow } from '@/lib/email-template-utils'
import { fetchOrgContentLocale } from '@/lib/i18n/org-locale'
import { rejectApplicationsCore, type RejectionOutcome } from '@/lib/applications/reject-core'
import {
  applicationsToReject,
  groupRemainingByStage,
  remainingTotal,
  type RemainingApplicationRow,
  type RemainingStage,
} from '@/lib/applications/remaining'

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

  const outcome = await rejectApplicationsCore(ctx, {
    applicationIds: [input.applicationId],
    statusId: input.statusId,
    rejectionReasonId: input.rejectionReasonId,
    templateId: input.templateId,
    sendEmail: input.sendEmail,
    customSubject: input.customSubject,
    customBody: input.customBody,
    targetPipelineStageId: input.targetPipelineStageId,
    channelMessages: 'each',
  })
  if (outcome.rejected.length === 0) {
    return { success: false, error: outcome.failed[0]?.error ?? 'Failed to update application status' }
  }
  return { success: true, data: undefined }
}

/**
 * Reject several applications at once — the bulk bar on the pipeline boards.
 * Same per-application behaviour as `rejectApplication` (see
 * `rejectApplicationsCore`), with emails sent in batches and one Slack/Teams
 * summary instead of a message per candidate. Each application succeeds or
 * fails on its own; the caller gets the counts.
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

  const outcome = await rejectApplicationsCore(ctx, {
    applicationIds: input.applicationIds,
    statusId: input.statusId,
    rejectionReasonId: input.rejectionReasonId,
    templateId: input.templateId,
    sendEmail: input.sendEmail,
    channelMessages: 'summary',
  })
  return {
    success: true,
    data: { succeeded: outcome.rejected.length, failed: outcome.failed.length, failures: outcome.failed },
  }
}

// ── Reject remaining candidates (closing a vacancy) ─────────────────────────

export interface RemainingRejectionData {
  vacancyTitle: string
  /** Stages holding candidates still in progress, in board order (Offer included). */
  stages: RemainingStage[]
  reasons: { id: string; name: string }[]
  templates: { id: string; name: string; subject: string; body: string; reason_id: string | null }[]
  /** The default rejection email in the organization's language (no template picked). */
  defaultTemplate: { subject: string; body: string }
  /** For the email preview's placeholders. */
  companyName: string
  senderName: string
  senderEmail: string
  /** The canonical "rejected" application status id. */
  rejectedStatusId: string | null
}

export interface RemainingSummary {
  vacancyTitle: string
  total: number
  stages: { key: string; name: string; count: number; isOffer: boolean }[]
}

type AuthCtx = NonNullable<Awaited<ReturnType<typeof getAuthContext>>>

async function loadRemaining(
  ctx: AuthCtx,
  vacancyId: string,
): Promise<{ vacancyTitle: string; stages: RemainingStage[] } | null> {
  const [{ data: vacancy }, { data: appRows }] = await Promise.all([
    ctx.supabase
      .from('vacancies')
      .select('id, title')
      .eq('id', vacancyId)
      .eq('organization_id', ctx.orgId)
      .is('deleted_at', null)
      .maybeSingle(),
    ctx.supabase
      .from('applications')
      .select(
        'id, candidate_id, pipeline_stage_id, candidates ( first_name, last_name, email ), pipeline_stages ( type, name, is_terminal, sort_order )',
      )
      .eq('vacancy_id', vacancyId)
      .eq('organization_id', ctx.orgId)
      .is('deleted_at', null),
  ])
  if (!vacancy) return null

  type CandidateJoin = { first_name: string; last_name: string; email: string | null }
  type Row = {
    id: string
    candidate_id: string
    pipeline_stage_id: string | null
    candidates: CandidateJoin | CandidateJoin[] | null
    pipeline_stages: RemainingApplicationRow['stage'] | NonNullable<RemainingApplicationRow['stage']>[]
  }
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)
  const rows: RemainingApplicationRow[] = ((appRows ?? []) as Row[]).map((r) => {
    const candidate = one(r.candidates)
    return {
      applicationId: r.id,
      candidateId: r.candidate_id,
      candidateName: candidate ? `${candidate.first_name} ${candidate.last_name}`.trim() : '',
      email: candidate?.email ?? null,
      stageId: r.pipeline_stage_id,
      stage: one(r.pipeline_stages),
    }
  })
  return { vacancyTitle: vacancy.title as string, stages: groupRemainingByStage(rows) }
}

/** Everything the "Reject remaining candidates" window shows. Owners/admins. */
export async function getRemainingRejection(
  vacancyId: string,
): Promise<ActionResult<RemainingRejectionData>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }
  if (!isOrgAdmin(ctx.role)) return { success: false, error: 'Owners and admins only', code: 'FORBIDDEN' }

  const remaining = await loadRemaining(ctx, vacancyId)
  if (!remaining) return { success: false, error: 'Vacancy not found', code: 'NOT_FOUND' }

  const [{ data: reasons }, { data: templates }, { data: rejectedStatus }, { data: org }, { data: me }, locale] =
    await Promise.all([
      ctx.supabase
        .from('rejection_reasons')
        .select('id, name')
        .eq('organization_id', ctx.orgId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      ctx.supabase
        .from('rejection_templates')
        .select('id, name, subject, body, reason_id')
        .eq('organization_id', ctx.orgId)
        .order('sort_order', { ascending: true }),
      ctx.supabase.from('application_statuses').select('id').eq('code', 'rejected').maybeSingle(),
      ctx.supabase.from('organizations').select('name').eq('id', ctx.orgId).single(),
      ctx.supabase.from('profiles').select('full_name, email').eq('id', ctx.userId).single(),
      fetchOrgContentLocale(ctx.supabase, ctx.orgId),
    ])

  const companyName = (org?.name as string | undefined) ?? ''
  const fallback = defaultTemplate('rejection', locale)
  return {
    success: true,
    data: {
      ...remaining,
      reasons: (reasons ?? []) as RemainingRejectionData['reasons'],
      // The untouched default ("General") template previews in the org's language.
      templates: ((templates ?? []) as RemainingRejectionData['templates']).map((t) =>
        localizeRejectionTemplateRow(t, locale),
      ),
      defaultTemplate: { subject: fallback.subject, body: fallback.body },
      companyName,
      senderName: (me?.full_name as string | null) ?? companyName,
      senderEmail: (me?.email as string | null) ?? '',
      rejectedStatusId: (rejectedStatus?.id as string | undefined) ?? null,
    },
  }
}

/**
 * Who is still in progress, per stage — for the "Close vacancy" / "Archive
 * vacancy" question. `null` for anyone who isn't an owner/admin (they can't
 * reject in bulk, so they close without being asked).
 */
export async function getRemainingSummary(vacancyId: string): Promise<RemainingSummary | null> {
  const ctx = await getAuthContext()
  if (!ctx || !isOrgAdmin(ctx.role)) return null
  const remaining = await loadRemaining(ctx, vacancyId)
  if (!remaining) return null
  return {
    vacancyTitle: remaining.vacancyTitle,
    total: remainingTotal(remaining.stages),
    stages: remaining.stages.map((s) => ({ key: s.key, name: s.name, count: s.candidates.length, isOffer: s.isOffer })),
  }
}

export type RemainingRejectionResult = Omit<RejectionOutcome, 'rejected' | 'failed'> & {
  rejected: number
  failed: number
}

/**
 * Rejects the candidates of the ticked stages, minus the exceptions. The list
 * is worked out here from the current pipeline, not trusted from the browser,
 * so someone who moved to an unticked stage since the window opened stays.
 */
export async function rejectRemainingCandidates(input: {
  vacancyId: string
  stageKeys: string[]
  excludedApplicationIds: string[]
  rejectionReasonId: string | null
  templateId: string | null
  sendEmail: boolean
}): Promise<ActionResult<RemainingRejectionResult>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }
  if (!isOrgAdmin(ctx.role)) return { success: false, error: 'Owners and admins only', code: 'FORBIDDEN' }

  const remaining = await loadRemaining(ctx, input.vacancyId)
  if (!remaining) return { success: false, error: 'Vacancy not found', code: 'NOT_FOUND' }
  const applicationIds = applicationsToReject(remaining.stages, input.stageKeys, input.excludedApplicationIds)
  if (applicationIds.length === 0) {
    return { success: false, error: 'No candidates selected', code: 'VALIDATION' }
  }

  const { data: rejectedStatus } = await ctx.supabase
    .from('application_statuses')
    .select('id')
    .eq('code', 'rejected')
    .maybeSingle()
  if (!rejectedStatus) return { success: false, error: 'Rejected status missing', code: 'DB_ERROR' }

  const outcome = await rejectApplicationsCore(ctx, {
    applicationIds,
    statusId: rejectedStatus.id as string,
    rejectionReasonId: input.rejectionReasonId,
    templateId: input.templateId,
    sendEmail: input.sendEmail,
    channelMessages: 'summary',
  })

  if (outcome.rejected.length > 0) {
    void writeAuditLog({
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityType: 'vacancy',
      entityId: input.vacancyId,
      action: 'applications_bulk_rejected',
      message: `Rejected ${outcome.rejected.length} remaining candidates`,
      details: {
        count: outcome.rejected.length,
        stages: input.stageKeys,
        exceptions: input.excludedApplicationIds.length,
        rejection_reason_id: input.rejectionReasonId,
        emails_sent: outcome.emailsSent,
        interviews_cancelled: outcome.interviewsCancelled,
        offers_withdrawn: outcome.offersWithdrawn,
      },
    })
  }

  return {
    success: true,
    data: {
      rejected: outcome.rejected.length,
      failed: outcome.failed.length,
      emailsSent: outcome.emailsSent,
      emailsFailed: outcome.emailsFailed,
      withoutEmail: outcome.withoutEmail,
      interviewsCancelled: outcome.interviewsCancelled,
      offersWithdrawn: outcome.offersWithdrawn,
    },
  }
}
