'use server'

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
