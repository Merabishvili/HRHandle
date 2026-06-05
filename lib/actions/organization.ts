'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit-log'

const DeleteOrgSchema = z.object({
  confirmName: z.string().trim().min(1, 'Please type the organization name'),
})

export type DeleteOrgResult =
  | { success: true }
  | { success: false; error: string }

/**
 * Self-serve "Delete Organization" action (G-007). Soft-deletes the org by
 * setting `organizations.deleted_at` and signs the user out. The daily purge
 * cron (`/api/cron/purge-deleted`) hard-deletes the row after the 30-day grace
 * period promised in Privacy Policy §7 and cascades to all child tables via
 * existing FK CASCADE rules, plus deletes the corresponding `auth.users` rows.
 *
 * Owner-only. The caller must pass `confirmName` matching the current
 * organization's name (case-insensitive trim) — the danger-zone UI enforces
 * this client-side; this is the server-side belt-and-braces check.
 */
export async function deleteOrganization(input: {
  confirmName: string
}): Promise<DeleteOrgResult> {
  const parsed = DeleteOrgSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Resolve the user's org + role via the admin client so RLS can't deny.
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return { success: false, error: 'No organization to delete' }
  }
  if (profile.role !== 'owner') {
    return { success: false, error: 'Only the organization owner can delete the organization' }
  }

  const { data: organization } = await admin
    .from('organizations')
    .select('id, name, deleted_at')
    .eq('id', profile.organization_id)
    .single()

  if (!organization) {
    return { success: false, error: 'Organization not found' }
  }

  // Idempotency: already scheduled for deletion — just sign out + redirect.
  if (organization.deleted_at) {
    await supabase.auth.signOut()
    redirect('/onboarding/account-deletion-scheduled')
  }

  // Belt-and-braces server-side name match. UI enforces it too.
  if (
    parsed.data.confirmName.trim().toLowerCase() !==
    String(organization.name).trim().toLowerCase()
  ) {
    return {
      success: false,
      error: 'The name you typed does not match the organization name',
    }
  }

  const { error: updateError } = await admin
    .from('organizations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', organization.id)
    .is('deleted_at', null) // re-check under-row to avoid racing duplicate clicks

  if (updateError) {
    return { success: false, error: 'Failed to schedule deletion' }
  }

  void writeAuditLog({
    orgId: organization.id,
    userId: user.id,
    entityType: 'organization',
    entityId: organization.id,
    action: 'deletion_scheduled',
    message: `Organization deletion scheduled by owner`,
    details: { confirmation_phrase_matched: true },
  })

  // Sign the user out so the next request hits the dashboard chokepoint
  // and is routed to the scheduled-deletion page (rather than staying on
  // /settings/organization which is now an inconsistent state).
  await supabase.auth.signOut()

  redirect('/onboarding/account-deletion-scheduled')
}
