'use server'

import { getAuthContext, type ActionResult } from './index'
import { buildCalendlyLink } from '@/lib/calendly/link-builder'
import { getCurrentUser, listEventTypes } from '@/lib/calendly/client'
import { ensureFreshToken } from '@/lib/calendly/tokens'
import { writeAuditLog } from '@/lib/audit-log'

export interface CalendlyLinkPayload {
  scheduling_url: string
  url_with_tracking: string
}

/**
 * Build (but do not send) a Calendly scheduling URL for an application.
 * The recruiter can copy + paste this into their own email. A future
 * version may send it directly via Resend.
 */
export async function buildCalendlyLinkForApplication(
  applicationId: string
): Promise<ActionResult<CalendlyLinkPayload>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }

  const { data: app } = await ctx.supabase
    .from('applications')
    .select(
      'id, candidate_id, candidates(first_name, last_name, email)'
    )
    .eq('id', applicationId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()
  if (!app) return { success: false, error: 'Application not found', code: 'NOT_FOUND' }

  // Non-secret columns only — the token is read server-side with the service role.
  const { data: integration } = await ctx.supabase
    .from('organization_integrations')
    .select('id, selected_event_type_uri, external_user_uri')
    .eq('organization_id', ctx.orgId)
    .eq('platform', 'calendly')
    .eq('is_active', true)
    .maybeSingle()

  if (!integration?.selected_event_type_uri) {
    return {
      success: false,
      error: 'Calendly is not connected, or no event type is selected. Configure it under Settings → Integrations.',
      code: 'VALIDATION',
    }
  }

  // The booking URL (https://calendly.com/<user>/<slug>) can't be derived from
  // the event type's API URI, so re-fetch the event type for its current
  // `scheduling_url`. The token is refreshed first — it only lives 2 hours.
  const token = await ensureFreshToken(integration.id as string)
  if (!token) {
    return { success: false, error: 'Calendly token missing — reconnect', code: 'EXTERNAL_SERVICE' }
  }

  let schedulingUrl: string | null = null
  try {
    const userUri =
      (integration.external_user_uri as string | null) ?? (await getCurrentUser(token)).uri
    const types = await listEventTypes(token, userUri)
    const match = types.find((t) => t.uri === integration.selected_event_type_uri)
    if (match) schedulingUrl = match.scheduling_url
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load Calendly event type',
      code: 'EXTERNAL_SERVICE',
    }
  }

  if (!schedulingUrl) {
    return { success: false, error: 'Selected event type no longer exists. Pick a new one in Settings.', code: 'CONFLICT' }
  }

  const candidate = (app as unknown as { candidates: { first_name: string; last_name: string; email: string | null } | null }).candidates
  const name = candidate ? `${candidate.first_name} ${candidate.last_name}`.trim() : ''

  const url = buildCalendlyLink({
    schedulingUrl,
    applicationId: app.id as string,
    candidateName: name || null,
    candidateEmail: candidate?.email ?? null,
  })

  await writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'application',
    entityId: app.id as string,
    action: 'calendly_link_generated',
    message: `Generated Calendly link for ${name || 'candidate'}`,
  })

  return {
    success: true,
    data: { scheduling_url: schedulingUrl, url_with_tracking: url },
  }
}
