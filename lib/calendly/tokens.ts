import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { refreshAccessToken } from '@/lib/calendly/oauth'

/**
 * Calendly access tokens live 2 hours. Every server path that calls the
 * Calendly API goes through here so a stale token is refreshed first.
 *
 * Deliberately NOT in a 'use server' file: exported functions there become
 * callable server actions, and this one hands back a token for an id.
 * Tokens are read with the service role — org members can't select them.
 */
export function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true
  return new Date(expiresAt).getTime() <= Date.now() + 60_000 // 1 min skew
}

export async function ensureFreshToken(integrationId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data: row } = await supabase
    .from('organization_integrations')
    .select('access_token, refresh_token, token_expires_at')
    .eq('id', integrationId)
    .single()
  if (!row) return null
  if (!isTokenExpired(row.token_expires_at as string | null)) return row.access_token as string
  if (!row.refresh_token) return null
  try {
    const fresh = await refreshAccessToken(row.refresh_token as string)
    const expiresAt = new Date(Date.now() + fresh.expires_in * 1000).toISOString()
    await supabase
      .from('organization_integrations')
      .update({
        access_token: fresh.access_token,
        refresh_token: fresh.refresh_token,
        token_expires_at: expiresAt,
      })
      .eq('id', integrationId)
    return fresh.access_token
  } catch (err) {
    console.error('[calendly] refresh failed:', err)
    return null
  }
}
