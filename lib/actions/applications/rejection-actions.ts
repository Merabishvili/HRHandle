'use server'

import { getAuthContext, type ActionResult } from '../index'
import { isOrgAdmin } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit-log'
import { localizeRejectionTemplateRow } from '@/lib/email-template-utils'
import { fetchOrgContentLocale } from '@/lib/i18n/org-locale'
import { rejectApplicationsCore, type RejectionOutcome } from '@/lib/applications/reject-core'
import {
  splitRemaining,
  type RemainingApplicationRow,
  type RemainingCandidate,
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
  /** Still in progress — rejected together (the recruiter can untick some). */
  toReject: RemainingCandidate[]
  /** At an Offer stage — listed, never rejected in bulk. */
  atOffer: RemainingCandidate[]
  reasons: { id: string; name: string }[]
  templates: { id: string; name: string; subject: string; body: string; reason_id: string | null }[]
  /** The canonical "rejected" application status id. */
  rejectedStatusId: string | null
}

async function loadRemaining(
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>,
  vacancyId: string,
): Promise<{ vacancyTitle: string; toReject: RemainingCandidate[]; atOffer: RemainingCandidate[] } | null> {
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
        'id, candidate_id, candidates ( first_name, last_name, email ), pipeline_stages ( type, name, is_terminal, sort_order )',
      )
      .eq('vacancy_id', vacancyId)
      .eq('organization_id', ctx.orgId)
      .is('deleted_at', null),
  ])
  if (!vacancy) return null

  type Row = {
    id: string
    candidate_id: string
    candidates: { first_name: string; last_name: string; email: string | null } | { first_name: string; last_name: string; email: string | null }[] | null
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
      stage: one(r.pipeline_stages),
    }
  })
  return { vacancyTitle: vacancy.title as string, ...splitRemaining(rows) }
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

  const [{ data: reasons }, { data: templates }, { data: rejectedStatus }, locale] = await Promise.all([
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
    fetchOrgContentLocale(ctx.supabase, ctx.orgId),
  ])

  return {
    success: true,
    data: {
      ...remaining,
      reasons: (reasons ?? []) as RemainingRejectionData['reasons'],
      // The untouched default ("General") template previews in the org's language.
      templates: ((templates ?? []) as RemainingRejectionData['templates']).map((t) =>
        localizeRejectionTemplateRow(t, locale),
      ),
      rejectedStatusId: (rejectedStatus?.id as string | undefined) ?? null,
    },
  }
}

/** How many candidates are still in progress — for the prompt after closing a
 * vacancy. 0 for anyone who isn't an owner/admin (they can't act on it). */
export async function countRemainingCandidates(vacancyId: string): Promise<number> {
  const ctx = await getAuthContext()
  if (!ctx || !isOrgAdmin(ctx.role)) return 0
  const remaining = await loadRemaining(ctx, vacancyId)
  return remaining?.toReject.length ?? 0
}

export type RemainingRejectionResult = Omit<RejectionOutcome, 'rejected' | 'failed'> & {
  rejected: number
  failed: number
  /** Ticked candidates who were no longer in progress when confirmed. */
  skipped: number
}

/**
 * Rejects the ticked candidates who are still in progress for this vacancy.
 * Anyone who moved to Offer, Hired or out of the pipeline since the window
 * opened is skipped — the list is re-checked here, not trusted from the client.
 */
export async function rejectRemainingCandidates(input: {
  vacancyId: string
  applicationIds: string[]
  rejectionReasonId: string | null
  templateId: string | null
  sendEmail: boolean
}): Promise<ActionResult<RemainingRejectionResult>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }
  if (!isOrgAdmin(ctx.role)) return { success: false, error: 'Owners and admins only', code: 'FORBIDDEN' }
  if (input.applicationIds.length === 0) {
    return { success: false, error: 'No candidates selected', code: 'VALIDATION' }
  }

  const remaining = await loadRemaining(ctx, input.vacancyId)
  if (!remaining) return { success: false, error: 'Vacancy not found', code: 'NOT_FOUND' }
  const stillInProgress = new Set(remaining.toReject.map((c) => c.applicationId))
  const requested = [...new Set(input.applicationIds)]
  const applicationIds = requested.filter((id) => stillInProgress.has(id))

  const { data: rejectedStatus } = await ctx.supabase
    .from('application_statuses')
    .select('id')
    .eq('code', 'rejected')
    .maybeSingle()
  if (!rejectedStatus) return { success: false, error: 'Rejected status missing', code: 'DB_ERROR' }

  const outcome = applicationIds.length
    ? await rejectApplicationsCore(ctx, {
        applicationIds,
        statusId: rejectedStatus.id as string,
        rejectionReasonId: input.rejectionReasonId,
        templateId: input.templateId,
        sendEmail: input.sendEmail,
        channelMessages: 'summary',
      })
    : null

  if (outcome && outcome.rejected.length > 0) {
    void writeAuditLog({
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityType: 'vacancy',
      entityId: input.vacancyId,
      action: 'applications_bulk_rejected',
      message: `Rejected ${outcome.rejected.length} remaining candidates`,
      details: {
        count: outcome.rejected.length,
        rejection_reason_id: input.rejectionReasonId,
        emails_sent: outcome.emailsSent,
        interviews_cancelled: outcome.interviewsCancelled,
      },
    })
  }

  return {
    success: true,
    data: {
      rejected: outcome?.rejected.length ?? 0,
      failed: outcome?.failed.length ?? 0,
      skipped: requested.length - applicationIds.length,
      emailsSent: outcome?.emailsSent ?? 0,
      emailsFailed: outcome?.emailsFailed ?? 0,
      withoutEmail: outcome?.withoutEmail ?? 0,
      interviewsCancelled: outcome?.interviewsCancelled ?? 0,
      offersWithdrawn: outcome?.offersWithdrawn ?? 0,
    },
  }
}
