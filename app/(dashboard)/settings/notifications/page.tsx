import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { NotificationPreferencesForm } from '@/components/settings/notification-preferences-form'
import {
  normalizeNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/types/notification-preferences'

/**
 * Personal → Notifications sub-page (Wave 1.2 / Phase 0.7, A-7 matrix).
 *
 * The dispatcher side (createOrgNotifications, sendEmail callsites) does
 * not yet consume the per-channel matrix — that wiring is a follow-up
 * commit so this page can ship and start collecting per-channel signals.
 *
 * The Slack column is only enabled when the org has at least one active
 * Slack webhook (G-030). Per-user Slack opt-in stacks on top of the
 * org-level `enabled_events` filter.
 */
export default async function NotificationsSettingsPage() {
  const t = await getTranslations()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('notification_preferences, organization_id')
    .eq('id', user.id)
    .single()

  const initial = normalizeNotificationPreferences(
    profile?.notification_preferences as Partial<NotificationPreferences> | null,
  )

  let slackAvailable = false
  if (profile?.organization_id) {
    const { count } = await supabase
      .from('webhook_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', profile.organization_id)
      .eq('channel_type', 'slack')
      .eq('is_active', true)
    slackAvailable = (count ?? 0) > 0
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t('settings.nav.notifications')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('notifPrefs.subtitle')}
        </p>
      </div>
      <NotificationPreferencesForm initial={initial} slackAvailable={slackAvailable} />
    </div>
  )
}
