'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'

import { getAuthContext, type ActionResult } from './index'
import { isOrgAdmin } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit-log'
import { dispatchWebhookNotification } from '@/lib/notifications/webhook-dispatcher'
import {
  offerSentCtx,
  offerAcceptedCtx,
  offerDeclinedCtx,
} from '@/lib/notifications/event-builders'
import { createOrgNotifications } from '@/lib/actions/notifications'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePipelineStageId } from '@/lib/pipeline-stages/resolve'
import { sendOfferEmail } from '@/lib/email'
import { canEdit, canRespond, canSend, canWithdraw, type OfferStatus } from '@/lib/offers/state'
import { isOfferExpired } from '@/lib/offers/expiry'

// ──────────────────────────────────────────────────────────────────────────
//  Input shapes
// ──────────────────────────────────────────────────────────────────────────

const OfferInputSchema = z.object({
  role_title: z.string().trim().min(1, 'Role title is required').max(200),
  body: z.string().trim().min(1, 'Offer body is required').max(20000),
  recruiter_message: z.string().trim().max(2000).nullable().optional(),
  compensation_amount: z.number().nonnegative().nullable().optional(),
  compensation_currency: z
    .string()
    .trim()
    .max(8)
    .regex(/^[A-Z]{3,4}$/, 'Currency must be 3–4 uppercase letters')
    .nullable()
    .optional(),
  compensation_period: z
    .enum(['annual', 'monthly', 'hourly', 'project', 'other'])
    .nullable()
    .optional(),
  start_date: z.string().trim().min(1).max(20).nullable().optional(),
  expiry_date: z.string().trim().min(1).max(20).nullable().optional(),
})

export type OfferInput = z.infer<typeof OfferInputSchema>

// ──────────────────────────────────────────────────────────────────────────
//  Recruiter actions
// ──────────────────────────────────────────────────────────────────────────

export async function createOffer(
  applicationId: string,
  input: OfferInput,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can create offers.' }
  }

  const parsed = OfferInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Validation failed" }
  }

  // Verify the application belongs to this org and isn't deleted.
  const { data: application } = await ctx.supabase
    .from('applications')
    .select('id')
    .eq('id', applicationId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()
  if (!application) return { success: false, error: 'Application not found' }

  // Block creating a new offer while a live one is still around.
  const { data: existing } = await ctx.supabase
    .from('offers')
    .select('id, status')
    .eq('application_id', applicationId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .in('status', ['draft', 'sent'])
    .maybeSingle()
  if (existing) {
    return {
      success: false,
      error:
        existing.status === 'sent'
          ? 'There is already a live offer for this application. Withdraw it first.'
          : 'There is already a draft offer for this application. Edit it instead.',
    }
  }

  const { data, error } = await ctx.supabase
    .from('offers')
    .insert({
      organization_id: ctx.orgId,
      application_id: applicationId,
      role_title: parsed.data.role_title,
      body: parsed.data.body,
      recruiter_message: parsed.data.recruiter_message ?? null,
      compensation_amount: parsed.data.compensation_amount ?? null,
      compensation_currency: parsed.data.compensation_currency ?? null,
      compensation_period: parsed.data.compensation_period ?? null,
      start_date: parsed.data.start_date ?? null,
      expiry_date: parsed.data.expiry_date ?? null,
      status: 'draft',
      created_by: ctx.userId,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[offers] insert failed:', error?.message)
    return { success: false, error: 'Failed to create offer' }
  }

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'offer',
    entityId: data.id,
    action: 'offer_created',
    message: 'offer draft created',
    details: { application_id: applicationId },
  })

  revalidatePath('/candidates/[id]', 'page')
  return { success: true, data: { id: data.id } }
}

