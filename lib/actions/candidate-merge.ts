'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'

/**
 * A-3 Merge candidates — server actions.
 *
 * The actual data work happens inside the `merge_candidates()` SQL
 * function created by Migration 053, so the multi-table write is
 * atomic. These actions only validate input and invoke the RPC.
 */

export interface MergeCandidateSummary {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  current_company: string | null
  applications_count: number
  created_at: string
}

/**
 * Returns candidate suggestions for the merge picker. Same-org only,
 * excludes self, soft-deleted, and already-merged rows. If the current
 * candidate has an email we surface email-equal matches first so the
 * obvious duplicate floats to the top.
 */
export async function searchMergeCandidates(
  currentCandidateId: string,
  query: string,
): Promise<ActionResult<MergeCandidateSummary[]>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const trimmed = query.trim()
  // Read the current candidate's email so we can boost identical-email
  // matches in the result set.
  const { data: current } = await ctx.supabase
    .from('candidates')
    .select('email')
    .eq('id', currentCandidateId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  let qb = ctx.supabase
    .from('candidates')
    .select('id, first_name, last_name, email, phone, current_company, created_at, applications:applications(count)')
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .is('merged_into_id', null)
    .neq('id', currentCandidateId)
    .limit(10)
    .order('created_at', { ascending: false })

  if (trimmed.length > 0) {
    // ilike across name + email; the OR string is a single PostgREST clause
    const safe = trimmed.replace(/[%_,()]/g, '')
    qb = qb.or(
      `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%`,
    )
  } else if (current?.email) {
    qb = qb.ilike('email', current.email)
  }

  const { data, error } = await qb
  if (error) {
    return { success: false, error: 'Could not search candidates' }
  }

  type Row = {
    id: string
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
    current_company: string | null
    created_at: string
    applications: { count: number }[]
  }

  const results: MergeCandidateSummary[] = (data as Row[] | null ?? []).map((r) => ({
    id: r.id,
    full_name: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || '—',
    email: r.email,
    phone: r.phone,
    current_company: r.current_company,
    applications_count: r.applications?.[0]?.count ?? 0,
    created_at: r.created_at,
  }))

  return { success: true, data: results }
}

/**
 * Fetches the loser candidate's full set of merge-relevant fields when
 * the dialog enters step 2. Returns null when the candidate is not in
 * the caller's org (or merged / deleted).
 */
export async function getCandidateMergeDetails(
  candidateId: string,
): Promise<ActionResult<Record<string, string | null> | null>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data, error } = await ctx.supabase
    .from('candidates')
    .select('current_company, current_position, linkedin_profile_url, source, location')
    .eq('id', candidateId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .is('merged_into_id', null)
    .maybeSingle()

  if (error) return { success: false, error: 'Could not load candidate details' }
  if (!data) return { success: true, data: null }
  return { success: true, data: data as Record<string, string | null> }
}

/**
 * Field choices the user picks in step 2 of the merge dialog. Each key
 * present in the object overwrites the winner's column with the supplied
 * value. Keys absent leave the winner's existing value alone.
 */
export interface MergeFieldChoices {
  first_name?: string
  last_name?: string
  email?: string | null
  phone?: string | null
  current_company?: string | null
  current_position?: string | null
  linkedin_profile_url?: string | null
  source?: string | null
  location?: string | null
}

/**
 * Invokes the SQL function. Returns the winner's id so the client can
 * route to it; the loser's id will 302 to the winner via the page-level
 * redirect added in app/(dashboard)/candidates/[id]/page.tsx.
 */
export async function mergeCandidates(input: {
  winnerId: string
  loserId: string
  fieldChoices?: MergeFieldChoices
}): Promise<ActionResult<{ winnerId: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (!input.winnerId || !input.loserId) {
    return { success: false, error: 'Both candidates are required' }
  }
  if (input.winnerId === input.loserId) {
    return { success: false, error: 'Cannot merge a candidate with itself' }
  }

  // Strip undefined keys so the SQL function's `?` operator distinguishes
  // "user chose to keep loser's value" (key present) from "user kept
  // winner's value" (key absent).
  const choices: Record<string, string | null> = {}
  if (input.fieldChoices) {
    for (const [k, v] of Object.entries(input.fieldChoices)) {
      if (v !== undefined) choices[k] = v
    }
  }

  const { error } = await ctx.supabase.rpc('merge_candidates', {
    p_winner_id: input.winnerId,
    p_loser_id: input.loserId,
    p_field_choices: choices,
  })

  if (error) {
    // Surface known SQL exceptions verbatim — they are user-meaningful
    // ("cross-org merge is not allowed", "cannot merge a candidate with
    // itself"). Other errors get a generic message.
    const msg = error.message ?? ''
    const friendly =
      msg.includes('cross-org')
        ? 'Cross-organization merge is blocked'
        : msg.includes('itself')
          ? 'Cannot merge a candidate with itself'
          : msg.includes('not found')
            ? 'One of the candidates is no longer available'
            : 'Could not merge candidates'
    return { success: false, error: friendly }
  }

  revalidatePath(`/candidates/${input.winnerId}`)
  revalidatePath('/candidates')
  return { success: true, data: { winnerId: input.winnerId } }
}

