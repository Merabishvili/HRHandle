'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import {
  RECOVERY_CODE_COUNT,
  generateRecoveryCodes,
  hashRecoveryCode,
} from '@/lib/mfa/recovery-codes'

/**
 * A-8b — Server actions for MFA recovery codes.
 *
 * Generation happens server-side so the raw codes never have to round-
 * trip through the client's untrusted random source. They are returned
 * to the caller ONCE for a reveal-once modal and never persisted in
 * raw form — only sha256-hashed.
 */

export async function countMyRecoveryCodes(): Promise<ActionResult<number>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data, error } = await ctx.supabase.rpc('count_mfa_recovery_codes')
  if (error) return { success: false, error: 'Could not load recovery codes' }
  return { success: true, data: (data as number) ?? 0 }
}

/**
 * Generates a fresh set of recovery codes, replaces the user's stored
 * hashes, and returns the raw codes to the client ONCE. Caller should
 * display them in a reveal-once modal and warn the user that
 * regenerating again will invalidate this set.
 */
export async function regenerateMyRecoveryCodes(): Promise<
  ActionResult<{ codes: string[]; total: number }>
> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const codes = generateRecoveryCodes(RECOVERY_CODE_COUNT)
  const hashes = codes.map(hashRecoveryCode)

  const { error } = await ctx.supabase.rpc('replace_mfa_recovery_codes', {
    p_code_hashes: hashes,
  })
  if (error) {
    return { success: false, error: 'Could not save recovery codes' }
  }

  revalidatePath('/settings/security')
  return { success: true, data: { codes, total: codes.length } }
}
