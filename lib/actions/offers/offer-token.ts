'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { type ActionResult } from '../index'
import { writeAuditLog } from '@/lib/audit-log'
import { dispatchWebhookNotification } from '@/lib/notifications/webhook-dispatcher'
import {
  offerAcceptedCtx,
  offerDeclinedCtx,
} from '@/lib/notifications/event-builders'
import { createOrgNotifications } from '@/lib/actions/notifications'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePipelineStageId } from '@/lib/pipeline-stages/resolve'
import { canRespond, type OfferStatus } from '@/lib/offers/state'
import { isOfferExpired } from '@/lib/offers/expiry'
import { resolveOrgContentLocale } from '@/lib/i18n/org-locale'

// ──────────────────────────────────────────────────────────────────────────
//  Candidate-facing actions (no auth — token is the credential)
// ──────────────────────────────────────────────────────────────────────────

const DeclineSchema = z.object({
  reason: z.string().trim().max(1000).nullable().optional(),
})

/** Public read for the candidate-facing page. Looked up via the admin client
 * (token bypasses RLS, mirrors the G-016 status page). Returns only the
 * fields the candidate's page renders — no recruiter notes, no audit trail. */
export async function getOfferByToken(token: string): Promise<
  ActionResult<{
    id: string
    status: string
    role_title: string
    body: string
    recruiter_message: string | null
    compensation_amount: number | null
    compensation_currency: string | null
    compensation_period: string | null
    start_date: string | null
    expiry_date: string | null
    sent_at: string | null
    /** When the candidate accepted / declined (Public Offer.dc.html §2 — used
     * by the accepted-state footer to render "Accepted {date}"). Null while
     * the offer is still in `sent` or for terminal states without a candidate
     * response (`expired`, `withdrawn`). */
    responded_at: string | null
    candidate_first_name: string
    organization_name: string
    /** A-10c — recruiter's name + email so the public offer page can
     * render an "Ask a question" mailto link. Both nullable: the
     * recruiter row may have been deleted (`created_by` FK is ON
     * DELETE SET NULL) or the profile may not have an email stored. */
    recruiter_name: string | null
    recruiter_email: string | null
    /** i18n Slice 3b — the org's content language for rendering this page. */
    content_locale: string
  }>
