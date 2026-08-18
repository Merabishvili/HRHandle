import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileForm } from '@/components/settings/profile-form'
import { AvatarUpload } from '@/components/settings/avatar-upload'

/**
 * Personal → Profile sub-page.
 *
 * Per Wave 1.2 / S07 §2.3, password + two-factor moved out to
 * /settings/security. This page covers identity (name / title / photo)
 * and read-only account info.
 */
export default async function ProfileSettingsPage() {
  const t = await getTranslations()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organization_id, full_name, email, avatar_url, phone, language, role, is_active, created_at, updated_at, google_refresh_token, zoom_refresh_token')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/pipeline')

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="border-border">
        <CardHeader>
          <CardTitle>{t('settings.profile.title')}</CardTitle>
          <CardDescription>{t('settings.profile.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <AvatarUpload currentUrl={profile.avatar_url} fullName={profile.full_name} />
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>{t('settings.profile.accountTitle')}</CardTitle>
          <CardDescription>{t('settings.profile.accountSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('columns.email')}</span>
            <span className="text-sm font-medium">{user.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('settings.profile.role')}</span>
            <span className="text-sm font-medium">
              {t(`team.role${profile.role.charAt(0).toUpperCase()}${profile.role.slice(1)}`)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('settings.profile.memberSince')}</span>
            <span className="text-sm font-medium">
              {new Date(profile.created_at).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
