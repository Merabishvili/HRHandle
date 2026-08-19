'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import { isOrgAdmin } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit-log'
import { defaultFactorName, normalizeTotpCode, isValidTotpCode, type FactorSummary } from '@/lib/mfa/factors'
import type { OrgMfaPolicy } from '@/lib/mfa/policy'

export interface EnrollStartResult {
  factorId: string
  qrCodeSvg: string // SVG XML returned by Supabase
  secret: string // base32 secret — shown as fallback for manual entry
  uri: string // otpauth:// URI
}

export async function listMyFactors(): Promise<ActionResult<FactorSummary[]>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }
  const { data, error } = await ctx.supabase.auth.mfa.listFactors()
  if (error) return { success: false, error: error.message, code: 'EXTERNAL_SERVICE' }
  const totp = data?.totp ?? []
  return {
    success: true,
    data: totp.map((f) => ({
      id: f.id,
      type: f.factor_type as 'totp',
      friendly_name: f.friendly_name ?? null,
      status: f.status as 'verified' | 'unverified',
      created_at: f.created_at,
    })),
  }
}

export async function startEnrollment(): Promise<ActionResult<EnrollStartResult>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }

  // Abandoned enrollments (QR dialog closed before verifying) leave an
  // UNVERIFIED factor behind — Supabase does NOT reliably auto-clean these, and
  // re-enrolling then fails with "a factor with the friendly name … already
  // exists". Sweep any unverified TOTP factors first so the retry succeeds.
  // (`listFactors().totp` is verified-only; the unverified ones are in `.all`.)
  const { data: existing } = await ctx.supabase.auth.mfa.listFactors()
  const staleUnverified = (existing?.all ?? []).filter(
    (f) => f.factor_type === 'totp' && f.status === 'unverified',
  )
  for (const f of staleUnverified) {
    await ctx.supabase.auth.mfa.unenroll({ factorId: f.id })
  }

  const { data, error } = await ctx.supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: defaultFactorName(),
  })
  if (error || !data) {
    return { success: false, error: error?.message ?? 'Failed to start enrollment', code: 'EXTERNAL_SERVICE' }
  }

  return {
    success: true,
    data: {
      factorId: data.id,
      qrCodeSvg: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    },
  }
}

export async function verifyEnrollment(
  factorId: string,
  code: string
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }

  const cleaned = normalizeTotpCode(code)
  if (!isValidTotpCode(cleaned)) {
    return { success: false, error: 'Code must be 6 digits', code: 'VALIDATION' }
  }

  const { data: challenge, error: chErr } = await ctx.supabase.auth.mfa.challenge({ factorId })
  if (chErr || !challenge) {
    return { success: false, error: chErr?.message ?? 'Failed to start challenge', code: 'EXTERNAL_SERVICE' }
  }

  const { error: verifyErr } = await ctx.supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: cleaned,
  })
  if (verifyErr) {
    return { success: false, error: 'Code did not match. Try again with a fresh code.', code: 'VALIDATION' }
  }

  // Cache enrolled state on the profile so middleware can gate without
  // calling listFactors on every request.
  await ctx.supabase
    .from('profiles')
    .update({ mfa_enrolled: true })
    .eq('id', ctx.userId)

  await writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'profile',
    entityId: ctx.userId,
    action: 'mfa_enrolled',
    message: 'enrolled a TOTP authenticator',
    details: { factor_type: 'totp' },
  })

  revalidatePath('/settings/security')
  return { success: true, data: undefined }
}

export async function unenrollFactor(factorId: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }

  // Refuse if org policy still requires MFA for this user.
  const { data: org } = await ctx.supabase
    .from('organizations')
    .select('require_mfa, require_mfa_for_admins')
    .eq('id', ctx.orgId)
    .single()

  if (org) {
    const wouldStillRequire =
      (org.require_mfa as boolean) ||
      ((org.require_mfa_for_admins as boolean) && isOrgAdmin(ctx.role))
    if (wouldStillRequire) {
      // Only block if this is the user's last verified factor.
      const { data: factors } = await ctx.supabase.auth.mfa.listFactors()
      const remainingVerified = (factors?.totp ?? []).filter(
        (f) => f.status === 'verified' && f.id !== factorId
      )
      if (remainingVerified.length === 0) {
        return {
          success: false,
          error:
            'Your organization requires MFA. Ask an owner to lower the policy, or enroll another factor before removing this one.',
          code: 'FORBIDDEN',
        }
      }
    }
  }

  const { error } = await ctx.supabase.auth.mfa.unenroll({ factorId })
  if (error) {
    return { success: false, error: error.message, code: 'EXTERNAL_SERVICE' }
  }

  // Recompute mfa_enrolled flag: true if any verified factor remains.
  const { data: factorsAfter } = await ctx.supabase.auth.mfa.listFactors()
  const stillEnrolled = (factorsAfter?.totp ?? []).some((f) => f.status === 'verified')
  await ctx.supabase
    .from('profiles')
    .update({ mfa_enrolled: stillEnrolled })
    .eq('id', ctx.userId)

  await writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'profile',
    entityId: ctx.userId,
    action: 'mfa_removed',
    message: 'removed a TOTP authenticator',
    details: { factor_id_prefix: factorId.slice(0, 8) },
  })

  revalidatePath('/settings/security')
  return { success: true, data: undefined }
}

