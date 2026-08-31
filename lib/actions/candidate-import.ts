'use server'

import { after } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { getAuthContext, type ActionResult } from './index'
import { isOrgAdmin } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit-log'
import { MAX_ROWS } from '@/lib/candidate-import/parsing'
import {
  validateDataset,
  toCandidateInsert,
  type DraftRow,
  type ValidatedRow,
} from '@/lib/candidate-import/validation'

const COMMIT_BATCH = 100

export interface ImportDraftData {
  filename: string
  columns: number
  size: number
  rows: ValidatedRow[]
  counts: { total: number; ready: number; error: number }
  existingEmails: string[]
}

export interface ImportProgress {
  status: 'running' | 'completed' | 'cancelled' | 'failed'
  total: number
  imported: number
  failed: number
  deleted_count: number
  filename: string
  started_at: string
  finished_at: string | null
  error_reason: string | null
}

/** Fetch the org's active-candidate emails (lowercased) for duplicate checks. */
async function fetchExistingEmails(
  client: ReturnType<typeof createAdminClient>,
  orgId: string,
): Promise<Set<string>> {
  const { data } = await client
    .from('candidates')
    .select('email')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .not('email', 'is', null)
    .limit(20000)
  return new Set(
    (data ?? []).map((r) => (r.email ?? '').toLowerCase()).filter((e) => e.length > 0),
  )
}

/**
 * Re-load a draft (uploader-only via RLS) and re-validate it against a fresh
 * duplicate snapshot. Used to recover the review table after a page refresh.
 */
export async function getImportDraft(importId: string): Promise<ActionResult<ImportDraftData>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }

  const { data: draft } = await ctx.supabase
    .from('candidate_import_drafts')
    .select('filename, rows, size_bytes, column_count')
    .eq('id', importId)
    .single()
  if (!draft) return { success: false, error: 'Draft not found or expired', code: 'NOT_FOUND' }

  const draftRows = (draft.rows ?? []) as DraftRow[]
  const admin = createAdminClient()
  const existingEmails = await fetchExistingEmails(admin, ctx.orgId)
  const validated = validateDataset(draftRows, existingEmails)

  let ready = 0
  let error = 0
  for (const r of validated) r.status === 'ready' ? ready++ : error++

  return {
    success: true,
    data: {
      filename: draft.filename,
      columns: draft.column_count ?? 0,
      size: draft.size_bytes ?? 0,
      rows: validated,
      counts: { total: validated.length, ready, error },
      existingEmails: Array.from(existingEmails),
    },
  }
}

/** Persist inline edits + deletions to the draft (debounced autosave). */
export async function saveImportDraft(
  importId: string,
  rows: DraftRow[],
): Promise<ActionResult> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }
  if (!Array.isArray(rows) || rows.length > MAX_ROWS) {
    return { success: false, error: 'Invalid draft', code: 'VALIDATION' }
  }

  const { error } = await ctx.supabase
    .from('candidate_import_drafts')
    .update({ rows, updated_at: new Date().toISOString() })
    .eq('id', importId)
  if (error) return { success: false, error: 'Failed to save', code: 'DB_ERROR' }
  return { success: true, data: undefined }
}

/**
 * Kick off the commit as a background job. Returns immediately with a jobId;
 * the client polls `getImportProgress`. Only rows that are error-free at
 * commit time are attempted; a duplicate that appeared since parse (race) is
 * dropped and counted as `failed`.
 */
export async function startImport(importId: string): Promise<ActionResult<{ jobId: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can import', code: 'FORBIDDEN' }
  }

  const { data: draft } = await ctx.supabase
    .from('candidate_import_drafts')
    .select('filename, rows, initial_row_count')
    .eq('id', importId)
    .single()
  if (!draft) return { success: false, error: 'Draft not found or expired', code: 'NOT_FOUND' }

  const draftRows = (draft.rows ?? []) as DraftRow[]
  const admin = createAdminClient()
  const existingEmails = await fetchExistingEmails(admin, ctx.orgId)
  const validated = validateDataset(draftRows, existingEmails)
  const readyRows = validated.filter((r) => r.status === 'ready')
  if (readyRows.length === 0) {
    return { success: false, error: 'No importable rows', code: 'VALIDATION' }
  }

  // Hard plan cap — importing must not push the org past candidate_limit.
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
    if ((count ?? 0) + readyRows.length > sub.candidate_limit) {
      const t = await getTranslations('planLimit')
      return { success: false, error: t('candidates', { limit: sub.candidate_limit }), code: 'PLAN_LIMIT' }
    }
  }

  const deletedCount = Math.max(0, (draft.initial_row_count ?? readyRows.length) - draftRows.length)

  const { data: job, error: jobError } = await admin
    .from('candidate_imports')
    .insert({
      organization_id: ctx.orgId,
      created_by: ctx.userId,
      filename: draft.filename,
      status: 'running',
      total: readyRows.length,
      deleted_count: deletedCount,
    })
    .select('id')
    .single()
  if (jobError || !job) {
    return { success: false, error: 'Failed to start import', code: 'DB_ERROR' }
  }

  const jobId = job.id as string
  const base = { organization_id: ctx.orgId, created_by: ctx.userId }

  // Run the inserts after the response is sent. Progress is written to the
  // candidate_imports row as batches land; the client polls it.
  after(async () => {
    await runImportJob({ jobId, importId, rows: readyRows, base, existingEmails })
  })

  return { success: true, data: { jobId } }
}

