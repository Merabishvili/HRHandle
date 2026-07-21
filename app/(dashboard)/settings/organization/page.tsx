import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OrganizationForm } from '@/components/settings/organization-form'
import { DangerZone } from '@/components/settings/danger-zone'
import { MfaPolicyCard } from '@/components/settings/mfa-policy-card'
import { AiFitPolicyCard } from '@/components/settings/ai-fit-policy-card'

export default async function OrganizationSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'owner') redirect('/settings/profile')
  if (!profile.organization_id) redirect('/settings/profile')

  const { data: organization } = await supabase
    .from('organizations')
    .select('id, name, slug, public_page_slug, logo_url, is_active, created_at, updated_at, require_mfa, require_mfa_for_admins')
    .eq('id', profile.organization_id)
    .single()

  if (!organization) redirect('/settings/profile')

  // Separate, graceful read so an unmigrated ai_fit_* column can never break the
  // whole settings page (the column ships in migration 20260722_ai_fit_analysis).
  const { data: aiFit } = await supabase
    .from('organizations')
    .select('ai_fit_enabled')
    .eq('id', organization.id)
    .single()

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Manage your organization settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationForm organization={organization} />
        </CardContent>
      </Card>

      <MfaPolicyCard
        initial={{
          require_mfa: !!organization.require_mfa,
          require_mfa_for_admins: !!organization.require_mfa_for_admins,
        }}
      />

      <AiFitPolicyCard initial={{ ai_fit_enabled: !!aiFit?.ai_fit_enabled }} />

      <DangerZone organizationName={organization.name} />
    </div>
  )
}
