'use server'

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

// Called from other server actions (public-apply, interviews) — not a client-callable action
export async function createOrgNotifications(
  orgId: string,
  recipientIds: string[],
  notification: { type: string; title: string; body?: string; link?: string }
): Promise<void> {
  if (recipientIds.length === 0) return
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
    }
  } catch (err) {
    console.error(
      `[notifications] unexpected error (type=${notification.type}):`,
      err,
    )
  }
}
