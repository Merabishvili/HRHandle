import 'server-only'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLogs, type AuditLogEntry } from '@/lib/audit-log'
import { sendApplicationRejectionEmails, type RejectionEmailInput } from '@/lib/email'
import { fetchOrgContentLocale } from '@/lib/i18n/org-locale'
import { isDefaultTemplateContentAnyLocale } from '@/lib/email-template-utils'
import { CANDIDATE_STATUS } from '@/lib/types/constants'
import { resolvePipelineStageId, type LegacyStatusCode } from '@/lib/pipeline-stages/resolve'
import { mapPipelineStageToBucket } from '@/lib/pipeline-stages/bucket'
import { unwrapRelation, type StageRelation } from '@/lib/actions/applications-shared'
import { dispatchWebhookNotification } from '@/lib/notifications/webhook-dispatcher'
import { applicationRejectedCtx, applicationsRejectedCtx } from '@/lib/notifications/event-builders'
import { updateInterviewStatus } from '@/lib/actions/interviews'

export interface RejectionContext {
  supabase: SupabaseClient
  userId: string
  orgId: string
}

export interface RejectionInput {
  applicationIds: string[]
  /** An application_statuses id; its code (normally `rejected`) picks the stage. */
  statusId: string
  rejectionReasonId: string | null
  templateId: string | null
  sendEmail: boolean
  /** Subject/body edited in the dialog — override the template for everyone. */
  customSubject?: string | null | undefined
  customBody?: string | null | undefined
  /** A specific per-vacancy stage (a card dropped on a custom rejection stage).
   * Only honoured for a single application. */
  targetPipelineStageId?: string | null | undefined
  /** Slack/Teams: a message per candidate (single rejection) or one summary. */
  channelMessages: 'each' | 'summary'
}

export interface RejectionOutcome {
  rejected: string[]
  failed: { id: string; error: string }[]
  emailsSent: number
  emailsFailed: number
  /** Rejected candidates who have no email address (no email sent). */
  withoutEmail: number
  interviewsCancelled: number
  offersWithdrawn: number
}

type AppRow = {
  id: string
  candidate_id: string
  vacancy_id: string
  pipeline_stages: StageRelation | StageRelation[] | null
}

/**
 * Rejects applications — the one implementation behind a single rejection,
 * a board selection and "Reject remaining candidates", so they all behave the
 * same. For each application: moves it to its vacancy's Rejected stage with
 * the reason, logs the stage change (audit log + candidate activity), resets a
 * candidate who was Hired only through it, withdraws a live (sent) offer —
 * otherwise the candidate could still accept it — and cancels upcoming
 * interviews (removing meetings HRHandle created). Then, optionally, emails
 * every candidate in batches, and posts to Slack/Teams.
 *
 * Bulk-friendly: one update per vacancy and batched audit rows and emails, so
 * a vacancy's worth of candidates finishes well inside a request.
 */
