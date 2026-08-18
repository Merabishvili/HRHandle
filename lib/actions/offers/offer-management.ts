'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { getAuthContext, type ActionResult } from '../index'
import { isOrgAdmin } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit-log'
import { dispatchWebhookNotification } from '@/lib/notifications/webhook-dispatcher'
import { offerSentCtx } from '@/lib/notifications/event-builders'
import { sendOfferEmail } from '@/lib/email'
import { fetchOrgContentLocale } from '@/lib/i18n/org-locale'
import { canEdit, canSend, canWithdraw } from '@/lib/offers/state'
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
        contentLocale: await fetchOrgContentLocale(ctx.supabase, ctx.orgId),
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

