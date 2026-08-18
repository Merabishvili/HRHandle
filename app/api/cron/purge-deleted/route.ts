import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeEqual } from 'crypto'

export const dynamic = 'force-dynamic'

// Retention threshold matches the public privacy policy (§7): soft-deleted
// candidate data is permanently removed 30 days after the deleted_at timestamp.
const PURGE_THRESHOLD_DAYS = 30

if (!process.env.CRON_SECRET) {
  console.warn(
    '[cron/purge-deleted] CRON_SECRET is not set — every request will 401. Set it on Vercel + .env.local to enable the cron.',
  )
}

function isAuthorized(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || !authHeader) return false
  const expected = `Bearer ${secret}`
  try {
    return (
      authHeader.length === expected.length &&
      timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
    )
  } catch {
    return false
  }
}

interface PurgeCounts {
  organizations_purged: number
  auth_users_deleted: number
  auth_users_delete_errors: number
  candidates_purged: number
  orphan_applications: number
  orphan_documents: number
  orphan_notes: number
  custom_fields: number
  vacancies_purged: number
  vacancies_skipped_due_to_restrict: number
  storage_files_deleted: number
  storage_errors: number
  offers_expired: number
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - PURGE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const counts: PurgeCounts = {
    organizations_purged: 0,
    auth_users_deleted: 0,
    auth_users_delete_errors: 0,
    candidates_purged: 0,
    orphan_applications: 0,
    orphan_documents: 0,
    orphan_notes: 0,
    custom_fields: 0,
    vacancies_purged: 0,
    vacancies_skipped_due_to_restrict: 0,
    storage_files_deleted: 0,
    storage_errors: 0,
    offers_expired: 0,
  }

  // Collected across multiple steps below; deleted from the candidate-documents
  // storage bucket in step 3 (best-effort).
  const filePaths = new Set<string>()

  // ── 0. Organizations past threshold (G-007) ─────────────────────────────────
  // Done BEFORE the per-table purges so the cascade does the heavy lifting on
  // child rows in one shot. The org cascade-deletes every public.* row in the
  // tenant (profiles, candidates, applications, vacancies, custom_fields,
  // candidate_documents, candidate_notes, etc.) via existing FK CASCADE rules,
  // so the later per-table sweeps only have to mop up orphans from in-app
  // soft-deletes (where the org itself is still active).
  //
  // auth.users cleanup: profiles.id = auth.users.id (FK). Cascade-deleting a
  // profile removes the row from public.profiles but NOT from auth.users. We
  // must call supabase.auth.admin.deleteUser() per former member after the
  // cascade so the user is fully wiped (otherwise they could sign back in).
  const { data: orgsToPurge, error: orgsToPurgeError } = await supabase
    .from('organizations')
    .select('id')
    .lt('deleted_at', cutoff)

  if (orgsToPurgeError) {
    console.error(
      '[cron/purge-deleted] select organizations-to-purge failed:',
      orgsToPurgeError.message,
    )
  }

  const orgIdsToPurge = (orgsToPurge ?? []).map((o) => o.id as string)
  const authUserIdsToDelete: string[] = []

