'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import { isOrgAdmin } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit-log'
import { isPlausibleWebhookUrl } from '@/lib/notifications/payload-builders'
import { sendTestWebhook } from '@/lib/notifications/webhook-dispatcher'
import {
  WEBHOOK_EVENTS,
  DEFAULT_ENABLED_EVENTS,
  isWebhookEvent,
  type WebhookEvent,
} from '@/lib/notifications/events'

export interface WebhookRow {
  id: string
  channel_type: 'slack' | 'teams'
  webhook_url: string
  name: string
  enabled_events: WebhookEvent[]
  is_active: boolean
  created_at: string
}

export async function listWebhooks(): Promise<ActionResult<WebhookRow[]>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }
  const { data, error } = await ctx.supabase
    .from('webhook_notifications')
    .select('id, channel_type, webhook_url, name, enabled_events, is_active, created_at')
    .eq('organization_id', ctx.orgId)
    .order('created_at', { ascending: true })
  if (error) return { success: false, error: 'Failed to load webhooks', code: 'DB_ERROR' }
  return { success: true, data: (data ?? []) as unknown as WebhookRow[] }
}

interface CreateInput {
  channel_type: 'slack' | 'teams'
  webhook_url: string
  name: string
  enabled_events?: WebhookEvent[]
}

export async function createWebhook(input: CreateInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can manage webhooks', code: 'FORBIDDEN' }
  }
  const url = (input.webhook_url ?? '').trim()
  const name = (input.name ?? '').trim()
  if (!name) return { success: false, error: 'Name is required', code: 'VALIDATION' }
  if (name.length > 80) return { success: false, error: 'Name too long', code: 'VALIDATION' }
  if (input.channel_type !== 'slack' && input.channel_type !== 'teams') {
    return { success: false, error: 'Invalid channel', code: 'VALIDATION' }
  }
  if (!isPlausibleWebhookUrl(url, input.channel_type)) {
    return {
      success: false,
      error: `This does not look like a valid ${input.channel_type === 'slack' ? 'Slack' : 'Teams'} webhook URL`,
      code: 'VALIDATION',
    }
  }
  const events = (input.enabled_events ?? DEFAULT_ENABLED_EVENTS).filter(isWebhookEvent)

  const { data, error } = await ctx.supabase
    .from('webhook_notifications')
    .insert({
      organization_id: ctx.orgId,
      channel_type: input.channel_type,
      webhook_url: url,
      name,
      enabled_events: events,
      created_by: ctx.userId,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: 'Failed to create webhook', code: 'DB_ERROR' }

  await writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'webhook_notification',
    entityId: data.id,
    action: 'webhook_notification_created',
    message: `Added ${input.channel_type} webhook "${name}"`,
    details: { channel_type: input.channel_type, events_count: events.length },
  })

  revalidatePath('/settings/integrations/webhooks')
  return { success: true, data: { id: data.id } }
}

export async function updateWebhookEvents(
  id: string,
  events: WebhookEvent[]
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can manage webhooks', code: 'FORBIDDEN' }
  }
  const cleanEvents = (events ?? []).filter(isWebhookEvent)
  const { error } = await ctx.supabase
    .from('webhook_notifications')
    .update({ enabled_events: cleanEvents, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
  if (error) return { success: false, error: 'Failed to update', code: 'DB_ERROR' }

  await writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'webhook_notification',
    entityId: id,
    action: 'webhook_notification_updated',
    message: `Updated webhook event subscriptions`,
    details: { events_count: cleanEvents.length },
  })
  revalidatePath('/settings/integrations/webhooks')
  return { success: true, data: undefined }
}

export async function toggleWebhookActive(
  id: string,
  isActive: boolean
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can manage webhooks', code: 'FORBIDDEN' }
  }
  const { error } = await ctx.supabase
    .from('webhook_notifications')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
  if (error) return { success: false, error: 'Failed to update', code: 'DB_ERROR' }
  revalidatePath('/settings/integrations/webhooks')
  return { success: true, data: undefined }
}

export async function deleteWebhook(id: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can manage webhooks', code: 'FORBIDDEN' }
  }
  const { error } = await ctx.supabase
    .from('webhook_notifications')
    .delete()
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
  if (error) return { success: false, error: 'Failed to delete', code: 'DB_ERROR' }

  await writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'webhook_notification',
    entityId: id,
    action: 'webhook_notification_deleted',
  })
  revalidatePath('/settings/integrations/webhooks')
  return { success: true, data: undefined }
}

export async function sendTestWebhookAction(id: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can manage webhooks', code: 'FORBIDDEN' }
  }
  const { data: row } = await ctx.supabase
    .from('webhook_notifications')
    .select('channel_type, webhook_url')
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .single()
  if (!row) return { success: false, error: 'Webhook not found', code: 'NOT_FOUND' }

  const { data: org } = await ctx.supabase
    .from('organizations')
    .select('name')
    .eq('id', ctx.orgId)
    .single()

  const result = await sendTestWebhook(
    row.channel_type as 'slack' | 'teams',
    row.webhook_url as string,
    (org?.name as string) ?? 'your organisation'
  )
  if (!result.ok) {
    return { success: false, error: result.reason ?? 'Test message failed', code: 'EXTERNAL_SERVICE' }
  }
  return { success: true, data: undefined }
}

export { WEBHOOK_EVENTS }