export async function rejectApplicationsCore(
  ctx: RejectionContext,
  input: RejectionInput,
): Promise<RejectionOutcome> {
  const outcome: RejectionOutcome = {
    rejected: [],
    failed: [],
    emailsSent: 0,
    emailsFailed: 0,
    withoutEmail: 0,
    interviewsCancelled: 0,
    offersWithdrawn: 0,
  }
  const ids = [...new Set(input.applicationIds)]
  if (ids.length === 0) return outcome

  // 1. The applications and their current stage (for the "from → to" log).
  const { data: appRows } = await ctx.supabase
    .from('applications')
    .select('id, candidate_id, vacancy_id, pipeline_stages ( type, name, is_terminal )')
    .in('id', ids)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
  const apps = (appRows ?? []) as AppRow[]
  const found = new Set(apps.map((a) => a.id))
  for (const id of ids) {
    if (!found.has(id)) outcome.failed.push({ id, error: 'Application not found' })
  }
  if (apps.length === 0) return outcome

  // 2. The Rejected stage of each vacancy.
  const { data: statusRow } = await ctx.supabase
    .from('application_statuses')
    .select('code')
    .eq('id', input.statusId)
    .single()
  const targetCode = (statusRow?.code as LegacyStatusCode | undefined) ?? 'rejected'
  const vacancyIds = [...new Set(apps.map((a) => a.vacancy_id))]
  const stageByVacancy = new Map<string, string | null>()
  for (const vacancyId of vacancyIds) {
    stageByVacancy.set(vacancyId, await resolvePipelineStageId(ctx.supabase, vacancyId, targetCode))
  }
  if (input.targetPipelineStageId && apps.length === 1) {
    stageByVacancy.set(apps[0]!.vacancy_id, input.targetPipelineStageId)
  }

  // 3. Move them — one update per vacancy.
  const now = new Date().toISOString()
  const rejectedIds = new Set<string>()
  for (const vacancyId of vacancyIds) {
    const groupIds = apps.filter((a) => a.vacancy_id === vacancyId).map((a) => a.id)
    const payload: Record<string, unknown> = {
      rejection_reason_id: input.rejectionReasonId ?? null,
      rejection_template_id: input.templateId ?? null,
      last_status_changed_at: now,
    }
    const stageId = stageByVacancy.get(vacancyId)
    if (stageId) payload.pipeline_stage_id = stageId
    const { data: updated, error } = await ctx.supabase
      .from('applications')
      .update(payload)
      .in('id', groupIds)
      .eq('organization_id', ctx.orgId)
      .is('deleted_at', null)
      .select('id')
    if (error) {
      for (const id of groupIds) outcome.failed.push({ id, error: 'Failed to update application status' })
      continue
    }
    const done = new Set(((updated ?? []) as { id: string }[]).map((r) => r.id))
    for (const id of groupIds) {
      if (done.has(id)) rejectedIds.add(id)
      else outcome.failed.push({ id, error: 'Failed to update application status' })
    }
  }
  const rejected = apps.filter((a) => rejectedIds.has(a.id))
  outcome.rejected = rejected.map((a) => a.id)
  if (rejected.length === 0) return outcome

  // 4. Log each stage change — the audit log and the candidate's activity show it.
  await writeAuditLogs(
    rejected.map((a): AuditLogEntry => {
      const before = unwrapRelation(a.pipeline_stages)
      const beforeCode = before ? mapPipelineStageToBucket(before) : null
      return {
        orgId: ctx.orgId,
        userId: ctx.userId,
        entityType: 'application',
        entityId: a.id,
        action: 'status_changed',
        message: `${beforeCode ?? 'unknown'} → ${targetCode}`,
        details: {
          candidate_id: a.candidate_id,
          before: beforeCode,
          after: targetCode,
          rejection_reason_id: input.rejectionReasonId ?? null,
        },
      }
    }),
  )

  // 5. A candidate marked Hired only through one of these goes back to Active.
  await resetHiredCandidates(ctx, rejected, rejectedIds)

  // 6. A sent offer must not stay acceptable after a rejection. Service role:
  //    the rejection is the authorised action, the withdrawal its consequence.
  const admin = createAdminClient()
  const { data: withdrawn } = await admin
    .from('offers')
    .update({ status: 'withdrawn', responded_at: now, updated_at: now })
    .in('application_id', outcome.rejected)
    .eq('organization_id', ctx.orgId)
    .eq('status', 'sent')
    .is('deleted_at', null)
    .select('id, application_id')
  const withdrawnOffers = (withdrawn ?? []) as { id: string; application_id: string }[]
  outcome.offersWithdrawn = withdrawnOffers.length
  await writeAuditLogs(
    withdrawnOffers.map((o) => ({
      orgId: ctx.orgId,
      userId: ctx.userId,
      entityType: 'offer',
      entityId: o.id,
      action: 'offer_withdrawn',
      message: 'offer withdrawn (application rejected)',
      details: { application_id: o.application_id, reason: 'application_rejected' },
    })),
  )

  // 7. Upcoming interviews are cancelled — the same as cancelling by hand,
  //    which also removes a Google Calendar event or Zoom meeting HRHandle made.
  const { data: upcoming } = await ctx.supabase
    .from('interviews')
    .select('id')
    .in('application_id', outcome.rejected)
    .eq('organization_id', ctx.orgId)
    .eq('status', 'scheduled')
    .gte('scheduled_at', now)
  for (const interview of (upcoming ?? []) as { id: string }[]) {
    const result = await updateInterviewStatus(interview.id, 'cancelled')
    if (result.success) outcome.interviewsCancelled++
  }

  // 8. Names and titles for the emails and Slack/Teams messages.
  const candidateIds = [...new Set(rejected.map((a) => a.candidate_id))]
  const [{ data: candidateRows }, { data: vacancyRows }] = await Promise.all([
    ctx.supabase
      .from('candidates')
      .select('id, first_name, last_name, email')
      .in('id', candidateIds)
      .eq('organization_id', ctx.orgId),
    ctx.supabase.from('vacancies').select('id, title').in('id', vacancyIds).eq('organization_id', ctx.orgId),
  ])
  const candidateById = new Map(
    ((candidateRows ?? []) as { id: string; first_name: string; last_name: string; email: string | null }[]).map((c) => [c.id, c]),
  )
  const titleByVacancy = new Map(((vacancyRows ?? []) as { id: string; title: string }[]).map((v) => [v.id, v.title]))
  const nameOf = (candidateId: string) => {
    const c = candidateById.get(candidateId)
    return c ? `${c.first_name} ${c.last_name}`.trim() : ''
  }

  // 9. Emails — one personal email per candidate, sent in batches.
  if (input.sendEmail) {
    await emailRejectedCandidates(ctx, input, rejected, { candidateById, titleByVacancy, nameOf }, outcome)
  }

  // 10. Slack / Teams.
  if (input.channelMessages === 'each') {
    for (const a of rejected) {
      await dispatchWebhookNotification(
        ctx.orgId,
        'application_rejected',
        applicationRejectedCtx({
          applicationId: a.id,
          candidateId: a.candidate_id,
          candidateName: nameOf(a.candidate_id) || 'Candidate',
          vacancyTitle: titleByVacancy.get(a.vacancy_id) ?? null,
        }),
      )
    }
  } else {
    const singleVacancy = vacancyIds.length === 1 ? vacancyIds[0]! : null
    await dispatchWebhookNotification(
      ctx.orgId,
      'application_rejected',
      applicationsRejectedCtx({
        count: rejected.length,
        vacancyTitle: singleVacancy ? titleByVacancy.get(singleVacancy) ?? null : null,
        vacancyId: singleVacancy,
      }),
    )
  }

  revalidatePath('/vacancies/[id]/pipeline', 'page')
  revalidatePath('/vacancies/[id]', 'page')
  revalidatePath('/candidates', 'page')
  revalidatePath('/candidates/[id]', 'page')
  revalidatePath('/pipeline', 'page')
  return outcome
}

