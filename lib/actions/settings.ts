'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import { ProfileSchema, OrganizationSchema } from '@/lib/validations/settings'
import type { ProfileInput, OrganizationInput } from '@/lib/validations/settings'

export async function updateProfile(input: ProfileInput): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const parsed = ProfileSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  const { error } = await ctx.supabase
    .from('profiles')
    .update({
      full_name: parsed.data.full_name.trim(),
      phone: parsed.data.phone?.trim() || null,
    })
    .eq('id', ctx.userId)

  if (error) return { success: false, error: 'Failed to update profile' }

  revalidatePath('/settings')
  return { success: true, data: undefined }
}

export async function updateOrganization(
  orgId: string,
  input: OrganizationInput
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  // Only owners can update organization details
  if (ctx.role !== 'owner') {
    return { success: false, error: 'Only organization owners can update these settings' }
  }

  // Verify the org ID matches the user's org (RBAC check)
  if (orgId !== ctx.orgId) {
    return { success: false, error: 'Unauthorized' }
  }

  const parsed = OrganizationSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  const { error } = await ctx.supabase
    .from('organizations')
    .update({ name: parsed.data.name.trim() })
    .eq('id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to update organization' }

  revalidatePath('/settings')
  return { success: true, data: undefined }
}
