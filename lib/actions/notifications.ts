'use server'

import * as Sentry from '@sentry/nextjs'
import { getAuthContext } from './index'
import { createAdminClient } from '@/lib/supabase/admin'

export interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  /** Structured params for display-time localization (lib/notifications/render.ts).
   * Null on pre-migration rows → the renderer falls back to title/body. */
  data: Record<string, unknown> | null
  link: string | null
  read_at: string | null
  created_at: string
}

export async function getNotifications(): Promise<Notification[]> {
  const ctx = await getAuthContext()
  if (!ctx) return []

  // `select('*')` so this keeps working before the `data` column migration is
  // applied (an explicit column that doesn't exist would error the whole query).
  const { data } = await ctx.supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(50)

  return (data || []).map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body ?? null,
    data: (r.data ?? null) as Record<string, unknown> | null,
    link: r.link ?? null,
    read_at: r.read_at ?? null,
    created_at: r.created_at,
  }))
}

export async function markNotificationRead(id: string): Promise<void> {
  const ctx = await getAuthContext()
  if (!ctx) return

  await ctx.supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('recipient_id', ctx.userId)
    .is('read_at', null)
}

export async function markAllNotificationsRead(): Promise<void> {
  const ctx = await getAuthContext()
  if (!ctx) return

  await ctx.supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', ctx.userId)
    .is('read_at', null)
}

// Called from other server actions (public-apply, interviews) — not a
// client-callable action. Returns `{ success: false }` on failure so callers
// can surface a warning (e.g., add to an `email_failed`-style warnings array)
// without aborting the operation. Never throws.
export async function createOrgNotifications(
  orgId: string,
  recipientIds: string[],
  notification: {
    type: string
    /** English fallback (shown for pre-`data` rows / non-localized types). */
    title: string
    body?: string | undefined
    link?: string | undefined
    /** Structured params localized at display time (lib/notifications/render.ts). */
    data?: Record<string, unknown> | undefined
  }
): Promise<{ success: boolean }> {
  if (recipientIds.length === 0) return { success: true }
  const supabase = createAdminClient()

  const baseRows = recipientIds.map((rid) => ({
    organization_id: orgId,
    recipient_id: rid,
    type: notification.type,
    title: notification.title,
    body: notification.body ?? null,
    link: notification.link ?? null,
  }))
  const rows = notification.data
    ? baseRows.map((r) => ({ ...r, data: notification.data ?? null }))
    : baseRows

  try {
    let { error } = await supabase.from('notifications').insert(rows)
    // Deploy-order tolerance: if the `data` column migration hasn't been applied
    // yet, retry without it so notifications still land (English fallback).
    if (error && notification.data && /'?data'?\s+column|column .*\bdata\b.* does not exist/i.test(error.message)) {
      ;({ error } = await supabase.from('notifications').insert(baseRows))
    }
    if (error) {
      console.error(
        `[notifications] insert failed (type=${notification.type}, recipients=${recipientIds.length}):`,
        error,
      )
      Sentry.captureException(error, {
        tags: { area: 'notifications', op: 'insert' },
        extra: { type: notification.type, recipientCount: recipientIds.length },
      })
      return { success: false }
    }
    return { success: true }
  } catch (err) {
    console.error(
      `[notifications] unexpected error (type=${notification.type}):`,
      err,
    )
    Sentry.captureException(err, {
      tags: { area: 'notifications', op: 'insert' },
      extra: { type: notification.type, recipientCount: recipientIds.length },
    })
    return { success: false }
  }
}
