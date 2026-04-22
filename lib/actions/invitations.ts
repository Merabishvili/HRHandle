'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getAuthContext, checkPlanLimit, type ActionResult } from './index'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTeamInviteEmail } from '@/lib/email'

const InviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'member']),
})

export async function inviteTeamMember(
  email: string,
  role: 'admin' | 'member'
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return { success: false, error: 'Only owners and admins can invite team members' }
  }

  const parsed = InviteSchema.safeParse({ email, role })
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

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

  revalidatePath('/settings')
  return { success: true, data: undefined }
}

export async function revokeInvitation(invitationId: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
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

export async function acceptInvitation(token: string): Promise<ActionResult<{ orgId: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: invite } = await admin
    .from('team_invitations')
    .select('id, organization_id, email, role, expires_at, status')
    .eq('token', token)
    .single()

  if (!invite) return { success: false, error: 'Invitation not found or already used.' }
  if (invite.status !== 'pending') return { success: false, error: 'This invitation has already been used or revoked.' }
  if (new Date(invite.expires_at) < new Date()) return { success: false, error: 'This invitation has expired.' }

  // Link this user to the invited org
  const { error: profileError } = await admin
    .from('profiles')
    .update({ organization_id: invite.organization_id, role: invite.role })
    .eq('id', ctx.userId)

  if (profileError) return { success: false, error: 'Failed to join organization.' }

  // Mark invite accepted
  await admin
    .from('team_invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  return { success: true, data: { orgId: invite.organization_id } }
}
