import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCalendlySignature } from '@/lib/calendly/webhook-verify'
import { applicationIdFromTracking } from '@/lib/calendly/link-builder'
import { writeAuditLog } from '@/lib/audit-log'
import { dispatchWebhookNotification } from '@/lib/notifications/webhook-dispatcher'
import { interviewScheduledCtx } from '@/lib/notifications/event-builders'

interface CalendlyWebhookBody {
  event: 'invitee.created' | 'invitee.canceled' | string
  payload?: {
    event?: string // event URI
    invitee?: {
      name?: string
      email?: string
    }
    scheduled_event?: {
      uri?: string
      start_time?: string
      end_time?: string
      location?: {
        type?: string
        join_url?: string
      }
    }
    tracking?: {
      utm_content?: string | null
    }
    cancellation?: {
      reason?: string
    }
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  let parsed: CalendlyWebhookBody
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_json' }, { status: 400 })
  }

  const applicationId = applicationIdFromTracking(parsed.payload?.tracking)
  if (!applicationId) {
    // Booking came from a Calendly link that didn't go through HRHandle —
    // nothing to do, but we 200 so Calendly doesn't retry.
    return NextResponse.json({ ok: true, ignored: 'no_application_tag' })
  }

  const admin = createAdminClient()
  const { data: app } = await admin
    .from('applications')
    .select('id, organization_id, candidate_id, vacancy_id, vacancies(title), candidates(first_name, last_name)')
    .eq('id', applicationId)
    .maybeSingle()
  if (!app) {
    return NextResponse.json({ ok: true, ignored: 'application_not_found' })
  }

  // Find the Calendly integration for this org and verify HMAC.
  const { data: integration } = await admin
    .from('organization_integrations')
    .select('id, webhook_signing_key')
    .eq('organization_id', app.organization_id as string)
    .eq('platform', 'calendly')
    .eq('is_active', true)
    .maybeSingle()

  if (!integration?.webhook_signing_key) {
    return NextResponse.json({ ok: false, reason: 'no_integration' }, { status: 401 })
  }

  const verify = verifyCalendlySignature({
    header: req.headers.get('calendly-webhook-signature'),
    rawBody,
    signingKey: integration.webhook_signing_key as string,
  })
  if (!verify.ok) {
    return NextResponse.json({ ok: false, reason: verify.reason }, { status: 401 })
  }

  const candidate = (app as unknown as { candidates: { first_name: string; last_name: string } | null }).candidates
  const candidateName = candidate ? `${candidate.first_name} ${candidate.last_name}`.trim() : 'Candidate'
  const vacancyTitle =
    (app as unknown as { vacancies: { title: string } | null }).vacancies?.title ?? null

  if (parsed.event === 'invitee.created') {
    const startTime = parsed.payload?.scheduled_event?.start_time ?? null
    const endTime = parsed.payload?.scheduled_event?.end_time ?? null
    let durationMin: number | null = null
    if (startTime && endTime) {
      const ms = new Date(endTime).getTime() - new Date(startTime).getTime()
      if (Number.isFinite(ms) && ms > 0) durationMin = Math.round(ms / 60000)
    }

    const meetingUrl = parsed.payload?.scheduled_event?.location?.join_url ?? null

    // Create interview row if interviews table is in use. The schema for the
    // existing `interviews` page may differ; we attempt a minimal insert and
    // continue on failure.
    try {
      await admin.from('interviews').insert({
        organization_id: app.organization_id,
        candidate_id: app.candidate_id,
        vacancy_id: app.vacancy_id,
        application_id: app.id,
        scheduled_at: startTime,
        duration_minutes: durationMin,
        meeting_link: meetingUrl,
        type: 'video',
        status: 'scheduled',
      })
    } catch (err) {
      console.error('[calendly-webhook] insert interview failed (continuing):', err)
    }

    await writeAuditLog({
      orgId: app.organization_id as string,
      userId: null,
      entityType: 'application',
      entityId: app.id as string,
      action: 'interview_scheduled',
      message: `Candidate scheduled an interview via Calendly`,
      details: { source: 'calendly', start_time: startTime, duration_min: durationMin },
    })

    if (startTime) {
      await dispatchWebhookNotification(
        app.organization_id as string,
        'interview_scheduled',
        interviewScheduledCtx({
          candidateId: app.candidate_id as string,
          candidateName,
          vacancyTitle,
          scheduledAt: startTime,
          duration: durationMin,
          meetingUrl,
        })
      )
    }
  } else if (parsed.event === 'invitee.canceled') {
    await writeAuditLog({
      orgId: app.organization_id as string,
      userId: null,
      entityType: 'application',
      entityId: app.id as string,
      action: 'interview_canceled',
      message: `Interview canceled via Calendly`,
      details: { reason: parsed.payload?.cancellation?.reason ?? null },
    })
  }

  return NextResponse.json({ ok: true })
}