/** Same rule as before for one rejection, applied to the batch: a candidate
 * whose general status is Hired and who has no other hired application left
 * goes back to Active. */
async function resetHiredCandidates(ctx: RejectionContext, rejected: AppRow[], rejectedIds: Set<string>) {
  const { data: statuses } = await ctx.supabase.from('candidate_statuses').select('id, code')
  const statusRows = (statuses ?? []) as { id: string; code: string }[]
  const hiredId = statusRows.find((s) => s.code === CANDIDATE_STATUS.HIRED)?.id
  const activeId = statusRows.find((s) => s.code === CANDIDATE_STATUS.ACTIVE)?.id
  if (!hiredId || !activeId) return

  const { data: hiredCandidates } = await ctx.supabase
    .from('candidates')
    .select('id')
    .in('id', [...new Set(rejected.map((a) => a.candidate_id))])
    .eq('organization_id', ctx.orgId)
    .eq('general_status_id', hiredId)
  for (const candidate of (hiredCandidates ?? []) as { id: string }[]) {
    const { data: others } = await ctx.supabase
      .from('applications')
      .select('id, pipeline_stages ( type, name, is_terminal )')
      .eq('candidate_id', candidate.id)
      .eq('organization_id', ctx.orgId)
      .is('deleted_at', null)
    const stillHired = ((others ?? []) as { id: string; pipeline_stages: StageRelation | StageRelation[] | null }[]).some(
      (o) => {
        if (rejectedIds.has(o.id)) return false
        const stage = unwrapRelation(o.pipeline_stages)
        return stage ? mapPipelineStageToBucket(stage) === 'hired' : false
      },
    )
    if (!stillHired) {
      await ctx.supabase
        .from('candidates')
        .update({ general_status_id: activeId })
        .eq('id', candidate.id)
        .eq('organization_id', ctx.orgId)
    }
  }
}

async function emailRejectedCandidates(
  ctx: RejectionContext,
  input: RejectionInput,
  rejected: AppRow[],
  lookups: {
    candidateById: Map<string, { email: string | null }>
    titleByVacancy: Map<string, string>
    nameOf: (candidateId: string) => string
  },
  outcome: RejectionOutcome,
) {
  // Subject/body: edited in the dialog > the chosen template > built-in default.
  let subject: string | undefined = input.customSubject ?? undefined
  let body: string | undefined = input.customBody ?? undefined
  if ((!subject || !body) && input.templateId) {
    const { data: template } = await ctx.supabase
      .from('rejection_templates')
      .select('subject, body')
      .eq('id', input.templateId)
      .eq('organization_id', ctx.orgId)
      .single()
    if (template) {
      subject = subject ?? (template.subject as string)
      body = body ?? (template.body as string)
    }
  }
  // An untouched default ("General") template is re-localized to the
  // organization's content language at send time.
  if (subject && body && isDefaultTemplateContentAnyLocale('rejection', subject, body)) {
    subject = undefined
    body = undefined
  }

  const [{ data: org }, { data: sender }, locale] = await Promise.all([
    ctx.supabase.from('organizations').select('name').eq('id', ctx.orgId).single(),
    ctx.supabase.from('profiles').select('full_name, email').eq('id', ctx.userId).single(),
    fetchOrgContentLocale(ctx.supabase, ctx.orgId),
  ])
  if (!org) {
    outcome.emailsFailed += rejected.length
    return
  }
  const orgName = org.name as string
  const emails: RejectionEmailInput[] = []
  for (const a of rejected) {
    const email = lookups.candidateById.get(a.candidate_id)?.email?.trim()
    if (!email) {
      outcome.withoutEmail++
      continue
    }
    emails.push({
      to: email,
      candidateName: lookups.nameOf(a.candidate_id),
      vacancyTitle: lookups.titleByVacancy.get(a.vacancy_id) ?? '',
      organizationName: orgName,
      senderName: (sender?.full_name as string | null) ?? orgName,
      senderEmail: (sender?.email as string | null) ?? '',
      customSubject: subject,
      customBody: body,
      contentLocale: locale,
    })
  }
  const { sent, failed } = await sendApplicationRejectionEmails(emails)
  outcome.emailsSent += sent
  outcome.emailsFailed += failed
}
