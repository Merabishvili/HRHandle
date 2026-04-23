import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileForm } from '@/components/settings/profile-form'
import { OrganizationForm } from '@/components/settings/organization-form'
import { TeamInvitations } from '@/components/settings/team-invitations'
import { GoogleCalendarConnect } from '@/components/settings/google-calendar-connect'

import { Suspense } from 'react'

interface ProfileRow {
  id: string
  organization_id: string | null
  full_name: string
  email: string | null
  avatar_url: string | null
  phone: string | null
  role: 'owner' | 'admin' | 'member'
  is_active: boolean
  created_at: string
  updated_at: string
  google_refresh_token: string | null
  organizations:
    | {
        id: string
        name: string
        slug: string
        logo_url: string | null
        is_active: boolean
        created_at: string
        updated_at: string
      }[]
    | null
}

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select(`
      id,
      organization_id,
      full_name,
      email,
      avatar_url,
      phone,
      role,
      is_active,
      created_at,
      updated_at,
      google_refresh_token,
      organizations (
        id,
        name,
        slug,
        logo_url,
        is_active,
        created_at,
        updated_at
      )
    `)
    .eq('id', user.id)
    .single()

  const profile = profileRaw as ProfileRow | null

  if (!profile) {
    redirect('/dashboard')
  }

  const organization = profile.organizations?.[0] || null
  const isOwner = profile.role === 'owner'
  const canManageTeam = profile.role === 'owner' || profile.role === 'admin'

  let teamMembers: { id: string; full_name: string; email: string | null; role: string }[] = []
  let pendingInvitations: { id: string; email: string; role: string; status: string; created_at: string; expires_at: string }[] = []

  if (canManageTeam && profile.organization_id) {
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
    teamMembers = (membersRaw || []) as typeof teamMembers
    pendingInvitations = (invitesRaw || []) as typeof pendingInvitations
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account and organization settings.</p>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your personal information.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} email={user.email || ''} />
        </CardContent>
      </Card>

      {isOwner && organization && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>Manage your organization settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizationForm organization={organization} />
          </CardContent>
        </Card>
      )}

      {canManageTeam && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Team</CardTitle>
            <CardDescription>Manage team members and send invitations.</CardDescription>
          </CardHeader>
          <CardContent>
            <TeamInvitations
              pendingInvitations={pendingInvitations}
              teamMembers={teamMembers}
              currentUserId={user.id}
            />
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Connect external services to enhance your workflow.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <GoogleCalendarConnect isConnected={!!profile.google_refresh_token} />
          </Suspense>
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
    </div>
  )
}