  if (orgIdsToPurge.length > 0) {
    // Collect file paths from documents that will cascade-delete with the orgs.
    const { data: orgDocs, error: orgDocsError } = await supabase
      .from('candidate_documents')
      .select('file_path')
      .in('organization_id', orgIdsToPurge)
    if (orgDocsError) {
      console.error('[cron/purge-deleted] select org docs failed:', orgDocsError.message)
    } else {
      for (const d of orgDocs ?? []) {
        if (d.file_path) filePaths.add(d.file_path)
      }
    }

    // Collect auth user IDs from member profiles BEFORE the cascade-delete.
    const { data: memberProfiles, error: memberProfilesError } = await supabase
      .from('profiles')
      .select('id')
      .in('organization_id', orgIdsToPurge)
    if (memberProfilesError) {
      console.error(
        '[cron/purge-deleted] select member profiles failed:',
        memberProfilesError.message,
      )
    } else {
      for (const p of memberProfiles ?? []) {
        if (p.id) authUserIdsToDelete.push(p.id as string)
      }
    }

    // Hard-delete each org. Doing it row-by-row in case one fails (unlikely
    // since cascades are well-defined here, but defensive).
    for (const orgId of orgIdsToPurge) {
      const { error } = await supabase.from('organizations').delete().eq('id', orgId)
      if (error) {
        console.error(`[cron/purge-deleted] delete organization ${orgId} failed:`, error.message)
      } else {
        counts.organizations_purged++
      }
    }

    // Delete the corresponding auth.users rows. Best-effort per user.
    for (const uid of authUserIdsToDelete) {
      try {
        const { error } = await supabase.auth.admin.deleteUser(uid)
        if (error) {
          console.error(`[cron/purge-deleted] auth.admin.deleteUser(${uid}) failed:`, error.message)
          counts.auth_users_delete_errors++
        } else {
          counts.auth_users_deleted++
        }
      } catch (err) {
        console.error(
          `[cron/purge-deleted] auth.admin.deleteUser(${uid}) threw:`,
          err instanceof Error ? err.message : err,
        )
        counts.auth_users_delete_errors++
      }
    }
  }


  // ── 1. Collect storage paths BEFORE deleting rows ──────────────────────────
  // Two sources of paths to clean up: (a) candidate_documents that were
  // individually soft-deleted past the threshold, (b) documents whose parent
  // candidate was soft-deleted past the threshold (these will cascade-delete
  // when we purge the candidate row, but the file in storage doesn't go with
  // them — DB CASCADE doesn't reach into the Supabase Storage bucket).

  const { data: directDocs, error: directDocsError } = await supabase
    .from('candidate_documents')
    .select('file_path')
    .lt('deleted_at', cutoff)

  if (directDocsError) {
    console.error('[cron/purge-deleted] select direct docs failed:', directDocsError.message)
  } else {
    for (const d of directDocs ?? []) {
      if (d.file_path) filePaths.add(d.file_path)
    }
  }

  // For docs whose parent candidate is past threshold: pull candidate IDs first,
  // then docs for those candidates. (Postgrest doesn't support a join filter
  // on a sibling table in a single .select.)
  const { data: candidatesToPurge, error: candidatesToPurgeError } = await supabase
    .from('candidates')
    .select('id')
    .lt('deleted_at', cutoff)

  if (candidatesToPurgeError) {
    console.error(
      '[cron/purge-deleted] select candidates-to-purge failed:',
      candidatesToPurgeError.message,
    )
  }

  const candidateIds = (candidatesToPurge ?? []).map((c) => c.id as string)

  if (candidateIds.length > 0) {
    const { data: cascadeDocs, error: cascadeDocsError } = await supabase
      .from('candidate_documents')
      .select('file_path')
      .in('candidate_id', candidateIds)

    if (cascadeDocsError) {
      console.error('[cron/purge-deleted] select cascade docs failed:', cascadeDocsError.message)
    } else {
      for (const d of cascadeDocs ?? []) {
        if (d.file_path) filePaths.add(d.file_path)
      }
    }
  }

  // ── 2. Hard-delete rows (cascade order: candidates first, then orphans) ────
  // candidates → CASCADE applications, candidate_documents, candidate_notes,
  // interviews, candidate_evaluations, candidate_experience, candidate_education.
  {
    const { data, error } = await supabase
      .from('candidates')
      .delete()
      .lt('deleted_at', cutoff)
      .select('id')
    if (error) {
      console.error('[cron/purge-deleted] delete candidates failed:', error.message)
    } else {
      counts.candidates_purged = data?.length ?? 0
    }
  }

