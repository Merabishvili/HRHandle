import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChangePasswordForm } from '@/components/settings/change-password-form'
import { TwoFactorSection } from '@/components/mfa/two-factor-section'
import { listMyFactors } from '@/lib/actions/mfa'

/**
 * Personal → Security sub-page (Wave 1.2 / S07 §2.5, A-8 layout).
 *
 * Per-user MFA + password live here; the org-wide MFA policy stays on
 * /settings/organization per the locked Q8 split (the redesign keeps both
 * surfaces — adding a separate org-level Security sub-page for one toggle
 * card is overkill).
 *
 * Layout matches `Merge Notifications Security.dc.html` §A-8: Password
 * (left) + Two-factor (right) in a 2-column grid on md+, stacked on
 * mobile. Recovery codes + Active sessions are deferred to A-8b — they
 * need new infrastructure (recovery_codes table; service-role session
 * listing) that's out of scope for the layout pass.
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
    <div className="max-w-4xl space-y-6">
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>
              {isOAuthOnly
                ? 'Managed by your social sign-in provider.'
                : 'You will remain signed in on this device after updating.'}
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
    </div>
  )
}
