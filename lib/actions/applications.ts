'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendApplicationRejectionEmail, sendApplicationStatusChangedEmail } from '@/lib/email'
import { shouldEmailForTransition } from '@/lib/applications-status-emails'
import { writeAuditLog } from '@/lib/audit-log'
import { dispatchWebhookNotification } from '@/lib/notifications/webhook-dispatcher'
import {
  applicationHiredCtx,
  applicationRejectedCtx,
  applicationWithdrawnCtx,
} from '@/lib/notifications/event-builders'
import { createOrgNotifications } from '@/lib/actions/notifications'
import {
  MAX_ACTIVE_APPLICATIONS_PER_CANDIDATE,
  APPLICATION_STATUS,
  CANDIDATE_STATUS,
} from '@/lib/types/constants'
import {
  resolvePipelineStageId,
  type LegacyStatusCode,
} from '@/lib/pipeline-stages/resolve'
import { mapPipelineStageToBucket } from '@/lib/pipeline-stages/bucket'

/**
 * A-003: PostgREST's relation embedding sometimes returns a single row as an
 * object and sometimes wrapped in an array (depending on whether the FK is
 * `!inner` and on PostgREST's join inference). This predicate normalises both
 * shapes to a single object so callers can branchlessly compare `.code`.
 */
/** Normalises an embedded relation (PostgREST returns a single joined row as
 * either an object or a one-element array depending on join inference). */
function unwrapRelation<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null
  return Array.isArray(rel) ? rel[0] ?? null : rel
}

/** Shape of the embedded pipeline_stages row used for bucket-mapping. */
type StageRelation = {
  type: 'standard' | 'review' | 'interview' | 'offer'
  name: string
  is_terminal: boolean
}

