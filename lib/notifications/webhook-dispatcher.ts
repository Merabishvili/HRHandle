import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit-log'
import {
  buildSlackPayload,
  buildTeamsPayload,
} from './payload-builders'
import type { WebhookEvent, WebhookEventContext } from './events'

interface WebhookRow {
  id: string
  organization_id: string
  channel_type: 'slack' | 'teams'
  webhook_url: string
  enabled_events: string[]
}

/**
 * Best-effort POST notifications to every active org webhook subscribed to
 * `event`. Never throws — failures are logged and audit-recorded but the
 * caller's own action result is unaffected. Runs in parallel.
 */
export async function dispatchWebhookNotification(
  orgId: string,
  event: WebhookEvent,
  ctx: WebhookEventContext
): Promise<void> {
  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch (err) {
    console.error('[webhook-dispatcher] admin client init failed:', err)
    return
  }

  const { data, error } = await supabase
    .from('webhook_notifications')
    .select('id, organization_id, channel_type, webhook_url, enabled_events')
    .eq('organization_id', orgId)
    .eq('is_active', true)

  if (error) {
    console.error('[webhook-dispatcher] load webhooks failed:', error.message)
    return
  }

  const rows = (data ?? []) as WebhookRow[]
  const subscribed = rows.filter((r) => r.enabled_events.includes(event))
  if (subscribed.length === 0) return

  await Promise.all(
    subscribed.map(async (row) => {
      try {
        const payload =
          row.channel_type === 'slack' ? buildSlackPayload(ctx) : buildTeamsPayload(ctx)
        const res = await fetch(row.webhook_url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          console.error(
            `[webhook-dispatcher] ${row.channel_type} webhook ${row.id} failed: HTTP ${res.status}`
          )
        }
      } catch (err) {
        console.error(`[webhook-dispatcher] ${row.channel_type} webhook ${row.id} threw:`, err)
      }
    })
  )

  // Single audit row per dispatch — recording fan-out count, not each URL.
  await writeAuditLog({
    orgId,
    userId: null,
    entityType: 'webhook_notification',
    entityId: null,
    action: 'webhook_notification_dispatched',
    message: `Dispatched ${event} to ${subscribed.length} webhook(s)`,
    details: {
      event,
      webhook_count: subscribed.length,
      slack: subscribed.filter((r) => r.channel_type === 'slack').length,
      teams: subscribed.filter((r) => r.channel_type === 'teams').length,
    },
  })
}

/**
 * Send a single test message to one webhook URL (validates the URL + payload
 * shape end-to-end). Returns true on 2xx, false otherwise. Never throws.
 */
export async function sendTestWebhook(
  channel: 'slack' | 'teams',
  webhookUrl: string,
  orgName: string
): Promise<{ ok: boolean; reason?: string }> {
  const ctx: WebhookEventContext = {
    title: `HRHandle test notification`,
    body: `If you can see this in your channel, ${orgName}'s ${channel === 'slack' ? 'Slack' : 'Microsoft Teams'} integration is wired correctly.`,
  }
  try {
    const payload = channel === 'slack' ? buildSlackPayload(ctx) : buildTeamsPayload(ctx)
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Network error' }
  }
}
