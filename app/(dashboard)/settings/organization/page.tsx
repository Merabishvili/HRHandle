import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OrganizationForm } from '@/components/settings/organization-form'

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
    .select('id, name, slug, logo_url, is_active, created_at, updated_at')
    .eq('id', profile.organization_id)
    .single()

  if (!organization) redirect('/settings/profile')

  return (
    <div className="max-w-2xl">
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Manage your organization settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationForm organization={organization} />
        </CardContent>
      </Card>
    </div>
  )
}
