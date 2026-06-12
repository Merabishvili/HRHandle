import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileForm } from '@/components/settings/profile-form'
import { ChangePasswordForm } from '@/components/settings/change-password-form'
import { TwoFactorSection } from '@/components/mfa/two-factor-section'
import { listMyFactors } from '@/lib/actions/mfa'

export default async function ProfileSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organization_id, full_name, email, avatar_url, phone, role, is_active, created_at, updated_at, google_refresh_token, zoom_refresh_token')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/dashboard')

  // Detect OAuth-only accounts (no email/password identity)
  const isOAuthOnly = !user.identities?.some((i) => i.provider === 'email')

  const { data: org } = await supabase
    .from('organizations')
    .select('require_mfa, require_mfa_for_admins')
    .eq('id', profile.organization_id)
    .single()

  const factorsResult = await listMyFactors()
  const factors = factorsResult.success ? factorsResult.data : []

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your personal information.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} email={user.email || ''} />
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your account information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{user.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Role</span>
            <span className="text-sm font-medium capitalize">{profile.role}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Member since</span>
            <span className="text-sm font-medium">
              {new Date(profile.created_at).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Update your password. You will remain signed in on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm
            userEmail={user.email ?? ''}
            isOAuthOnly={isOAuthOnly}
          />
        </CardContent>
      </Card>

      <TwoFactorSection
        factors={factors}
        role={profile.role as 'owner' | 'admin' | 'member'}
        orgPolicy={{
          require_mfa: !!org?.require_mfa,
          require_mfa_for_admins: !!org?.require_mfa_for_admins,
        }}
      />
    </div>
  )
}
