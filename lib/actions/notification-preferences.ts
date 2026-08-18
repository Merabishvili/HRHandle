'use server'

import { createClient } from '@/lib/supabase/server'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '@/lib/types/notification-preferences'

interface Result<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Read the current user's notification preferences. Falls back to the
 * defaults if the column is missing (e.g. on a profile created before
 * Migration 045 — defensive).
 */
export async function getNotificationPreferences(): Promise<Result<NotificationPreferences>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('profiles')
    .select('notification_preferences')
    .eq('id', user.id)
    .single()

  if (error) {
    return { success: false, error: 'Could not load notification preferences' }
  }

  const prefs = (data?.notification_preferences as NotificationPreferences | null) ?? null
  if (!prefs) return { success: true, data: DEFAULT_NOTIFICATION_PREFERENCES }

  return { success: true, data: prefs }
}

/**
 * Replace the user's notification preferences with the supplied JSON.
 * The whole object is written — partial updates happen client-side
 * before this call. This keeps the write atomic and means a malformed
 * partial-update doesn't drift the shape over time.
 */
export async function updateNotificationPreferences(
  prefs: NotificationPreferences
): Promise<Result<void>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .update({ notification_preferences: prefs })
    .eq('id', user.id)

  if (error) {
    return { success: false, error: 'Could not save notification preferences' }
  }

  return { success: true }
}
