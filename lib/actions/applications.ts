'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'

export async function updateApplicationStatus(
  applicationId: string,
  newStatusId: string
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { error } = await ctx.supabase
    .from('applications')
    .update({
      status_id: newStatusId,
      last_status_changed_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)

  if (error) return { success: false, error: 'Failed to update application status' }

  revalidatePath('/vacancies/[id]/pipeline', 'page')
  return { success: true, data: undefined }
}
