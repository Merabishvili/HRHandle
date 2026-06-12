'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import { isOrgAdmin } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit-log'
import {
  isCalendlyConfigured,
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeToken,
} from '@/lib/calendly/oauth'
import {
  getCurrentUser,
  listEventTypes,
  createUserWebhookSubscription,
  deleteWebhookSubscription,
  type CalendlyEventType,
} from '@/lib/calendly/client'

const PLATFORM = 'calendly'

export interface CalendlyIntegrationStatus {
  connected: boolean
  configured: boolean
  external_user_uri: string | null
  external_user_name: string | null
  selected_event_type_uri: string | null
  selected_event_type_name: string | null
  available_event_types?: CalendlyEventType[]
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true
  return new Date(expiresAt).getTime() <= Date.now() + 60_000 // 1 min skew
}

async function ensureFreshToken(integrationId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data: row } = await supabase
    .from('organization_integrations')
    .select('access_token, refresh_token, token_expires_at')
    .eq('id', integrationId)
    .single()
  if (!row) return null
  if (!isExpired(row.token_expires_at as string | null)) return row.access_token as string
  if (!row.refresh_token) return null
  try {
    const fresh = await refreshAccessToken(row.refresh_token as string)
    const expiresAt = new Date(Date.now() + fresh.expires_in * 1000).toISOString()
    await supabase
      .from('organization_integrations')
      .update({
        access_token: fresh.access_token,
        refresh_token: fresh.refresh_token,
        token_expires_at: expiresAt,
      })
      .eq('id', integrationId)
    return fresh.access_token
  } catch (err) {
    console.error('[calendly] refresh failed:', err)
    return null
  }
}

export async function getCalendlyStatus(): Promise<ActionResult<CalendlyIntegrationStatus>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }

  const { data: row } = await ctx.supabase
    .from('organization_integrations')
    .select(
      'id, external_page_name, external_user_uri, selected_event_type_uri, selected_event_type_name, is_active'
    )
    .eq('organization_id', ctx.orgId)
    .eq('platform', PLATFORM)
    .eq('is_active', true)
    .maybeSingle()

  const status: CalendlyIntegrationStatus = {
    connected: !!row,
    configured: isCalendlyConfigured(),
    external_user_uri: (row?.external_user_uri as string | null) ?? null,
    external_user_name: (row?.external_page_name as string | null) ?? null,
    selected_event_type_uri: (row?.selected_event_type_uri as string | null) ?? null,
    selected_event_type_name: (row?.selected_event_type_name as string | null) ?? null,
  }

  if (row) {
    const token = await ensureFreshToken(row.id as string)
    if (token && row.external_user_uri) {
      try {
        status.available_event_types = await listEventTypes(token, row.external_user_uri as string)
      } catch (err) {
        console.error('[calendly] listEventTypes failed:', err)
      }
    }
  }

  return { success: true, data: status }
}

/** Called from /api/auth/calendly/callback after the OAuth dance. */
export async function completeCalendlyConnect(
  code: string,
  redirectUri: string
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can connect Calendly', code: 'FORBIDDEN' }
  }
  if (!isCalendlyConfigured()) {
    return { success: false, error: 'Calendly is not configured for this instance', code: 'EXTERNAL_SERVICE' }
  }

  let tokens
  try {
    tokens = await exchangeCodeForTokens(code, redirectUri)
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Token exchange failed', code: 'EXTERNAL_SERVICE' }
  }

  let user
  try {
    user = await getCurrentUser(tokens.access_token)
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to load Calendly user', code: 'EXTERNAL_SERVICE' }
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  const admin = createAdminClient()

  // Subscribe to webhooks now (user-scoped) so booking events flow in.
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
  const webhookUrl = `${siteUrl}/api/webhooks/calendly`
  let subscriptionUri = ''
  let signingKey = ''
  try {
    const sub = await createUserWebhookSubscription(tokens.access_token, {
      url: webhookUrl,
      userUri: user.uri,
      organizationUri: user.current_organization,
      events: ['invitee.created', 'invitee.canceled'],
    })
    subscriptionUri = sub.uri
    signingKey = sub.signing_key
  } catch (err) {
    console.error('[calendly] webhook subscription failed:', err)
    // Continue anyway — the recruiter can manually retry; integration row stored.
  }

  // Upsert. We allow only one calendly row per org.
  const { data: existing } = await admin
    .from('organization_integrations')
    .select('id')
    .eq('organization_id', ctx.orgId)
    .eq('platform', PLATFORM)
    .maybeSingle()

  const payload = {
    organization_id: ctx.orgId,
    platform: PLATFORM,
    external_page_id: user.uri,
    external_page_name: user.name,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: expiresAt,
    external_user_uri: user.uri,
    webhook_subscription_id: subscriptionUri || null,
    webhook_signing_key: signingKey || null,
    connected_by: ctx.userId,
    connected_at: new Date().toISOString(),
    is_active: true,
  }

  if (existing?.id) {
    await admin.from('organization_integrations').update(payload).eq('id', existing.id)
  } else {
    await admin.from('organization_integrations').insert(payload)
  }

  await writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'integration',
    entityId: null,
    action: 'calendly_connected',
    message: `Connected Calendly account ${user.email}`,
  })
  revalidatePath('/settings/integrations/calendly')
  return { success: true, data: undefined }
}

export async function selectCalendlyEventType(uri: string, name: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can edit', code: 'FORBIDDEN' }
  }
  const { error } = await ctx.supabase
    .from('organization_integrations')
    .update({ selected_event_type_uri: uri, selected_event_type_name: name })
    .eq('organization_id', ctx.orgId)
    .eq('platform', PLATFORM)
    .eq('is_active', true)
  if (error) return { success: false, error: 'Failed to save', code: 'DB_ERROR' }
  revalidatePath('/settings/integrations/calendly')
  return { success: true, data: undefined }
}

export async function disconnectCalendly(): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can disconnect', code: 'FORBIDDEN' }
  }
  const admin = createAdminClient()
  const { data: row } = await admin
    .from('organization_integrations')
    .select('id, access_token, refresh_token, webhook_subscription_id')
    .eq('organization_id', ctx.orgId)
    .eq('platform', PLATFORM)
    .eq('is_active', true)
    .maybeSingle()

  if (row) {
    // Best-effort: delete webhook subscription + revoke tokens upstream.
    if (row.access_token && row.webhook_subscription_id) {
      try {
        await deleteWebhookSubscription(row.access_token as string, row.webhook_subscription_id as string)
      } catch (err) {
        console.error('[calendly] webhook delete failed (continuing):', err)
      }
    }
    if (row.access_token) await revokeToken(row.access_token as string)
    if (row.refresh_token) await revokeToken(row.refresh_token as string)

    await admin
      .from('organization_integrations')
      .update({
        is_active: false,
        access_token: null,
        refresh_token: null,
        webhook_subscription_id: null,
        webhook_signing_key: null,
      })
      .eq('id', row.id as string)
  }

  await writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'integration',
    entityId: null,
    action: 'calendly_disconnected',
  })
  revalidatePath('/settings/integrations/calendly')
  return { success: true, data: undefined }
}