  // Orphan applications (parent candidate still active, but the application
  // itself was soft-deleted).
  {
    const { data, error } = await supabase
      .from('applications')
      .delete()
      .lt('deleted_at', cutoff)
      .select('id')
    if (error) {
      console.error('[cron/purge-deleted] delete orphan applications failed:', error.message)
    } else {
      counts.orphan_applications = data?.length ?? 0
    }
  }

  // Orphan candidate_documents.
  {
    const { data, error } = await supabase
      .from('candidate_documents')
      .delete()
      .lt('deleted_at', cutoff)
      .select('id')
    if (error) {
      console.error('[cron/purge-deleted] delete orphan documents failed:', error.message)
    } else {
      counts.orphan_documents = data?.length ?? 0
    }
  }

  // Orphan candidate_notes.
  {
    const { data, error } = await supabase
      .from('candidate_notes')
      .delete()
      .lt('deleted_at', cutoff)
      .select('id')
    if (error) {
      console.error('[cron/purge-deleted] delete orphan notes failed:', error.message)
    } else {
      counts.orphan_notes = data?.length ?? 0
    }
  }

  // custom_fields — org-config, not strictly PII, but cleared for consistency.
  {
    const { data, error } = await supabase
      .from('custom_fields')
      .delete()
      .lt('deleted_at', cutoff)
      .select('id')
    if (error) {
      console.error('[cron/purge-deleted] delete custom_fields failed:', error.message)
    } else {
      counts.custom_fields = data?.length ?? 0
    }
  }

  // Vacancies — candidate_evaluations.vacancy_id is RESTRICT, so a vacancy
  // delete can fail if any evaluation still references it. Do it row-by-row
  // and skip failures so one stubborn vacancy doesn't kill the whole run.
  const { data: vacanciesToPurge, error: vacanciesToPurgeError } = await supabase
    .from('vacancies')
    .select('id')
    .lt('deleted_at', cutoff)

  if (vacanciesToPurgeError) {
    console.error(
      '[cron/purge-deleted] select vacancies-to-purge failed:',
      vacanciesToPurgeError.message,
    )
  } else {
    for (const v of vacanciesToPurge ?? []) {
      const { error } = await supabase.from('vacancies').delete().eq('id', v.id)
      if (error) {
        // Most likely the RESTRICT FK from candidate_evaluations.vacancy_id.
        // Log and skip — those evaluations will clear when their parent
        // candidates are purged on a future run.
        console.warn(
          `[cron/purge-deleted] skipped vacancy ${v.id}:`,
          error.message,
        )
        counts.vacancies_skipped_due_to_restrict++
      } else {
        counts.vacancies_purged++
      }
    }
  }

  // ── 3. Delete files from storage (best-effort) ─────────────────────────────
  if (filePaths.size > 0) {
    const paths = Array.from(filePaths)
    const { data, error } = await supabase.storage
      .from('candidate-documents')
      .remove(paths)
    if (error) {
      console.error('[cron/purge-deleted] storage remove failed:', error.message)
      counts.storage_errors = paths.length
    } else {
      counts.storage_files_deleted = data?.length ?? paths.length
    }
  }

  // ── Step N: auto-expire sent offers past their expiry_date (G-018). ─────
  // The candidate-facing page also runs a view-time check; this just keeps
  // the persistent `status` field truthful for the recruiter UI + reporting.
  try {
    const todayYmd = new Date().toISOString().slice(0, 10)
    const { data: expired, error: expireErr } = await supabase
      .from('offers')
      .update({ status: 'expired', responded_at: new Date().toISOString() })
      .eq('status', 'sent')
      .lt('expiry_date', todayYmd)
      .is('deleted_at', null)
      .select('id')

    if (expireErr) {
      console.error('[cron/purge-deleted] offers expire failed:', expireErr.message)
    } else {
      counts.offers_expired = expired?.length ?? 0
    }
  } catch (err) {
    console.error('[cron/purge-deleted] offers expire threw:', err)
  }

  console.log('[cron/purge-deleted] done:', counts)

  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    ...counts,
  })
}