/** Background worker: inserts ready rows in batches, updating live progress. */
async function runImportJob(args: {
  jobId: string
  importId: string
  rows: ValidatedRow[]
  base: { organization_id: string; created_by: string }
  existingEmails: Set<string>
}): Promise<void> {
  const { jobId, importId, rows, base, existingEmails } = args
  const admin = createAdminClient()
  const seen = new Set(existingEmails)
  let imported = 0
  let failed = 0

  try {
    for (let i = 0; i < rows.length; i += COMMIT_BATCH) {
      // Honor a cancel request between batches; already-created rows remain.
      const { data: jobRow } = await admin
        .from('candidate_imports')
        .select('cancel_requested')
        .eq('id', jobId)
        .single()
      if (jobRow?.cancel_requested) {
        await admin
          .from('candidate_imports')
          .update({ status: 'cancelled', imported, failed, finished_at: new Date().toISOString() })
          .eq('id', jobId)
        await admin.from('candidate_import_drafts').delete().eq('id', importId)
        return
      }

      const batch = rows.slice(i, i + COMMIT_BATCH)
      const payload: Record<string, unknown>[] = []
      for (const r of batch) {
        const email = (r.values.email ?? '').trim().toLowerCase()
        if (email && seen.has(email)) {
          failed++ // duplicate appeared since parse (race) — skip it
          continue
        }
        if (email) seen.add(email)
        payload.push(toCandidateInsert(r.values, { ...base, import_id: jobId }))
      }

      if (payload.length > 0) {
        const { data, error } = await admin.from('candidates').insert(payload).select('id')
        if (error) {
          failed += payload.length
        } else {
          imported += data?.length ?? 0
        }
      }

      await admin
        .from('candidate_imports')
        .update({ imported, failed })
        .eq('id', jobId)
    }

    await admin
      .from('candidate_imports')
      .update({ status: 'completed', imported, failed, finished_at: new Date().toISOString() })
      .eq('id', jobId)
    await admin.from('candidate_import_drafts').delete().eq('id', importId)

    await writeAuditLog({
      orgId: base.organization_id,
      userId: base.created_by,
      entityType: 'candidate',
      entityId: null,
      action: 'candidates_imported',
      message: `Imported ${imported} candidate${imported === 1 ? '' : 's'} from CSV`,
      details: { import_id: jobId, imported, failed },
    })
  } catch (err) {
    await admin
      .from('candidate_imports')
      .update({
        status: 'failed',
        imported,
        failed,
        error_reason: err instanceof Error ? err.message : 'unknown',
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId)
  }
}

/** Poll the live status of an import job (same-org read via RLS). */
export async function getImportProgress(jobId: string): Promise<ActionResult<ImportProgress>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }

  const { data } = await ctx.supabase
    .from('candidate_imports')
    .select('status, total, imported, failed, deleted_count, filename, started_at, finished_at, error_reason')
    .eq('id', jobId)
    .single()
  if (!data) return { success: false, error: 'Import not found', code: 'NOT_FOUND' }

  return { success: true, data: data as ImportProgress }
}

/** Request cancellation; the job stops after its current batch. */
export async function cancelImport(jobId: string): Promise<ActionResult> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Forbidden', code: 'FORBIDDEN' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('candidate_imports')
    .update({ cancel_requested: true })
    .eq('id', jobId)
    .eq('organization_id', ctx.orgId)
  if (error) return { success: false, error: 'Failed to cancel', code: 'DB_ERROR' }
  return { success: true, data: undefined }
}
