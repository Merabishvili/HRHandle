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
    .select('role, organization_id, organizations(id, name, slug, logo_url, is_active, created_at, updated_at)')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'owner') redirect('/settings/profile')

  const organization = (profile.organizations as any)?.[0] || null
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