export async function updateOffer(
  offerId: string,
  input: OfferInput,
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can edit offers.' }
  }

  const parsed = OfferInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Validation failed" }
  }

  const { data: existing } = await ctx.supabase
    .from('offers')
    .select('status')
    .eq('id', offerId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()
  if (!existing) return { success: false, error: 'Offer not found' }
  if (!canEdit(existing.status)) {
    return {
      success: false,
      error: 'This offer has already been sent and can no longer be edited. Withdraw it and create a new one to revise.',
    }
  }

  const { error } = await ctx.supabase
    .from('offers')
    .update({
      role_title: parsed.data.role_title,
      body: parsed.data.body,
      recruiter_message: parsed.data.recruiter_message ?? null,
      compensation_amount: parsed.data.compensation_amount ?? null,
      compensation_currency: parsed.data.compensation_currency ?? null,
      compensation_period: parsed.data.compensation_period ?? null,
      start_date: parsed.data.start_date ?? null,
      expiry_date: parsed.data.expiry_date ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', offerId)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to update offer' }

  revalidatePath('/candidates/[id]', 'page')
  return { success: true, data: undefined }
}

export async function sendOffer(offerId: string): Promise<ActionResult<{ token: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can send offers.' }
  }

  // Fetch the offer + the associated application + candidate + org so we can
  // both validate and email in one place.
  const { data: offer } = await ctx.supabase
    .from('offers')
    .select(
      `id, status, role_title, expiry_date, public_token, application_id,
       applications ( candidate_id, vacancies ( title ) )`,
    )
    .eq('id', offerId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()
  if (!offer) return { success: false, error: 'Offer not found' }
  if (!canSend(offer.status)) {
    return { success: false, error: 'This offer cannot be sent (it is no longer a draft).' }
  }

  // Reject an expiry in the past — there's no point sending an already-expired offer.
  if (offer.expiry_date && isOfferExpired(offer.expiry_date as string)) {
    return { success: false, error: 'Expiry date is in the past — pick a future date or clear it.' }
  }

  type AppJoin =
    | { candidate_id: string; vacancies: { title: string } | { title: string }[] | null }
    | { candidate_id: string; vacancies: { title: string } | { title: string }[] | null }[]
    | null
  const appJoin = offer.applications as AppJoin
  const app = Array.isArray(appJoin) ? appJoin[0] : appJoin
  if (!app?.candidate_id) return { success: false, error: 'Offer application is missing' }

  const { data: candidate } = await ctx.supabase
    .from('candidates')
    .select('first_name, last_name, email')
    .eq('id', app.candidate_id)
    .eq('organization_id', ctx.orgId)
    .single()
  if (!candidate?.email) {
    return { success: false, error: 'Candidate has no email on file — cannot send offer.' }
  }

  const token = (offer.public_token as string | null) ?? crypto.randomUUID().replace(/-/g, '')
  const now = new Date().toISOString()

  const { error: updateErr } = await ctx.supabase
    .from('offers')
    .update({
      status: 'sent',
      sent_at: now,
      public_token: token,
      updated_at: now,
    })
    .eq('id', offerId)
    .eq('organization_id', ctx.orgId)
    .eq('status', 'draft') // last-mile race guard

  if (updateErr) {
    console.error('[offers] send failed:', updateErr.message)
    return { success: false, error: 'Failed to send offer' }
  }

  // Look up the org name + custom template for the email send.
  const [{ data: org }, { data: templateRow }] = await Promise.all([
    ctx.supabase.from('organizations').select('name').eq('id', ctx.orgId).single(),
    ctx.supabase
      .from('email_templates')
      .select('subject, body, is_enabled')
      .eq('organization_id', ctx.orgId)
      .eq('template_type', 'offer_sent')
      .maybeSingle(),
  ])

  if (templateRow?.is_enabled !== false) {
    try {
      const headerStore = await headers()
      const xfHost = headerStore.get('x-forwarded-host')
      const proto = headerStore.get('x-forwarded-proto') ?? 'https'
      const inferredOrigin = xfHost ? `${proto}://${xfHost}` : null
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL || inferredOrigin || 'http://localhost:3000'

      type VacJoin = { title: string } | { title: string }[] | null
      const vac = app.vacancies as VacJoin
      const vacancyTitle = Array.isArray(vac) ? vac[0]?.title : vac?.title

      await sendOfferEmail({
        to: candidate.email,
        candidateName: `${candidate.first_name ?? ''} ${candidate.last_name ?? ''}`.trim() || 'there',
        vacancyTitle: (offer.role_title as string) || vacancyTitle || 'the role',
        organizationName: org?.name || 'the hiring team',
        offerUrl: `${baseUrl}/offer/${token}`,
        customSubject: templateRow?.subject || undefined,
        customBody: templateRow?.body || undefined,
      })
    } catch (err) {
      console.error('[offers] email send failed (non-fatal):', err)
    }
  }

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'offer',
    entityId: offerId,
    action: 'offer_sent',
    message: 'offer sent to candidate',
    details: { application_id: offer.application_id },
  })

  {
    type VacJoin = { title: string } | { title: string }[] | null
    const vac = app.vacancies as VacJoin
    const vacancyTitle = Array.isArray(vac) ? vac[0]?.title ?? null : vac?.title ?? null
    await dispatchWebhookNotification(
      ctx.orgId,
      'offer_sent',
      offerSentCtx({
        candidateId: app.candidate_id,
        candidateName: `${candidate.first_name ?? ''} ${candidate.last_name ?? ''}`.trim() || 'Candidate',
        vacancyTitle,
        roleTitle: (offer.role_title as string) || vacancyTitle || 'the role',
      })
    )
  }

  revalidatePath('/candidates/[id]', 'page')
  return { success: true, data: { token } }
}

export async function withdrawOffer(offerId: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can withdraw offers.' }
  }

  const { data: offer } = await ctx.supabase
    .from('offers')
    .select('id, status, application_id')
    .eq('id', offerId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()
  if (!offer) return { success: false, error: 'Offer not found' }
  if (!canWithdraw(offer.status)) {
    return { success: false, error: 'Only sent offers can be withdrawn.' }
  }

  const now = new Date().toISOString()
  const { error } = await ctx.supabase
    .from('offers')
    .update({ status: 'withdrawn', responded_at: now, updated_at: now })
    .eq('id', offerId)
    .eq('organization_id', ctx.orgId)
    .eq('status', 'sent')

  if (error) return { success: false, error: 'Failed to withdraw offer' }

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'offer',
    entityId: offerId,
    action: 'offer_withdrawn',
    message: 'offer withdrawn',
    details: { application_id: offer.application_id },
  })

  revalidatePath('/candidates/[id]', 'page')
  return { success: true, data: undefined }
}

export async function deleteOffer(offerId: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can delete offers.' }
  }

  // Only draft offers can be deleted — sent/terminal offers are part of the
  // candidate's audit trail and should stay around as soft-deleted rows.
  const { data: offer } = await ctx.supabase
    .from('offers')
    .select('id, status, application_id')
    .eq('id', offerId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()
  if (!offer) return { success: false, error: 'Offer not found' }
  if (offer.status !== 'draft') {
    return { success: false, error: 'Only draft offers can be deleted.' }
  }

  const { error } = await ctx.supabase
    .from('offers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', offerId)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to delete offer' }

  revalidatePath('/candidates/[id]', 'page')
  return { success: true, data: undefined }
}

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
       start_date, expiry_date, sent_at, responded_at, deleted_at, application_id,
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

