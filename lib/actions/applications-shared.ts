/**
 * Shared helpers/types for the split application actions (A-201). Pure module
 * (no `'use server'`) so the concern files under `lib/actions/applications/`
 * can import it without it becoming a server-action surface.
 */

/** Normalises an embedded relation (PostgREST returns a single joined row as
 * either an object or a one-element array depending on join inference). */
export function unwrapRelation<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null
  return Array.isArray(rel) ? rel[0] ?? null : rel
}

/** Shape of the embedded pipeline_stages row used for bucket-mapping. */
export type StageRelation = {
  type: 'standard' | 'review' | 'interview' | 'offer'
  name: string
  is_terminal: boolean
}
