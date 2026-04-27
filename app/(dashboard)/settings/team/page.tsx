import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TeamInvitations } from '@/components/settings/team-invitations'

export default async function TeamSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/dashboard')
  const isAdmin = profile.role === 'owner' || profile.role === 'admin'
  if (!isAdmin) redirect('/settings/profile')

  const [{ data: membersRaw }, { data: invitesRaw }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('team_invitations')
      .select('id, email, role, status, created_at, expires_at')
      .eq('organization_id', profile.organization_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ])

  return (
    <div className="max-w-2xl">
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>Manage team members and send invitations.</CardDescription>
        </CardHeader>
        <CardContent>
          <TeamInvitations
            pendingInvitations={(invitesRaw || []) as any}
            teamMembers={(membersRaw || []) as any}
            currentUserId={user.id}
          />
        </CardContent>
      </Card>
    </div>
  )
}
