'use server'

import * as Sentry from '@sentry/nextjs'
import { getAuthContext } from './index'
import { createAdminClient } from '@/lib/supabase/admin'

export interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export async function getNotifications(): Promise<Notification[]> {
  const ctx = await getAuthContext()
  if (!ctx) return []

  const { data } = await ctx.supabase
    .from('notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .eq('recipient_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(50)

  return (data || []) as Notification[]
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
  notification: { type: string; title: string; body?: string; link?: string }
): Promise<{ success: boolean }> {
  if (recipientIds.length === 0) return { success: true }
  const supabase = createAdminClient()

  const rows = recipientIds.map((rid) => ({
    organization_id: orgId,
    recipient_id: rid,
    type: notification.type,
    title: notification.title,
    body: notification.body ?? null,
    link: notification.link ?? null,
  }))

  try {
    const { error } = await supabase.from('notifications').insert(rows)
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