export interface MfaChallengeStartResult {
  factorId: string
  challengeId: string
}

export async function startLoginChallenge(): Promise<ActionResult<MfaChallengeStartResult>> {
  // No org context needed here — the user is mid-login.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }

  const { data: factors } = await supabase.auth.mfa.listFactors()
  const verified = (factors?.totp ?? []).find((f) => f.status === 'verified')
  if (!verified) {
    return { success: false, error: 'No verified factor on this account', code: 'NOT_FOUND' }
  }

  const { data: challenge, error } = await supabase.auth.mfa.challenge({ factorId: verified.id })
  if (error || !challenge) {
    return { success: false, error: error?.message ?? 'Challenge failed', code: 'EXTERNAL_SERVICE' }
  }

  return { success: true, data: { factorId: verified.id, challengeId: challenge.id } }
}

export async function completeLoginChallenge(
  factorId: string,
  challengeId: string,
  code: string
): Promise<ActionResult<void>> {
  const cleaned = normalizeTotpCode(code)
  if (!isValidTotpCode(cleaned)) {
    return { success: false, error: 'Code must be 6 digits', code: 'VALIDATION' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code: cleaned })
  if (error) {
    return { success: false, error: 'Code did not match. Try again with a fresh code.', code: 'VALIDATION' }
  }
  return { success: true, data: undefined }
}

/* ---------------- Org policy ---------------- */

export async function setOrgMfaPolicy(input: OrgMfaPolicy): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }
  if (ctx.role !== 'owner') {
    return { success: false, error: 'Only the owner can change MFA policy', code: 'FORBIDDEN' }
  }
  const { error } = await ctx.supabase
    .from('organizations')
    .update({
      require_mfa: !!input.require_mfa,
      require_mfa_for_admins: !!input.require_mfa_for_admins,
    })
    .eq('id', ctx.orgId)
  if (error) return { success: false, error: 'Failed to update policy', code: 'DB_ERROR' }

  await writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'organization',
    entityId: ctx.orgId,
    action: 'mfa_policy_updated',
    message: `Updated MFA policy — all=${input.require_mfa ? 'on' : 'off'}, admins=${input.require_mfa_for_admins ? 'on' : 'off'}`,
    details: input as unknown as Record<string, unknown>,
  })
  revalidatePath('/settings/organization')
  return { success: true, data: undefined }
}

/* ---------------- Admin recovery: reset a teammate's factors ---------------- */

export async function adminResetUserFactors(targetUserId: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can reset MFA', code: 'FORBIDDEN' }
  }
  if (targetUserId === ctx.userId) {
    return { success: false, error: 'Use the unenroll button on your own Security page', code: 'VALIDATION' }
  }

  // Confirm target is in this org.
  const { data: targetProfile } = await ctx.supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', targetUserId)
    .single()
  if (!targetProfile || targetProfile.organization_id !== ctx.orgId) {
    return { success: false, error: 'User not in this organisation', code: 'NOT_FOUND' }
  }
  if ((targetProfile.role as string) === 'owner') {
    return { success: false, error: 'You cannot reset the owner\'s MFA', code: 'FORBIDDEN' }
  }

  const admin = createAdminClient()
  // The admin client's high-level `auth.admin.mfa` surface doesn't expose
  // "list factors for another user", so we use a SECURITY DEFINER Postgres
  // function (created in migration 042) that deletes everything from
  // `auth.mfa_factors` for the target user. We gate access in this action.
  try {
    await admin.rpc('admin_delete_user_mfa_factors', { target_user_id: targetUserId })
  } catch (err) {
    console.error('[mfa] admin reset factors RPC failed:', err)
  }

  await admin.from('profiles').update({ mfa_enrolled: false }).eq('id', targetUserId)

  await writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'profile',
    entityId: targetUserId,
    action: 'mfa_admin_reset',
    message: 'Cleared a teammate\'s MFA factors',
    details: { target_user_id: targetUserId },
  })

  revalidatePath('/settings/team')
  return { success: true, data: undefined }
}
