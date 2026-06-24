import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChangePasswordForm } from '@/components/settings/change-password-form'
import { TwoFactorSection } from '@/components/mfa/two-factor-section'
import { ActiveSessionsCard } from '@/components/settings/active-sessions-card'
import { listMyFactors } from '@/lib/actions/mfa'
import { countMyRecoveryCodes } from '@/lib/actions/mfa-recovery-codes'
import { listMyActiveSessions } from '@/lib/actions/active-sessions'

/**
 * Personal → Security sub-page (Wave 1.2 / S07 §2.5, A-8 + A-8b).
 *
 * Per-user MFA + password live here; the org-wide MFA policy stays on
 * /settings/organization per the locked Q8 split.
 *
 * Layout matches `Merge Notifications Security.dc.html` §A-8: Password
 * (left) + Two-factor + recovery codes (right) in a 2-column grid on
 * md+; Active sessions card below. A-8b added the recovery-codes row
 * inside the MFA card + the Active sessions card backed by Migration
 * 058's SECURITY DEFINER wrappers around auth.sessions.
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

  // A-8b — recovery codes + active sessions
  const codesResult = await countMyRecoveryCodes()
  const recoveryCodesRemaining = codesResult.success ? codesResult.data : 0

  const sessionsResult = await listMyActiveSessions()
  const sessions = sessionsResult.success ? sessionsResult.data : []

  // The JWT carries `session_id`; decode the payload (no verification —
  // we're just reading our own claim to highlight "This device" in the
  // sessions list).
  const { data: { session } } = await supabase.auth.getSession()
  const currentSessionId = readSessionIdFromJwt(session?.access_token)

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
          recoveryCodesRemaining={recoveryCodesRemaining}
        />
      </div>

      <ActiveSessionsCard sessions={sessions} currentSessionId={currentSessionId} />
    </div>
  )
}

function readSessionIdFromJwt(token: string | undefined): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const payload = parts[1]!
    // base64url → base64
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = Buffer.from(b64, 'base64').toString('utf8')
    const parsed = JSON.parse(json) as { session_id?: string }
    return typeof parsed.session_id === 'string' ? parsed.session_id : null
  } catch {
    return null
  }
}
