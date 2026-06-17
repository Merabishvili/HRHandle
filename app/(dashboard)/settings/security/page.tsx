import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChangePasswordForm } from '@/components/settings/change-password-form'
import { TwoFactorSection } from '@/components/mfa/two-factor-section'
import { listMyFactors } from '@/lib/actions/mfa'

/**
 * Personal → Security sub-page (Wave 1.2 / S07 §2.5).
 *
 * Per-user MFA + password live here; the org-wide MFA policy stays on
 * /settings/organization per the locked Q8 split (the redesign keeps both
 * surfaces — adding a separate org-level Security sub-page for one toggle
 * card is overkill).
 */
export default async function SecuritySettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/dashboard')

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
          <CardTitle>Change password</CardTitle>
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
