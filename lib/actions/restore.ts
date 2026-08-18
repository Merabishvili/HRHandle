'use server'

import { revalidatePath } from 'next/cache'

import { getAuthContext, type ActionResult } from './index'
import { isOrgAdmin } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit-log'
import { extractRestoreImpact } from '@/lib/trash/impact'

export interface TrashedCandidate {
  id: string
  first_name: string
  last_name: string
  email: string | null
  deleted_at: string
  cascadedApplicationIds: string[]
}

export interface TrashedVacancy {
  id: string
  title: string
  department: string | null
  location: string | null
  deleted_at: string
}

/** List candidates this org has soft-deleted. Owner+admin only. */
export async function getTrashedCandidates(): Promise<
  ActionResult<TrashedCandidate[]>
> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) return { success: false, error: 'Not authorized' }

  // Soft-deleted candidates filtered by RLS to this org's rows.
  const { data: candidates, error } = await ctx.supabase
    .from('candidates')
    .select('id, first_name, last_name, email, deleted_at')
    .eq('organization_id', ctx.orgId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (error) {
    console.error('[restore] list candidates failed:', error.message)
    return { success: false, error: 'Failed to list trashed candidates' }
  }

  // Look up the most recent `candidate_deleted` audit row per candidate so we
  // can tell the recruiter how many applications restore would bring back.
  // Single query keyed by entity_id; small list at HRHandle's scale.
  const candidateIds = (candidates ?? []).map((c) => c.id as string)
  let detailsById = new Map<string, Record<string, unknown>>()
  if (candidateIds.length > 0) {
    const { data: auditRows } = await ctx.supabase
      .from('activity_log')
      .select('entity_id, details, created_at')
      .eq('organization_id', ctx.orgId)
      .eq('action', 'candidate_deleted')
      .in('entity_id', candidateIds)
      .order('created_at', { ascending: false })

    type AuditRow = { entity_id: string; details: Record<string, unknown> | null }
    for (const row of (auditRows ?? []) as AuditRow[]) {
      // Keep the first (most recent) row per candidate.
      if (!detailsById.has(row.entity_id) && row.details) {
        detailsById.set(row.entity_id, row.details)
      }
    }
  }

  const out: TrashedCandidate[] = (candidates ?? []).map((c) => {
    const impact = extractRestoreImpact(detailsById.get(c.id as string))
    return {
      id: c.id as string,
      first_name: (c.first_name as string) ?? '',
      last_name: (c.last_name as string) ?? '',
      email: (c.email as string | null) ?? null,
      deleted_at: c.deleted_at as string,
      cascadedApplicationIds: impact.cascadedApplicationIds,
    }
  })

  return { success: true, data: out }
}

/** List vacancies this org has soft-deleted. Owner+admin only. */
export async function getTrashedVacancies(): Promise<ActionResult<TrashedVacancy[]>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) return { success: false, error: 'Not authorized' }

  const { data, error } = await ctx.supabase
    .from('vacancies')
    .select('id, title, department, location, deleted_at')
    .eq('organization_id', ctx.orgId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (error) {
    console.error('[restore] list vacancies failed:', error.message)
    return { success: false, error: 'Failed to list trashed vacancies' }
  }

  return {
    success: true,
    data: (data ?? []).map((v) => ({
      id: v.id as string,
      title: (v.title as string) ?? '',
      department: (v.department as string | null) ?? null,
      location: (v.location as string | null) ?? null,
      deleted_at: v.deleted_at as string,
    })),
  }
}

/** Un-delete the candidate. Pulls the cascaded application IDs from the
 * candidate_deleted audit row (BL-007) and un-deletes those too so the
 * vacancy pipelines reappear correctly. Audit-logged as candidate_restored. */
export async function restoreCandidate(
  candidateId: string,
): Promise<ActionResult<{ restoredApplications: number }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can restore candidates.' }
  }

  // Pull the cascaded application IDs from the most recent candidate_deleted
  // row. If no row exists (older candidate deleted before BL-007 landed), we
  // simply skip the application un-delete — the recruiter can manually add
  // those applications back if they remember them.
  const { data: auditRow } = await ctx.supabase
    .from('activity_log')
    .select('details')
    .eq('organization_id', ctx.orgId)
    .eq('action', 'candidate_deleted')
    .eq('entity_id', candidateId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const impact = extractRestoreImpact(auditRow?.details ?? null)
  const now = new Date().toISOString()

  const { error: candidateError } = await ctx.supabase
    .from('candidates')
    .update({
      deleted_at: null,
      restored_at: now,
      restored_by: ctx.userId,
    })
    .eq('id', candidateId)
    .eq('organization_id', ctx.orgId)

  if (candidateError) {
    console.error('[restore] candidate update failed:', candidateError.message)
    return { success: false, error: 'Failed to restore candidate' }
  }

  let restoredApplications = 0
  if (impact.cascadedApplicationIds.length > 0) {
    const { data: restored, error: appError } = await ctx.supabase
      .from('applications')
      .update({ deleted_at: null })
      .in('id', impact.cascadedApplicationIds)
      .eq('organization_id', ctx.orgId)
      .not('deleted_at', 'is', null)
      .select('id')

    if (appError) {
      console.error('[restore] applications update failed:', appError.message)
      // Non-fatal — the candidate is back, applications can be re-added by hand.
    } else {
      restoredApplications = restored?.length ?? 0
    }
  }

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'candidate',
    entityId: candidateId,
    action: 'candidate_restored',
    message:
      restoredApplications === 0
        ? 'candidate restored'
        : `candidate restored with ${restoredApplications} application(s)`,
    details: { restored_applications: restoredApplications },
  })

  revalidatePath('/settings/trash')
  revalidatePath('/candidates')
  return { success: true, data: { restoredApplications } }
}

