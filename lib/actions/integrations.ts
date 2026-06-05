'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit-log'
import { getAuthContext } from './index'

export type LinkedInIntegration = {
  external_page_id: string
  external_page_name: string
  connected_at: string
  token_expires_at: string | null
}

export async function getLinkedInIntegration(): Promise<LinkedInIntegration | null> {
  const ctx = await getAuthContext()
  if (!ctx) return null

  const { data } = await ctx.supabase
    .from('organization_integrations')
    .select('external_page_id, external_page_name, connected_at, token_expires_at')
    .eq('organization_id', ctx.orgId)
    .eq('platform', 'linkedin')
    .eq('is_active', true)
    .single()

  return data ?? null
}

export async function disconnectLinkedInIntegration(): Promise<
  { success: true } | { success: false; error: string }
> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('organization_integrations')
    .delete()
    .eq('organization_id', ctx.orgId)
    .eq('platform', 'linkedin')

  if (error) {
    console.error('[integrations] LinkedIn disconnect failed:', error)
    return { success: false, error: 'Failed to disconnect LinkedIn' }
  }

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'integration',
    entityId: null,
    action: 'disconnected',
    message: 'LinkedIn integration disconnected',
    details: { platform: 'linkedin' },
  })

  revalidatePath('/settings/integrations')
  return { success: true }
}