/**
 * Details of the most recent un-reverted merge for which this candidate
 * is the surviving record. Drives the split-back banner on the
 * candidate profile (A-3b). Returns null when there is no eligible
 * merge or it's outside the 30-day window.
 */
export interface RecentMergeInfo {
  mergeId: string
  loserName: string
  mergedAt: string
  mergedByName: string | null
  daysAgo: number
  daysRemaining: number
}

export async function getRecentMerge(
  winnerCandidateId: string,
): Promise<ActionResult<RecentMergeInfo | null>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  type Row = {
    id: string
    merged_at: string
    merged_by: string | null
    loser_snapshot: { first_name?: string; last_name?: string } | null
    profiles: { full_name: string | null } | { full_name: string | null }[] | null
  }

  const { data, error } = await ctx.supabase
    .from('candidate_merges')
    .select('id, merged_at, merged_by, loser_snapshot, profiles:profiles!candidate_merges_merged_by_fkey(full_name)')
    .eq('winner_id', winnerCandidateId)
    .eq('organization_id', ctx.orgId)
    .is('reverted_at', null)
    .order('merged_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { success: false, error: 'Could not load merge history' }
  if (!data) return { success: true, data: null }

  const row = data as Row
  const mergedAtMs = new Date(row.merged_at).getTime()
  const daysAgo = Math.floor((Date.now() - mergedAtMs) / (1000 * 60 * 60 * 24))
  const daysRemaining = 30 - daysAgo
  if (daysRemaining <= 0) return { success: true, data: null }

  const snap = row.loser_snapshot ?? {}
  const loserName =
    [snap.first_name, snap.last_name].filter(Boolean).join(' ').trim() ||
    'a candidate'

  const merger = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
  return {
    success: true,
    data: {
      mergeId: row.id,
      loserName,
      mergedAt: row.merged_at,
      mergedByName: merger?.full_name ?? null,
      daysAgo,
      daysRemaining,
    },
  }
}

/**
 * Returns risk flags for a (winner, loser) pair so the merge dialog can
 * gate Step 3 behind an explicit "I understand" checkbox per design.
 */
export interface MergeRisks {
  winnerHasOffer: boolean
  loserHasOffer: boolean
  /**
   * Both candidates have an offer (any status) on the same vacancy.
   * Surfaces a "duplicate offer" warning so the merger doesn't lose
   * track of an existing offer thread.
   */
  dualOfferVacancyTitles: string[]
}

export async function getMergeRisks(
  winnerId: string,
  loserId: string,
): Promise<ActionResult<MergeRisks>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  type OfferRow = {
    application_id: string
    status: string
    applications:
      | { candidate_id: string; vacancy_id: string; vacancies: { title: string } | { title: string }[] | null }
      | { candidate_id: string; vacancy_id: string; vacancies: { title: string } | { title: string }[] | null }[]
      | null
  }

  const { data, error } = await ctx.supabase
    .from('offers')
    .select(
      'application_id, status, applications:applications!offers_application_id_fkey(candidate_id, vacancy_id, vacancies:vacancies!applications_vacancy_id_fkey(title))',
    )
    .eq('organization_id', ctx.orgId)
    .in('status', ['draft', 'sent', 'accepted'])

  if (error) return { success: false, error: 'Could not load offer risks' }

  const winnerOffers: { vacancy_id: string; title: string }[] = []
  const loserOffers: { vacancy_id: string; title: string }[] = []

  for (const row of (data ?? []) as OfferRow[]) {
    const app = Array.isArray(row.applications) ? row.applications[0] : row.applications
    if (!app) continue
    const vac = Array.isArray(app.vacancies) ? app.vacancies[0] : app.vacancies
    const entry = { vacancy_id: app.vacancy_id, title: vac?.title ?? '' }
    if (app.candidate_id === winnerId) winnerOffers.push(entry)
    else if (app.candidate_id === loserId) loserOffers.push(entry)
  }

  const loserVacancyIds = new Set(loserOffers.map((o) => o.vacancy_id))
  const dualOfferVacancyTitles = winnerOffers
    .filter((o) => loserVacancyIds.has(o.vacancy_id))
    .map((o) => o.title || 'a vacancy')

  return {
    success: true,
    data: {
      winnerHasOffer: winnerOffers.length > 0,
      loserHasOffer: loserOffers.length > 0,
      dualOfferVacancyTitles,
    },
  }
}

/**
 * Reverses a merge within its 30-day window. Backed by Migration 056's
 * split_merge() SQL function; same atomicity guarantee as the merge
 * itself. Restores the loser candidate's row in place; previously
 * merged-in child rows stay on the winner (documented in the dialog).
 */
export async function splitMerge(
  mergeId: string,
): Promise<ActionResult<{ loserId: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data, error } = await ctx.supabase.rpc('split_merge', {
    p_merge_id: mergeId,
  })
  if (error) {
    const msg = error.message ?? ''
    const friendly = msg.includes('already been split')
      ? 'This merge has already been split back'
      : msg.includes('window has expired')
        ? 'The 30-day split window has expired for this merge'
        : msg.includes('not found')
          ? 'Merge record not found'
          : 'Could not split back the merge'
    return { success: false, error: friendly }
  }

  revalidatePath('/candidates')
  return { success: true, data: { loserId: data as string } }
}
