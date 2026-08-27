'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from '../index'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit-log'
import { dispatchWebhookNotification } from '@/lib/notifications/webhook-dispatcher'
import { applicationWithdrawnCtx } from '@/lib/notifications/event-builders'
import { createOrgNotifications } from '@/lib/actions/notifications'
import {
  MAX_ACTIVE_APPLICATIONS_PER_CANDIDATE,
  APPLICATION_STATUS,
  CANDIDATE_STATUS,
} from '@/lib/types/constants'
import { resolvePipelineStageId } from '@/lib/pipeline-stages/resolve'
import { mapPipelineStageToBucket } from '@/lib/pipeline-stages/bucket'
import { unwrapRelation, type StageRelation } from '../applications-shared'

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
    return { success: false, error: 'Only active candidates can be added to a vacancy.', code: 'CANDIDATE_INACTIVE' }
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
      code: 'ACTIVE_LIMIT',
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

  if (existing) return { success: false, error: 'This candidate is already being considered for this vacancy.', code: 'DUPLICATE_APPLICATION' }

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
        data: {},
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

