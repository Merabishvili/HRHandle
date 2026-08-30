'use server'

import * as Sentry from '@sentry/nextjs'
import { getTranslations } from 'next-intl/server'
import { getAuthContext } from './index'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchOrgContentLocale } from '@/lib/i18n/org-locale'
import { renderNotification } from '@/lib/notifications/render'
import { sendTeamNotificationEmail } from '@/lib/email'
import {
  normalizeNotificationPreferences,
  inAppNotificationAllowed,
  emailNotificationAllowed,
  type NotificationPreferences,
} from '@/lib/types/notification-preferences'

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

  // Honor each recipient's per-event channel toggles (Settings → Notifications):
  //   - in-app: skip recipients who turned this event's in-app toggle off (N5).
  //   - email: send an instant email to recipients who turned it on (off by
  //     default). Emails are always instant — there is no digest.
  const { data: recipientRows } = await supabase
    .from('profiles')
    .select('id, email, notification_preferences')
    .in('id', recipientIds)
  const recipients = (recipientRows ?? []) as {
    id: string
    email: string | null
    notification_preferences: Partial<NotificationPreferences> | null
  }[]

  // Fall back to the raw recipient list (all in-app, no email) if the prefs
  // read returned nothing — never silently drop in-app notifications.
  let inAppRecipientIds = recipientIds
  const emailRecipients: string[] = []
  if (recipients.length > 0) {
    inAppRecipientIds = []
    for (const r of recipients) {
      const prefs = normalizeNotificationPreferences(r.notification_preferences)
      if (inAppNotificationAllowed(prefs, notification.type)) inAppRecipientIds.push(r.id)
      if (r.email && emailNotificationAllowed(prefs, notification.type)) emailRecipients.push(r.email)
    }
  }

  // Instant email (best-effort) — localized to the org's content language via
  // the shared notification renderer. Never blocks or fails the in-app insert.
  if (emailRecipients.length > 0) {
    try {
      const orgLocale = await fetchOrgContentLocale(supabase, orgId)
      const t = await getTranslations({ locale: orgLocale })
      const rendered = renderNotification(t, {
        type: notification.type,
        data: notification.data ?? null,
        title: notification.title,
        body: notification.body ?? null,
      })
      await Promise.allSettled(
        emailRecipients.map((email) =>
          sendTeamNotificationEmail({
            to: email,
            title: rendered.title,
            body: rendered.body,
            link: notification.link ?? null,
            contentLocale: orgLocale,
          }),
        ),
      )
    } catch (err) {
      console.error('[notifications] email send failed:', err)
      Sentry.captureException(err, { tags: { area: 'notifications', op: 'email' } })
    }
  }

  // Everyone opted out of in-app → nothing to insert, but email may have gone.
  if (inAppRecipientIds.length === 0) return { success: true }

  const baseRows = inAppRecipientIds.map((rid) => ({
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