export async function restoreVacancy(
  vacancyId: string,
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can restore vacancies.' }
  }

  const now = new Date().toISOString()
  const { error } = await ctx.supabase
    .from('vacancies')
    .update({
      deleted_at: null,
      restored_at: now,
      restored_by: ctx.userId,
    })
    .eq('id', vacancyId)
    .eq('organization_id', ctx.orgId)

  if (error) {
    console.error('[restore] vacancy update failed:', error.message)
    return { success: false, error: 'Failed to restore vacancy' }
  }

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'vacancy',
    entityId: vacancyId,
    action: 'vacancy_restored',
    message: 'vacancy restored',
    details: {},
  })

  revalidatePath('/settings/trash')
  revalidatePath('/vacancies')
  return { success: true, data: undefined }
}

/** Hard-delete a soft-deleted candidate immediately (skip the 30-day window).
 * Cascade FK constraints will remove the candidate's applications, documents,
 * notes, etc. — same as what the daily purge cron does for 30-day-old rows. */
export async function hardDeleteCandidate(
  candidateId: string,
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can permanently delete.' }
  }

  // Safety: only allow hard-delete on already soft-deleted rows.
  const { data: existing } = await ctx.supabase
    .from('candidates')
    .select('id, deleted_at')
    .eq('id', candidateId)
    .eq('organization_id', ctx.orgId)
    .single()
  if (!existing) return { success: false, error: 'Candidate not found' }
  if (!existing.deleted_at) {
    return { success: false, error: 'Soft-delete the candidate first.' }
  }

  const { error } = await ctx.supabase
    .from('candidates')
    .delete()
    .eq('id', candidateId)
    .eq('organization_id', ctx.orgId)

  if (error) {
    console.error('[restore] hard-delete candidate failed:', error.message)
    return { success: false, error: 'Failed to permanently delete' }
  }

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'candidate',
    entityId: candidateId,
    action: 'candidate_hard_deleted',
    message: 'candidate permanently deleted from trash',
    details: { source: 'trash_ui' },
  })

  revalidatePath('/settings/trash')
  return { success: true, data: undefined }
}

export async function hardDeleteVacancy(
  vacancyId: string,
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can permanently delete.' }
  }

  const { data: existing } = await ctx.supabase
    .from('vacancies')
    .select('id, deleted_at')
    .eq('id', vacancyId)
    .eq('organization_id', ctx.orgId)
    .single()
  if (!existing) return { success: false, error: 'Vacancy not found' }
  if (!existing.deleted_at) {
    return { success: false, error: 'Soft-delete the vacancy first.' }
  }

  // Vacancies have a RESTRICT FK on candidate_evaluations — if the vacancy
  // has any evaluations, the hard-delete will fail. Surface that to the
  // recruiter in a useful way rather than as a Postgres error code.
  const { count } = await ctx.supabase
    .from('candidate_evaluations')
    .select('id', { count: 'exact', head: true })
    .eq('vacancy_id', vacancyId)
    .eq('organization_id', ctx.orgId)
  if ((count ?? 0) > 0) {
    return {
      success: false,
      error:
        'This vacancy still has evaluation history attached. Wait for the 30-day purge to clear them, or remove the linked candidates first.',
    }
  }

  const { error } = await ctx.supabase
    .from('vacancies')
    .delete()
    .eq('id', vacancyId)
    .eq('organization_id', ctx.orgId)

  if (error) {
    console.error('[restore] hard-delete vacancy failed:', error.message)
    return { success: false, error: 'Failed to permanently delete' }
  }

  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'vacancy',
    entityId: vacancyId,
    action: 'vacancy_hard_deleted',
    message: 'vacancy permanently deleted from trash',
    details: { source: 'trash_ui' },
  })

  revalidatePath('/settings/trash')
  return { success: true, data: undefined }
}
