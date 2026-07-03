'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getAuthContext, checkPlanLimit, type ActionResult } from './index'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTeamInviteEmail } from '@/lib/email'
import { createOrgNotifications } from '@/lib/actions/notifications'
import { isOrgAdmin } from '@/lib/permissions'

const InviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'member']),
})

const MAX_INVITES_PER_USER_PER_HOUR = 25

export async function inviteTeamMember(
  email: string,
  role: 'admin' | 'member'
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can invite team members' }
  }

  const parsed = InviteSchema.safeParse({ email, role })
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Validation failed" }

  const limitError = await checkPlanLimit(ctx, 'member')
  if (limitError) return { success: false, error: limitError }

  // Prevent inviting someone already in the org
  const { data: existing } = await ctx.supabase
    .from('profiles')
    .select('id')
    .eq('email', parsed.data.email)
    .eq('organization_id', ctx.orgId)
    .single()

  if (existing) {
    return { success: false, error: 'This person is already a member of your organization.' }
  }

  // Prevent duplicate pending invite
  const { data: existingInvite } = await ctx.supabase
    .from('team_invitations')
    .select('id')
    .eq('organization_id', ctx.orgId)
    .eq('email', parsed.data.email)
    .eq('status', 'pending')
    .single()

  if (existingInvite) {
    return { success: false, error: 'An invitation is already pending for this email.' }
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recentInvites } = await ctx.supabase
    .from('team_invitations')
    .select('id', { count: 'exact', head: true })
    .eq('invited_by', ctx.userId)
    .gte('created_at', oneHourAgo)

  if ((recentInvites ?? 0) >= MAX_INVITES_PER_USER_PER_HOUR) {
    return {
      success: false,
      error: 'Too many invitations sent recently. Please try again in an hour.',
    }
  }

  const admin = createAdminClient()

  // Fetch inviter name and org name for the email
  const [{ data: inviterProfile }, { data: org }] = await Promise.all([
    admin.from('profiles').select('full_name').eq('id', ctx.userId).single(),
    admin.from('organizations').select('name').eq('id', ctx.orgId).single(),
  ])

  const { data: invite, error } = await admin
    .from('team_invitations')
    .insert({
      organization_id: ctx.orgId,
      email: parsed.data.email,
      role: parsed.data.role,
      invited_by: ctx.userId,
    })
    .select('token')
    .single()

  if (error || !invite) {
    return { success: false, error: 'Failed to create invitation' }
  }

  try {
    await sendTeamInviteEmail({
      to: parsed.data.email,
      inviterName: inviterProfile?.full_name || 'A team member',
      organizationName: org?.name || 'your organization',
      role: parsed.data.role,
      token: invite.token,
    })
  } catch {
    // Email failure: clean up and surface the error
    await admin.from('team_invitations').delete().eq('token', invite.token)
    return { success: false, error: 'Failed to send invitation email. Please try again.' }
  }

  // Notify other org owners + admins (not the sender) that an invite went out.
  // Best-effort: failures are logged but don't roll back the invitation.
  try {
    const { data: members } = await admin
      .from('profiles')
      .select('id')
      .eq('organization_id', ctx.orgId)
      .in('role', ['owner', 'admin'])
      .neq('id', ctx.userId)

    const recipientIds = (members || []).map((m) => m.id)
    if (recipientIds.length > 0) {
      await createOrgNotifications(ctx.orgId, recipientIds, {
        type: 'team_invite_sent',
        title: `Team invite sent to ${parsed.data.email}`,
        body: `${inviterProfile?.full_name || 'A team member'} invited a new ${parsed.data.role}`,
        link: '/settings/team',
      })
    }
  } catch (err) {
    console.error('[invitations] post-send notification failed:', err)
  }

  revalidatePath('/settings')
  return { success: true, data: undefined }
}

export async function revokeInvitation(invitationId: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can revoke invitations' }
  }

  const { error } = await ctx.supabase
    .from('team_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)
    .eq('organization_id', ctx.orgId)
    .eq('status', 'pending')

  if (error) return { success: false, error: 'Failed to revoke invitation' }

  revalidatePath('/settings')
  return { success: true, data: undefined }
}

