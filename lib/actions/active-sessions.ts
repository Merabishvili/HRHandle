'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'

/**
 * A-8b — Active sessions server actions.
 *
 * Supabase Auth manages `auth.sessions` directly; the schema isn't
 * exposed through PostgREST. The Migration 058 SECURITY DEFINER
 * wrappers (`list_my_sessions`, `delete_my_session`,
 * `delete_my_other_sessions`) let us list + revoke without holding a
 * service-role key.
 */

export interface ActiveSession {
  id: string
  user_agent: string | null
  ip: string | null
  created_at: string
  refreshed_at: string | null
  not_after: string | null
}

export async function listMyActiveSessions(): Promise<ActionResult<ActiveSession[]>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data, error } = await ctx.supabase.rpc('list_my_sessions')
  if (error) return { success: false, error: 'Could not load sessions' }

  return { success: true, data: ((data ?? []) as ActiveSession[]) }
}

export async function revokeSession(sessionId: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!sessionId) return { success: false, error: 'Session id required' }

  const { error } = await ctx.supabase.rpc('delete_my_session', {
    p_session_id: sessionId,
  })
  if (error) return { success: false, error: 'Could not sign out that session' }

  revalidatePath('/settings/security')
  return { success: true, data: undefined }
}

/**
 * Signs out every session except the caller's own. Returns how many
 * sessions were terminated so the toast can read "Signed out N other
 * sessions". `currentSessionId` is optional but recommended — without
 * it, the caller's session is also terminated.
 */
export async function revokeOtherSessions(
  currentSessionId: string | null,
): Promise<ActionResult<{ revoked: number }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data, error } = await ctx.supabase.rpc('delete_my_other_sessions', {
    p_current_session_id: currentSessionId,
  })
  if (error) return { success: false, error: 'Could not sign out other sessions' }

  revalidatePath('/settings/security')
  return { success: true, data: { revoked: (data as number) ?? 0 } }
}