> {
  if (!token || token.length < 16 || token.length > 64 || !/^[a-f0-9]+$/i.test(token)) {
    return { success: false, error: 'Invalid token' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('offers')
    .select(
      `id, status, role_title, body, recruiter_message,
       compensation_amount, compensation_currency, compensation_period,
       start_date, expiry_date, sent_at, responded_at, deleted_at, application_id, organization_id,
       applications ( candidate_id, deleted_at, vacancies ( deleted_at ) ),
       organizations ( name, deleted_at ),
       profiles!offers_created_by_fkey ( full_name, email )`,
    )
    .eq('public_token', token)
    .maybeSingle()

  if (error) {
    console.error('[offers] getOfferByToken failed:', error.message)
    return { success: false, error: 'Failed to load offer' }
  }
  if (!data || data.deleted_at) return { success: false, error: 'Offer not found' }

  type AppJoin =
    | {
        candidate_id: string
        deleted_at: string | null
        vacancies: { deleted_at: string | null } | { deleted_at: string | null }[] | null
      }
    | {
        candidate_id: string
        deleted_at: string | null
        vacancies: { deleted_at: string | null } | { deleted_at: string | null }[] | null
      }[]
    | null
  type OrgJoin =
    | { name: string; deleted_at: string | null }
    | { name: string; deleted_at: string | null }[]
    | null
  type RecruiterJoin =
    | { full_name: string | null; email: string | null }
    | { full_name: string | null; email: string | null }[]
    | null

  const appJoinRaw = data.applications as AppJoin
  const appJoin = Array.isArray(appJoinRaw) ? appJoinRaw[0] : appJoinRaw
  const orgJoinRaw = data.organizations as OrgJoin
  const orgJoin = Array.isArray(orgJoinRaw) ? orgJoinRaw[0] : orgJoinRaw
  const recruiterJoinRaw = (data as { profiles?: RecruiterJoin }).profiles ?? null
  const recruiterJoin = Array.isArray(recruiterJoinRaw) ? recruiterJoinRaw[0] : recruiterJoinRaw

  if (!appJoin || appJoin.deleted_at) return { success: false, error: 'Offer not found' }
  if (!orgJoin || orgJoin.deleted_at) return { success: false, error: 'Offer not found' }
  const vacJoinRaw = appJoin.vacancies
  const vacJoin = Array.isArray(vacJoinRaw) ? vacJoinRaw[0] : vacJoinRaw
  if (vacJoin?.deleted_at) return { success: false, error: 'Offer not found' }

  const { data: candidate } = await admin
    .from('candidates')
    .select('first_name, deleted_at')
    .eq('id', appJoin.candidate_id)
    .single()
  if (!candidate || candidate.deleted_at) {
    return { success: false, error: 'Offer not found' }
  }

  // View-time safety net: if expiry has passed but cron hasn't run yet,
  // surface as expired so the candidate doesn't see a stale Accept button.
  const displayStatus =
    data.status === 'sent' && isOfferExpired(data.expiry_date as string | null)
      ? 'expired'
      : (data.status as string)

  // i18n Slice 3b — the org's content language (graceful separate read;
  // unmigrated / unset → English).
  const { data: orgLang } = await admin
    .from('organizations')
    .select('default_content_locale, enabled_content_locales')
    .eq('id', data.organization_id as string)
    .single()
  const contentLocale = resolveOrgContentLocale(orgLang)

  return {
    success: true,
    data: {
      id: data.id as string,
      status: displayStatus,
      role_title: data.role_title as string,
      body: data.body as string,
      recruiter_message: (data.recruiter_message as string | null) ?? null,
      compensation_amount: (data.compensation_amount as number | null) ?? null,
      compensation_currency: (data.compensation_currency as string | null) ?? null,
      compensation_period: (data.compensation_period as string | null) ?? null,
      start_date: (data.start_date as string | null) ?? null,
      expiry_date: (data.expiry_date as string | null) ?? null,
      sent_at: (data.sent_at as string | null) ?? null,
      responded_at: (data.responded_at as string | null) ?? null,
      candidate_first_name: candidate.first_name as string,
      organization_name: orgJoin.name as string,
      recruiter_name: recruiterJoin?.full_name ?? null,
      recruiter_email: recruiterJoin?.email ?? null,
      content_locale: contentLocale,
    },
  }
}

/** Candidate-side accept. Token is the credential. */
export async function acceptOfferByToken(token: string): Promise<ActionResult<void>> {
  if (!token || !/^[a-f0-9]{16,64}$/i.test(token)) {
    return { success: false, error: 'Invalid token' }
  }

  const admin = createAdminClient()
  const { data: offer } = await admin
    .from('offers')
    .select('id, status, expiry_date, application_id, organization_id')
    .eq('public_token', token)
    .is('deleted_at', null)
    .single()
  if (!offer) return { success: false, error: 'Offer not found' }
  if (!canRespond(offer.status as OfferStatus)) {
    return { success: false, error: 'This offer can no longer be responded to.' }
  }
  if (offer.expiry_date && isOfferExpired(offer.expiry_date as string)) {
    return { success: false, error: 'This offer has expired.' }
  }

  const now = new Date().toISOString()
  const { error } = await admin
    .from('offers')
    .update({ status: 'accepted', responded_at: now, updated_at: now })
    .eq('id', offer.id)
    .eq('status', 'sent') // race guard

  if (error) {
    console.error('[offers] accept update failed:', error.message)
    return { success: false, error: 'Failed to record response' }
  }

  // Move the application to "hired" — that triggers the existing candidate-
  // status sync + audit-log row inside updateApplicationStatus. We can't
  // call that action directly because it relies on the recruiter's session;
  // do the equivalent UPDATE directly via the admin client, then write our
  // own audit row. Wave 2.6 Slice 4 — pipeline_stage_id only; resolve the
  // per-vacancy "Hired" stage from the application's vacancy.
  const { data: hireAppRow } = await admin
    .from('applications')
    .select('candidate_id, vacancy_id')
    .eq('id', offer.application_id as string)
    .single()
  if (hireAppRow?.vacancy_id) {
    const hiredPipelineStageId = await resolvePipelineStageId(
      admin,
      hireAppRow.vacancy_id as string,
      'hired',
    )
    const hireUpdate: Record<string, unknown> = { last_status_changed_at: now }
    if (hiredPipelineStageId) hireUpdate.pipeline_stage_id = hiredPipelineStageId
    await admin
      .from('applications')
      .update(hireUpdate)
      .eq('id', offer.application_id as string)
      .eq('organization_id', offer.organization_id as string)

    // Sync candidate's general status to Hired too, matching the existing
    // pattern in updateApplicationStatus.
    const { data: candidateHiredStatus } = await admin
      .from('candidate_statuses')
      .select('id')
      .eq('code', 'hired')
      .single()
    if (candidateHiredStatus && hireAppRow.candidate_id) {
      await admin
        .from('candidates')
        .update({ general_status_id: candidateHiredStatus.id })
        .eq('id', hireAppRow.candidate_id)
        .eq('organization_id', offer.organization_id as string)
    }
  }

  void writeAuditLog({
    orgId: offer.organization_id as string,
    userId: null,
    entityType: 'offer',
    entityId: offer.id as string,
    action: 'offer_accepted',
    message: 'offer accepted by candidate',
    details: { application_id: offer.application_id, via: 'candidate_token' },
  })

  // Notify org owners + admins (best-effort).
  try {
    const { data: members } = await admin
      .from('profiles')
      .select('id')
      .eq('organization_id', offer.organization_id as string)
      .in('role', ['owner', 'admin'])
    const recipientIds = (members || []).map((m) => m.id)
    if (recipientIds.length > 0) {
      await createOrgNotifications(offer.organization_id as string, recipientIds, {
        type: 'offer_accepted',
        title: 'Offer accepted',
        body: undefined,
        link: undefined,
      })
    }
  } catch (err) {
    console.error('[offers] accept notification failed:', err)
  }

  // Slack/Teams webhook (best-effort).
  try {
    const { data: hydratedOffer } = await admin
      .from('offers')
      .select('role_title, applications(candidate_id, candidates(first_name, last_name), vacancies(title))')
      .eq('id', offer.id as string)
      .single()
    if (hydratedOffer) {
      const appJoin = (hydratedOffer as unknown as { applications: { candidate_id: string; candidates: { first_name: string; last_name: string } | null; vacancies: { title: string } | null } | null }).applications
      if (appJoin?.candidate_id) {
        await dispatchWebhookNotification(
          offer.organization_id as string,
          'offer_accepted',
          offerAcceptedCtx({
            candidateId: appJoin.candidate_id,
            candidateName: appJoin.candidates ? `${appJoin.candidates.first_name} ${appJoin.candidates.last_name}`.trim() : 'Candidate',
            vacancyTitle: appJoin.vacancies?.title ?? null,
            roleTitle: (hydratedOffer.role_title as string) || 'the role',
          })
        )
      }
    }
  } catch (err) {
    console.error('[offers] accept webhook failed:', err)
  }

  revalidatePath('/candidates/[id]', 'page')
  return { success: true, data: undefined }
}

/** Candidate-side decline. Token is the credential. Optional decline reason. */
export async function declineOfferByToken(
  token: string,
  reason: string | null,
): Promise<ActionResult<void>> {
  if (!token || !/^[a-f0-9]{16,64}$/i.test(token)) {
    return { success: false, error: 'Invalid token' }
  }
  const parsedReason = DeclineSchema.safeParse({ reason })
  if (!parsedReason.success) {
    return { success: false, error: parsedReason.error.errors[0]?.message ?? 'Validation failed' }
  }

  const admin = createAdminClient()
  const { data: offer } = await admin
    .from('offers')
    .select('id, status, expiry_date, application_id, organization_id')
    .eq('public_token', token)
    .is('deleted_at', null)
    .single()
  if (!offer) return { success: false, error: 'Offer not found' }
  if (!canRespond(offer.status as OfferStatus)) {
    return { success: false, error: 'This offer can no longer be responded to.' }
  }

  const now = new Date().toISOString()
  const { error } = await admin
    .from('offers')
    .update({
      status: 'declined',
      responded_at: now,
      decline_reason: parsedReason.data.reason ?? null,
      updated_at: now,
    })
    .eq('id', offer.id)
    .eq('status', 'sent')

  if (error) {
    console.error('[offers] decline update failed:', error.message)
    return { success: false, error: 'Failed to record response' }
  }

  void writeAuditLog({
    orgId: offer.organization_id as string,
    userId: null,
    entityType: 'offer',
    entityId: offer.id as string,
    action: 'offer_declined',
    message: 'offer declined by candidate',
    details: {
      application_id: offer.application_id,
      via: 'candidate_token',
      has_reason: !!parsedReason.data.reason,
    },
  })

  try {
    const { data: members } = await admin
      .from('profiles')
      .select('id')
      .eq('organization_id', offer.organization_id as string)
      .in('role', ['owner', 'admin'])
    const recipientIds = (members || []).map((m) => m.id)
    if (recipientIds.length > 0) {
      await createOrgNotifications(offer.organization_id as string, recipientIds, {
        type: 'offer_declined',
        title: 'Offer declined',
        body: undefined,
        link: undefined,
      })
    }
  } catch (err) {
    console.error('[offers] decline notification failed:', err)
  }

  try {
    const { data: hydratedOffer } = await admin
      .from('offers')
      .select('role_title, applications(candidate_id, candidates(first_name, last_name), vacancies(title))')
      .eq('id', offer.id as string)
      .single()
    if (hydratedOffer) {
      const appJoin = (hydratedOffer as unknown as { applications: { candidate_id: string; candidates: { first_name: string; last_name: string } | null; vacancies: { title: string } | null } | null }).applications
      if (appJoin?.candidate_id) {
        await dispatchWebhookNotification(
          offer.organization_id as string,
          'offer_declined',
          offerDeclinedCtx({
            candidateId: appJoin.candidate_id,
            candidateName: appJoin.candidates ? `${appJoin.candidates.first_name} ${appJoin.candidates.last_name}`.trim() : 'Candidate',
            vacancyTitle: appJoin.vacancies?.title ?? null,
            roleTitle: (hydratedOffer.role_title as string) || 'the role',
          })
        )
      }
    }
  } catch (err) {
    console.error('[offers] decline webhook failed:', err)
  }

  revalidatePath('/candidates/[id]', 'page')
  return { success: true, data: undefined }
}

