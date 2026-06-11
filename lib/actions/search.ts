'use server'

import { getAuthContext, type ActionResult } from './index'
import {
  toIlikePattern,
  MAX_RESULTS_PER_GROUP,
  normalizeQuery,
} from '@/lib/search/query'

export interface CandidateHit {
  id: string
  first_name: string
  last_name: string
  email: string | null
  current_company: string | null
  current_position: string | null
}

export interface VacancyHit {
  id: string
  title: string
  department: string | null
  location: string | null
}

export interface NoteHit {
  id: string
  candidate_id: string
  candidate_first_name: string
  candidate_last_name: string
  /** First 120 chars of `note_text`; never the full content (palette is a
   * navigation aid, not a note reader). */
  preview: string
  created_at: string
}

export interface GlobalSearchResults {
  query: string
  candidates: CandidateHit[]
  vacancies: VacancyHit[]
  notes: NoteHit[]
}

const NOTE_PREVIEW_LENGTH = 120

/**
 * Org-scoped search across candidates / vacancies / notes (G-023).
 *
 * Uses `ilike` against multiple columns rather than `tsvector` full-text —
 * see lib/search/query.ts for the rationale. When an org passes ~5K rows of
 * any single type and the latency becomes noticeable, switch the matching
 * columns to a generated `tsvector` + GIN index; the result shape doesn't
 * change.
 */
export async function globalSearch(
  rawQuery: string,
): Promise<ActionResult<GlobalSearchResults>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const query = normalizeQuery(rawQuery)
  const pattern = toIlikePattern(rawQuery)
  if (!pattern) {
    return {
      success: true,
      data: { query: '', candidates: [], vacancies: [], notes: [] },
    }
  }

  // Three queries in parallel — keeps the action's wall-clock at roughly the
  // slowest single query. PostgREST's `.or()` is the right shape for
  // ilike-across-columns; the `name.ilike.foo,email.ilike.foo` syntax.
  const [{ data: candidates, error: cErr }, { data: vacancies, error: vErr }, { data: notes, error: nErr }] =
    await Promise.all([
      ctx.supabase
        .from('candidates')
        .select(
          'id, first_name, last_name, email, current_company, current_position',
        )
        .eq('organization_id', ctx.orgId)
        .is('deleted_at', null)
        .or(
          [
            `first_name.ilike.${pattern}`,
            `last_name.ilike.${pattern}`,
            `email.ilike.${pattern}`,
            `current_company.ilike.${pattern}`,
            `current_position.ilike.${pattern}`,
          ].join(','),
        )
        .order('updated_at', { ascending: false })
        .limit(MAX_RESULTS_PER_GROUP),

      ctx.supabase
        .from('vacancies')
        .select('id, title, department, location')
        .eq('organization_id', ctx.orgId)
        .is('deleted_at', null)
        .or(
          [
            `title.ilike.${pattern}`,
            `department.ilike.${pattern}`,
            `location.ilike.${pattern}`,
          ].join(','),
        )
        .order('updated_at', { ascending: false })
        .limit(MAX_RESULTS_PER_GROUP),

      ctx.supabase
        .from('candidate_notes')
        .select(
          `id, candidate_id, note_text, created_at,
           candidates ( first_name, last_name, deleted_at )`,
        )
        .eq('organization_id', ctx.orgId)
        .is('deleted_at', null)
        .ilike('note_text', pattern)
        .order('created_at', { ascending: false })
        .limit(MAX_RESULTS_PER_GROUP * 2), // overfetch to allow for the candidate-deleted filter below
    ])

  if (cErr || vErr || nErr) {
    console.error(
      '[search] one of the parallel queries failed:',
      cErr?.message ?? vErr?.message ?? nErr?.message,
    )
    return { success: false, error: 'Search failed. Try again.' }
  }

  type RawNote = {
    id: string
    candidate_id: string
    note_text: string
    created_at: string
    candidates:
      | { first_name: string; last_name: string; deleted_at: string | null }
      | { first_name: string; last_name: string; deleted_at: string | null }[]
      | null
  }

  // Drop notes whose candidate is soft-deleted — the candidate page would
  // 404 from the click anyway, and surfacing the row is confusing.
  const noteHits: NoteHit[] = []
  for (const raw of (notes ?? []) as RawNote[]) {
    const candidateRaw = raw.candidates
    const candidate = Array.isArray(candidateRaw) ? candidateRaw[0] : candidateRaw
    if (!candidate || candidate.deleted_at) continue
    const preview =
      raw.note_text.length > NOTE_PREVIEW_LENGTH
        ? `${raw.note_text.slice(0, NOTE_PREVIEW_LENGTH - 1)}…`
        : raw.note_text
    noteHits.push({
      id: raw.id,
      candidate_id: raw.candidate_id,
      candidate_first_name: candidate.first_name,
      candidate_last_name: candidate.last_name,
      preview,
      created_at: raw.created_at,
    })
    if (noteHits.length >= MAX_RESULTS_PER_GROUP) break
  }

  return {
    success: true,
    data: {
      query,
      candidates: (candidates ?? []) as CandidateHit[],
      vacancies: (vacancies ?? []) as VacancyHit[],
      notes: noteHits,
    },
  }
}