export async function resendInvitation(invitationId: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can resend invitations' }
  }

  const admin = createAdminClient()

  const { data: invite } = await admin
    .from('team_invitations')
    .select('id, email, role, token, status')
    .eq('id', invitationId)
    .eq('organization_id', ctx.orgId)
    .single()

  if (!invite || invite.status !== 'pending') {
    return { success: false, error: 'Invitation not found or no longer pending.' }
  }

  const [{ data: inviterProfile }, { data: org }] = await Promise.all([
    admin.from('profiles').select('full_name').eq('id', ctx.userId).single(),
    admin.from('organizations').select('name').eq('id', ctx.orgId).single(),
  ])

  // Refresh the expiry window so a resent invite isn't already near-dead.
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  try {
    await sendTeamInviteEmail({
      to: invite.email as string,
      inviterName: inviterProfile?.full_name || 'A team member',
      organizationName: org?.name || 'your organization',
      role: invite.role as 'admin' | 'member',
      token: invite.token as string,
    })
  } catch {
    return { success: false, error: 'Failed to resend invitation email. Please try again.' }
  }

  await admin
    .from('team_invitations')
    .update({ expires_at: newExpiry })
    .eq('id', invite.id)

  revalidatePath('/settings')
  return { success: true, data: undefined }
}

export async function updateMemberRole(
  memberId: string,
  role: 'admin' | 'member',
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can change roles' }
  }
  if (memberId === ctx.userId) {
    return { success: false, error: 'You cannot change your own role.' }
  }

  const admin = createAdminClient()
  const { data: target } = await admin
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', memberId)
    .single()

  if (!target || target.organization_id !== ctx.orgId) {
    return { success: false, error: 'Member not found.' }
  }
  if (target.role === 'owner') {
    return { success: false, error: 'The owner role cannot be changed.' }
  }

  const { error } = await admin.from('profiles').update({ role }).eq('id', memberId)
  if (error) return { success: false, error: 'Failed to update role.' }

  revalidatePath('/settings')
  return { success: true, data: undefined }
}

export async function removeMember(memberId: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can remove members' }
  }
  if (memberId === ctx.userId) {
    return { success: false, error: 'You cannot remove yourself.' }
  }

  const admin = createAdminClient()
  const { data: target } = await admin
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', memberId)
    .single()

  if (!target || target.organization_id !== ctx.orgId) {
    return { success: false, error: 'Member not found.' }
  }
  if (target.role === 'owner') {
    return { success: false, error: 'The organization owner cannot be removed.' }
  }

  // Detach from the org (keeps their auth account; they lose org access).
  const { error } = await admin
    .from('profiles')
    .update({ organization_id: null, is_active: false })
    .eq('id', memberId)
  if (error) return { success: false, error: 'Failed to remove member.' }

  revalidatePath('/settings')
  return { success: true, data: undefined }
}

export async function acceptInvitation(token: string): Promise<ActionResult<{ orgId: string }>> {
  // Use createClient directly — the user may not have an org_id yet (pre-invite state)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: invite } = await admin
    .from('team_invitations')
    .select('id, organization_id, email, role, expires_at, status')
    .eq('token', token)
    .single()

  if (!invite) return { success: false, error: 'Invitation not found or already used.' }
  if (invite.status !== 'pending') return { success: false, error: 'This invitation has already been used or revoked.' }
  const now = new Date()
  if (new Date(invite.expires_at) <= now) return { success: false, error: 'This invitation has expired.' }

  // Verify the logged-in user's email matches the invited email
  if (!user.email || invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return { success: false, error: 'This invitation was sent to a different email address. Please sign out and sign in with the correct account.' }
  }

  // Block if the user already belongs to a different organization
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (existingProfile?.organization_id && existingProfile.organization_id !== invite.organization_id) {
    return { success: false, error: 'Your account already belongs to another organization. You cannot join a second one.' }
  }

  // Link this user to the invited org (upsert in case no profile row exists yet for a new signup)
  const { error: profileError } = await admin
    .from('profiles')
    .upsert({
      id: user.id,
      organization_id: invite.organization_id,
      role: invite.role,
      full_name: (user.user_metadata?.full_name as string | undefined)?.trim() || user.email || 'New Member',
      email: user.email ?? null,
      is_active: true,
    })

  if (profileError) return { success: false, error: 'Failed to join organization.' }

  // Mark invite accepted
  await admin
    .from('team_invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  return { success: true, data: { orgId: invite.organization_id } }
}
