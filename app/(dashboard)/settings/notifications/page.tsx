import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NotificationPreferencesForm } from '@/components/settings/notification-preferences-form'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '@/lib/types/notification-preferences'

/**
 * Personal → Notifications sub-page (Wave 1.2 / Phase 0.7).
 *
 * The dispatcher side (createOrgNotifications, sendEmail callsites)
 * does not yet consume these preferences — that wiring is a follow-up
 * commit so this page can ship and start collecting opt-out signals.
 */
export default async function NotificationsSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('notification_preferences')
    .eq('id', user.id)
    .single()

  const initial =
    (profile?.notification_preferences as NotificationPreferences | null) ??
    DEFAULT_NOTIFICATION_PREFERENCES

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Choose how HRHandle reaches you.
        </p>
      </div>
      <NotificationPreferencesForm initial={initial} />
    </div>
  )
}
