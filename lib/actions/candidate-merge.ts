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
