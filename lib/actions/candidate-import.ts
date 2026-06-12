'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import { isOrgAdmin } from '@/lib/permissions'
import { writeAuditLog } from '@/lib/audit-log'
import { ImportRowSchema, type ImportRow } from '@/lib/candidate-import/validation'
import { MAX_ROWS } from '@/lib/candidate-import/parsing'

export interface ImportResult {
  imported: number
  skipped_duplicate: number
  errored: number
  duplicate_emails: string[]
}

export interface ImportPayload {
  filename: string
  rows: ImportRow[]
}

export async function importCandidates(
  payload: ImportPayload
): Promise<ActionResult<ImportResult>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can import candidates', code: 'FORBIDDEN' }
  }

  if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
    return { success: false, error: 'No rows to import', code: 'VALIDATION' }
  }
  if (payload.rows.length > MAX_ROWS) {
    return { success: false, error: `Cannot import more than ${MAX_ROWS} rows at once`, code: 'VALIDATION' }
  }

  // Re-validate rows server-side. The client may have been tampered with.
  const validated: ImportRow[] = []
  for (const row of payload.rows) {
    const parsed = ImportRowSchema.safeParse(row)
    if (!parsed.success) {
      return {
        success: false,
        error: 'One or more rows failed server validation. Refresh and try again.',
        code: 'VALIDATION',
      }
    }
    validated.push(parsed.data)
  }

  // Plan-cap: refuse the whole batch if it would push the org over its candidate limit.
  const { data: sub } = await ctx.supabase
    .from('subscriptions')
    .select('candidate_limit')
    .eq('organization_id', ctx.orgId)
    .single()

  if (sub?.candidate_limit) {
    const { count } = await ctx.supabase
      .from('candidates')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId)
      .is('deleted_at', null)
    const projected = (count ?? 0) + validated.length
    if (projected > sub.candidate_limit) {
      return {
        success: false,
        error: `Importing ${validated.length} rows would exceed your plan limit of ${sub.candidate_limit} candidates (currently ${count ?? 0}).`,
        code: 'PLAN_LIMIT',
      }
    }
  }

  // Dedupe by email against existing active candidates in the org.
  const emails = Array.from(new Set(validated.map((r) => r.email)))
  const { data: existing } = await ctx.supabase
    .from('candidates')
    .select('email')
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .in('email', emails)

  const taken = new Set((existing ?? []).map((c) => (c.email ?? '').toLowerCase()))

  // Also dedupe within the batch itself — first occurrence wins.
  const seenInBatch = new Set<string>()
  const toInsert: ImportRow[] = []
  const duplicateEmails: string[] = []

  for (const row of validated) {
    const e = row.email.toLowerCase()
    if (taken.has(e) || seenInBatch.has(e)) {
      duplicateEmails.push(e)
      continue
    }
    seenInBatch.add(e)
    toInsert.push(row)
  }

  let inserted = 0
  if (toInsert.length > 0) {
    const insertPayload = toInsert.map((r) => ({
      organization_id: ctx.orgId,
      created_by: ctx.userId,
      first_name: r.first_name,
      last_name: r.last_name,
      email: r.email,
      phone: r.phone,
      current_company: r.current_company,
      current_position: r.current_position,
      years_of_experience: r.years_of_experience,
      linkedin_profile_url: r.linkedin_url,
      location: r.location,
      source: r.source,
      languages: r.languages,
      salary_expectation: r.salary_expectation,
      notice_period: r.notice_period,
    }))

    const { data, error } = await ctx.supabase
      .from('candidates')
      .insert(insertPayload)
      .select('id')

    if (error) {
      return { success: false, error: 'Failed to import candidates', code: 'DB_ERROR' }
    }
    inserted = data?.length ?? 0
  }

  const result: ImportResult = {
    imported: inserted,
    skipped_duplicate: duplicateEmails.length,
    errored: 0,
    duplicate_emails: duplicateEmails,
  }

  await writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'candidate',
    entityId: null,
    action: 'candidates_imported',
    message: `Imported ${inserted} candidate${inserted === 1 ? '' : 's'} from CSV`,
    details: {
      filename: payload.filename,
      rows_attempted: validated.length,
      rows_imported: inserted,
      rows_skipped_duplicate: duplicateEmails.length,
    },
  })

  revalidatePath('/candidates')
  return { success: true, data: result }
}