export async function updateApplicationStatus(
  applicationId: string,
  newStatusId: string
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  // Fetch application to get candidate_id + previous status code + sort_order for audit log
  // and the auto-email forward-direction gate. Wave 2.6 Slice 1: also
  // pull vacancy_id so we can resolve the per-vacancy pipeline_stages row.
  // Wave 2.6 Slice 4 — applications.status_id is gone (Migration 051), so the
  // previous status is derived from the joined pipeline_stages row, bucket-
  // mapped back to a canonical code. Selecting the dropped status_id here was
  // making this query fail and the whole action no-op ("Application not
  // found") — breaking every status change (board DnD, Review, candidate page).
  const { data: application } = await ctx.supabase
    .from('applications')
    .select(
      'id, candidate_id, vacancy_id, pipeline_stage_id, pipeline_stages ( type, name, is_terminal )',
    )
    .eq('id', applicationId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()

  if (!application) return { success: false, error: 'Application not found' }

  type StageJoin =
    | { type: 'standard' | 'review' | 'interview' | 'offer'; name: string; is_terminal: boolean }
    | { type: 'standard' | 'review' | 'interview' | 'offer'; name: string; is_terminal: boolean }[]
    | null
  const beforeStageJoin = application.pipeline_stages as StageJoin
  const beforeStageRow = Array.isArray(beforeStageJoin) ? beforeStageJoin[0] : beforeStageJoin
  const beforeCode = beforeStageRow ? mapPipelineStageToBucket(beforeStageRow) : undefined

  // sort_order for the forward-email direction gate comes from the canonical
  // application_statuses row matching the bucket code.
  let beforeSortOrder: number | null = null
  if (beforeCode) {
    const { data: beforeStatusRow } = await ctx.supabase
      .from('application_statuses')
      .select('sort_order')
      .eq('code', beforeCode)
      .single()
    beforeSortOrder = beforeStatusRow?.sort_order ?? null
  }

  // Look up the new status's code so we can resolve the matching
  // pipeline_stages row by name in this vacancy. (Pulled before the
  // update so we can write both columns atomically.)
  const { data: newStatusRow } = await ctx.supabase
    .from('application_statuses')
    .select('code, sort_order')
    .eq('id', newStatusId)
    .single()

  const newCode = (newStatusRow?.code as LegacyStatusCode | undefined) ?? null
  const newPipelineStageId = newCode
    ? await resolvePipelineStageId(
        ctx.supabase,
        application.vacancy_id as string,
        newCode,
      )
    : null

  // Wave 2.6 Slice 4 — applications.status_id is gone; we only write
  // pipeline_stage_id. The newStatusId arg still drives audit/email/
  // webhook because we resolve it to a canonical code below.
  const updatePayload: Record<string, unknown> = {
    last_status_changed_at: new Date().toISOString(),
  }
  if (newPipelineStageId) {
    updatePayload.pipeline_stage_id = newPipelineStageId
  }

  const { error } = await ctx.supabase
    .from('applications')
    .update(updatePayload)
    .eq('id', applicationId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)

  if (error) return { success: false, error: 'Failed to update application status' }

  // Reuse the lookup we already did above so the rest of the function
  // (audit log + candidate-status sync + webhooks + auto-email) sees
  // the same status row.
  const newStatus = newStatusRow

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

  if (newStatus && beforeCode !== newStatus.code) {
    const eventForCode: Record<string, 'application_hired' | 'application_rejected' | 'application_withdrawn'> = {
      hired: 'application_hired',
      rejected: 'application_rejected',
      withdrawn: 'application_withdrawn',
    }
    const eventKey = eventForCode[newStatus.code]
    if (eventKey) {
      try {
        const { data: row } = await ctx.supabase
          .from('applications')
          .select('candidate_id, candidates(first_name, last_name), vacancies(title)')
          .eq('id', applicationId)
          .single()
        if (row) {
          const cand = (row as unknown as { candidates: { first_name: string; last_name: string } | null }).candidates
          const vac = (row as unknown as { vacancies: { title: string } | null }).vacancies
          const ctxPayload = {
            applicationId,
            candidateId: row.candidate_id as string,
            candidateName: cand ? `${cand.first_name} ${cand.last_name}`.trim() : 'Candidate',
            vacancyTitle: vac?.title ?? null,
          }
          const builder =
            eventKey === 'application_hired'
              ? applicationHiredCtx
              : eventKey === 'application_rejected'
                ? applicationRejectedCtx
                : applicationWithdrawnCtx
          await dispatchWebhookNotification(ctx.orgId, eventKey, builder(ctxPayload))
        }
      } catch (err) {
        console.error('[applications] webhook dispatch failed:', err)
      }
    }
  }

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
        .select('id, pipeline_stages ( type, name, is_terminal )')
        .eq('candidate_id', application.candidate_id)
        .eq('organization_id', ctx.orgId)
        .is('deleted_at', null)
        .neq('id', applicationId)

      type AppWithStage = { id: string; pipeline_stages: StageRelation | StageRelation[] | null }
      const hasOtherHired = ((hiredApps as AppWithStage[] | null) ?? []).some((a) => {
        const row = unwrapRelation(a.pipeline_stages)
        return row ? mapPipelineStageToBucket(row) === APPLICATION_STATUS.HIRED : false
      })

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

  // ── G-017: Auto-email the candidate on a forward move into screening or
  // interview, if the org has opted in by saving a template row for that type.
  // Wrapped end-to-end in try/catch — email failures must never block the
  // status update or surface as a user-facing error.
  try {
    const target = shouldEmailForTransition(
      beforeCode,
      newStatus?.code,
      beforeSortOrder,
      newStatus?.sort_order ?? null,
    )

    if (target) {
      // Lookup the org's template row. If absent, opt-IN is OFF → skip.
      const { data: templateRow } = await ctx.supabase
        .from('email_templates')
        .select('subject, body, is_enabled')
        .eq('organization_id', ctx.orgId)
        .eq('template_type', target.type)
        .maybeSingle()

      if (templateRow && templateRow.is_enabled !== false) {
        const [{ data: candidate }, { data: appJoin }, { data: org }] = await Promise.all([
          ctx.supabase
            .from('candidates')
            .select('first_name, last_name, email')
            .eq('id', application.candidate_id)
            .single(),
          ctx.supabase
            .from('applications')
            .select('public_token, vacancies ( title )')
            .eq('id', applicationId)
            .single(),
          ctx.supabase
            .from('organizations')
            .select('name')
            .eq('id', ctx.orgId)
            .single(),
        ])

        type VacJoin = { title: string } | { title: string }[] | null
        const vac = appJoin?.vacancies as VacJoin
        const vacancyTitle = (Array.isArray(vac) ? vac[0]?.title : vac?.title) ?? 'the role'
        const publicToken = (appJoin?.public_token as string | null | undefined) ?? null

        if (candidate?.email) {
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
          await sendApplicationStatusChangedEmail({
            to: candidate.email,
            candidateName: `${candidate.first_name ?? ''} ${candidate.last_name ?? ''}`.trim() || 'there',
            vacancyTitle,
            organizationName: org?.name || 'the company',
            stage: target.stage,
            statusUrl: publicToken ? `${baseUrl}/status/${publicToken}` : undefined,
            customSubject: templateRow.subject || undefined,
            customBody: templateRow.body || undefined,
          })

          void writeAuditLog({
            orgId: ctx.orgId,
            userId: ctx.userId,
            entityType: 'application',
            entityId: applicationId,
            action: 'status_change_email_sent',
            message: `auto-email sent for transition to ${newStatus?.code ?? target.stage}`,
            details: {
              candidate_id: application.candidate_id,
              stage: target.stage,
            },
          })
        }
      }
    }
  } catch (err) {
    console.error('[applications] status-change auto-email failed:', err)
  }

  revalidatePath('/vacancies/[id]/pipeline', 'page')
  revalidatePath('/candidates', 'page')
  return { success: true, data: undefined }
}

/**
 * Wave 2.6 Slice 2b — move an application onto a specific per-vacancy
 * pipeline_stages row. The recruiter's per-vacancy board calls this on
 * every drop so the app's `pipeline_stage_id` ends up at the EXACT stage
 * they dropped on (preserves custom-stage names like "Sourced",
 * "Closed - not a fit"), while the legacy `status_id` is mirrored to the
 * canonical bucket via the shared mapper.
 *
 * Internally this delegates to `updateApplicationStatus` to reuse the
 * audit log + candidate-status sync + webhook + opt-in auto-email
 * machinery (all keyed off the canonical code). After that succeeds we
 * overwrite `pipeline_stage_id` with the recruiter's specific choice
 * (updateApplicationStatus' bucket-mapped pipeline_stage_id would
 * otherwise collapse to the default per-vacancy stage with that code).
 */
export async function updateApplicationPipelineStage(
  applicationId: string,
  newPipelineStageId: string,
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  // Resolve the target stage so we know which canonical bucket it
  // belongs to. RLS scopes the row to the caller's org.
  const { data: stageRow } = await ctx.supabase
    .from('pipeline_stages')
    .select('id, name, type, is_terminal')
    .eq('id', newPipelineStageId)
    .eq('organization_id', ctx.orgId)
    .single()

  if (!stageRow) return { success: false, error: 'Pipeline stage not found' }

  const canonicalCode = mapPipelineStageToBucket({
    type: stageRow.type as 'standard' | 'review' | 'interview' | 'offer',
    name: stageRow.name as string,
    is_terminal: stageRow.is_terminal as boolean,
  })

  // Look up the canonical application_statuses.id for the mapped code.
  const { data: canonicalStatus } = await ctx.supabase
    .from('application_statuses')
    .select('id')
    .eq('code', canonicalCode)
    .single()

  if (!canonicalStatus) return { success: false, error: 'Status configuration missing' }

  // Fire the canonical-status update (audit / email / webhook / candidate
  // status sync all hang off this). It also writes a bucket-mapped
  // `pipeline_stage_id` — we overwrite that next so the app lands on the
  // SPECIFIC stage the recruiter chose, not the canonical default.
  const result = await updateApplicationStatus(applicationId, canonicalStatus.id)
  if (!result.success) return result

  const { error: stageErr } = await ctx.supabase
    .from('applications')
    .update({ pipeline_stage_id: newPipelineStageId })
    .eq('id', applicationId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)

  if (stageErr) {
    console.error('[applications] pipeline_stage_id override failed:', stageErr.message)
    return { success: false, error: 'Failed to set pipeline stage' }
  }

  revalidatePath('/vacancies/[id]/pipeline', 'page')
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

  // Count existing active applications for this candidate. Wave 2.6 Slice 4 —
  // status_id is gone; "active" now means the application's pipeline_stage is
  // non-terminal (applied / screening / interview / offer), so we count via
  // the joined pipeline_stages row.
  const { count } = await ctx.supabase
    .from('applications')
    .select('id, pipeline_stages!inner(is_terminal)', { count: 'exact', head: true })
    .eq('candidate_id', input.candidateId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .eq('pipeline_stages.is_terminal', false)

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

  // Wave 2.6 Slice 4 — applications.status_id is gone. We only resolve
  // the per-vacancy "Applied" pipeline_stages row and set pipeline_stage_id.
  const pipelineStageId = await resolvePipelineStageId(
    ctx.supabase,
    input.vacancyId,
    'applied',
  )

  // public_token is the candidate-facing status page key (G-016) — generated
  // for every new application, including recruiter-added ones, so the link
  // exists if the recruiter chooses to share it.
  const publicToken = crypto.randomUUID().replace(/-/g, '')
  const { data, error } = await ctx.supabase
    .from('applications')
    .insert({
      candidate_id: input.candidateId,
      vacancy_id: input.vacancyId,
      organization_id: ctx.orgId,
      pipeline_stage_id: pipelineStageId,
      applied_at: new Date().toISOString(),
      public_token: publicToken,
      source_type: 'manual',
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: 'Failed to create application.' }

  revalidatePath(`/candidates/${input.candidateId}`)
  revalidatePath(`/vacancies/${input.vacancyId}`)
  return { success: true, data: { id: data.id } }
}

/** Candidate-side withdraw via the public status-page token (G-022). Token is
 * the credential — same risk model as G-016. Idempotent: a second call on an
 * already-withdrawn application is a no-op. Cancels any active offer so a
 * stale Accept button never re-appears on /offer/<token>. */
export async function withdrawApplicationByToken(
  token: string,
  reason: string | null = null,
): Promise<ActionResult<void>> {
  // Defensive token shape check before any DB hit.
  if (!token || !/^[a-f0-9]{16,64}$/i.test(token)) {
    return { success: false, error: 'Invalid token' }
  }

  // Token-gated; bypass RLS deliberately, mirroring G-016 + G-018.
  const admin = createAdminClient()

  const { data: app, error: appErr } = await admin
    .from('applications')
    .select(
      `id, candidate_id, vacancy_id, organization_id, deleted_at, pipeline_stage_id,
       pipeline_stages ( type, name, is_terminal )`,
    )
    .eq('public_token', token)
    .maybeSingle()
  if (appErr) {
    console.error('[applications] withdraw lookup failed:', appErr.message)
    return { success: false, error: 'Failed to load application' }
  }
  if (!app || app.deleted_at) {
    return { success: false, error: 'Application not found' }
  }

  // Wave 2.6 Slice 4 — previous status derived from the pipeline_stages join
  // (status_id is gone), bucket-mapped to a canonical code.
  const beforeStageRow = unwrapRelation(app.pipeline_stages as StageRelation | StageRelation[] | null)
  const beforeCode = beforeStageRow ? mapPipelineStageToBucket(beforeStageRow) : undefined

  // Block self-withdraw from terminal states. `withdrawn` is a no-op success
  // so a double-submit on the candidate UI is harmless; the other terminals
  // (hired / rejected) are recruiter-decided and shouldn't be overridable.
  const TERMINAL: ReadonlySet<string> = new Set([
    APPLICATION_STATUS.HIRED,
    APPLICATION_STATUS.REJECTED,
  ])
  if (beforeCode === APPLICATION_STATUS.WITHDRAWN) {
    return { success: true, data: undefined }
  }
  if (beforeCode && TERMINAL.has(beforeCode)) {
    return {
      success: false,
      error: 'This application can no longer be withdrawn. Contact the recruiter directly.',
    }
  }

  // Wave 2.6 Slice 4 — resolve the per-vacancy 'Withdrawn' stage; that's
  // the only column we set now (status_id is gone).
  const withdrawnPipelineStageId = await resolvePipelineStageId(
    admin,
    app.vacancy_id as string,
    'withdrawn',
  )

  const now = new Date().toISOString()

  const withdrawPayload: Record<string, unknown> = {
    last_status_changed_at: now,
  }
  if (withdrawnPipelineStageId) {
    withdrawPayload.pipeline_stage_id = withdrawnPipelineStageId
  }

  const { error: updateErr } = await admin
    .from('applications')
    .update(withdrawPayload)
    .eq('id', app.id as string)
    .eq('organization_id', app.organization_id as string)
  if (updateErr) {
    console.error('[applications] withdraw update failed:', updateErr.message)
    return { success: false, error: 'Failed to withdraw' }
  }

  // Cancel any active offer so the candidate doesn't accidentally accept one
  // after withdrawing the underlying application.
  const { data: liveOffers } = await admin
    .from('offers')
    .select('id')
    .eq('application_id', app.id as string)
    .eq('organization_id', app.organization_id as string)
    .is('deleted_at', null)
    .in('status', ['draft', 'sent'])
  const liveOfferIds = (liveOffers ?? []).map((o) => o.id as string)
  if (liveOfferIds.length > 0) {
    await admin
      .from('offers')
      .update({
        status: 'withdrawn',
        responded_at: now,
        updated_at: now,
      })
      .in('id', liveOfferIds)
  }

  void writeAuditLog({
    orgId: app.organization_id as string,
    userId: null,
    entityType: 'application',
    entityId: app.id as string,
    action: 'application_withdrawn',
    message: 'application withdrawn by candidate',
    details: {
      via: 'candidate_token',
      before: beforeCode ?? null,
      has_reason: !!reason,
      cancelled_offers: liveOfferIds.length,
    },
  })

  // Notify owners + admins (best-effort).
  try {
    const { data: members } = await admin
      .from('profiles')
      .select('id')
      .eq('organization_id', app.organization_id as string)
      .in('role', ['owner', 'admin'])
    const recipientIds = (members ?? []).map((m) => m.id as string)
    if (recipientIds.length > 0) {
      await createOrgNotifications(app.organization_id as string, recipientIds, {
        type: 'application_withdrawn',
        title: 'A candidate withdrew their application',
        body: undefined,
        link: app.candidate_id ? `/candidates/${app.candidate_id as string}` : undefined,
      })
    }
  } catch (err) {
    console.error('[applications] withdraw notification failed:', err)
  }

  try {
    const { data: cand } = await admin
      .from('candidates')
      .select('first_name, last_name')
      .eq('id', app.candidate_id as string)
      .single()
    const { data: vac } = await admin
      .from('applications')
      .select('vacancies(title)')
      .eq('id', app.id as string)
      .single()
    const vacTitle = (vac as unknown as { vacancies: { title: string } | null } | null)?.vacancies?.title ?? null
    await dispatchWebhookNotification(
      app.organization_id as string,
      'application_withdrawn',
      applicationWithdrawnCtx({
        applicationId: app.id as string,
        candidateId: app.candidate_id as string,
        candidateName: cand ? `${cand.first_name} ${cand.last_name}`.trim() : 'Candidate',
        vacancyTitle: vacTitle,
      })
    )
  } catch (err) {
    console.error('[applications] withdraw webhook failed:', err)
  }

  return { success: true, data: undefined }
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

/** Defensive upper bound for one bulk-move call. With ~100ms per
 * updateApplicationStatus call (auth lookup + status update + audit log +
 * candidate-status sync + optional email), 50 rows ≈ 5s — sits comfortably
 * inside Vercel's serverless timeout. If batch sizes ever grow past this,
 * the obvious next step is to lift `getAuthContext` out of the per-row
 * call (mirrors the same future refactor sketched on `rejectApplicationsBatch`). */
const MAX_BULK_MOVE_BATCH = 50

export interface BulkMoveResult {
  moved: number
  skipped: number
  failed: number
  failures: { id: string; error: string }[]
}

/**
 * Bulk move multiple applications to a target status (G-024). Used by the
 * "Move to stage" dropdown on the vacancy applications toolbar — the
 * recruiter selects rows, picks a target stage, and we apply the same
 * per-row updateApplicationStatus path for each one so audit logging,
 * candidate-status sync, and the opt-in status-change auto-email all fire
 * without us re-implementing them.
 *
 * Per-row outcomes are classified:
 * - `moved`: the per-row updateApplicationStatus succeeded.
 * - `skipped`: the row was already at the target status — we detect this
 *   before calling the action so we don't generate noise audit rows for
 *   no-op changes.
 * - `failed`: the per-row call returned an error (RLS, stale state, etc).
 *
 * Rejection / withdrawn targets are blocked here because rejection has its
 * own dedicated `rejectApplicationsBatch` flow (with reason + template +
 * opt-in email selection) and `withdrawn` is candidate-initiated.
 */
export async function moveApplicationsBatch(input: {
  applicationIds: string[]
  targetStatusId: string
}): Promise<ActionResult<BulkMoveResult>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (input.applicationIds.length === 0) {
    return { success: false, error: 'No applications selected' }
  }
  if (input.applicationIds.length > MAX_BULK_MOVE_BATCH) {
    return {
      success: false,
      error: `Too many applications selected. Move at most ${MAX_BULK_MOVE_BATCH} at a time.`,
    }
  }

  // Verify the target status exists in this org's scope and isn't a
  // rejection / withdrawn target (each has its own flow).
  const { data: targetStatus } = await ctx.supabase
    .from('application_statuses')
    .select('code')
    .eq('id', input.targetStatusId)
    .single()
  if (!targetStatus) {
    return { success: false, error: 'Target status not found' }
  }
  if (
    targetStatus.code === APPLICATION_STATUS.REJECTED ||
    targetStatus.code === APPLICATION_STATUS.WITHDRAWN
  ) {
    return {
      success: false,
      error:
        targetStatus.code === APPLICATION_STATUS.REJECTED
          ? 'Use the Reject selected action for rejections.'
          : 'Candidates withdraw their own applications from the status page.',
    }
  }

  const uniqueIds = Array.from(new Set(input.applicationIds))

  // Wave 2.6 Slice 4 — skip detection moved from status_id to the
  // bucket-mapped per-vacancy stage. We compare each app's current
  // canonical bucket against the target status's code; matching rows
  // are no-ops we skip to avoid generating duplicate audit/email noise.
  const { data: currentStates } = await ctx.supabase
    .from('applications')
    .select('id, pipeline_stage_id, pipeline_stages ( type, name, is_terminal )')
    .in('id', uniqueIds)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)

  type StageJoin =
    | { type: 'standard' | 'review' | 'interview' | 'offer'; name: string; is_terminal: boolean }
    | { type: 'standard' | 'review' | 'interview' | 'offer'; name: string; is_terminal: boolean }[]
    | null
  const currentCodeById = new Map<string, string | null>()
  for (const r of (currentStates ?? []) as { id: string; pipeline_stages: StageJoin }[]) {
    const join = r.pipeline_stages
    const row = Array.isArray(join) ? join[0] : join
    currentCodeById.set(r.id, row ? mapPipelineStageToBucket(row) : null)
  }

  let moved = 0
  let skipped = 0
  const failures: { id: string; error: string }[] = []

  for (const applicationId of uniqueIds) {
    if (!currentCodeById.has(applicationId)) {
      // Row didn't come back in the lookup — already deleted, or RLS hid it.
      failures.push({ id: applicationId, error: 'Application not found' })
      continue
    }
    if (currentCodeById.get(applicationId) === targetStatus.code) {
      skipped++
      continue
    }
    const result = await updateApplicationStatus(applicationId, input.targetStatusId)
    if (result.success) {
      moved++
    } else {
      failures.push({ id: applicationId, error: result.error })
    }
  }

  // updateApplicationStatus already revalidates the pipeline + candidates
  // routes per call, so no additional revalidatePath here.
  return {
    success: true,
    data: { moved, skipped, failed: failures.length, failures },
  }
}
