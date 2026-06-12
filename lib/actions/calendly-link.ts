'use server'

import { getAuthContext, type ActionResult } from './index'
import { buildCalendlyLink } from '@/lib/calendly/link-builder'
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

  const { data: integration } = await ctx.supabase
    .from('organization_integrations')
    .select('selected_event_type_uri, selected_event_type_name, access_token')
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

  // The Calendly event type's `scheduling_url` is the public booking link.
  // We fetched it during status load — but to avoid a second API hit we accept
  // a hint via the `selected_event_type_name` (we treat the URI as the canonical
  // identity and require the customer to keep their Calendly page url public).
  // Calendly's URI format: https://api.calendly.com/event_types/XYZ
  // The booking URL follows the pattern https://calendly.com/<user>/<slug>
  // We can't derive that from the URI alone — so we re-call the API.
  // For v1 we DO require listEventTypes to have been hit recently; the UI
  // gates this. If somehow stale, we degrade by returning the API URI which
  // Calendly redirects, but we prefer to error explicitly.
  // Simplified: require the recruiter to refresh their integration page.

  // Re-fetch the event type to get its current scheduling_url. We use the
  // org's existing access token; refresh-on-expiry is handled in calendly.ts.
  const { listEventTypes, getCurrentUser } = await import('@/lib/calendly/client')
  if (!integration.access_token) {
    return { success: false, error: 'Calendly token missing — reconnect', code: 'EXTERNAL_SERVICE' }
  }

  let schedulingUrl: string | null = null
  try {
    const user = await getCurrentUser(integration.access_token as string)
    const types = await listEventTypes(integration.access_token as string, user.uri)
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
    return { success: false, error: 'Selected event type no longer exists. Pick a new one in Settings.', code: 'NOT_FOUND' }
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
