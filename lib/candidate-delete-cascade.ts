// Pure shape used by the audit log when `deleteCandidate` cascades into its
// applications (BL-007). Kept in its own file so we can unit-test the payload
// shape without spinning up Supabase.

export interface CandidateDeleteAuditDetails {
  /** Number of applications that were soft-deleted alongside the candidate. */
  cascaded_applications: number
  /** IDs of the affected applications, in the order returned by the cascade
   * UPDATE ... RETURNING. Used by an eventual restore action to know which
   * rows to undelete. Empty array when the candidate had none. */
  application_ids: string[]
  /** Index signature lets this object slot directly into writeAuditLog's
   * `Record<string, unknown>` shape without a cast at the call site. */
  [key: string]: unknown
}

export function buildCandidateDeleteAuditDetails(
  applicationIds: ReadonlyArray<string>,
): CandidateDeleteAuditDetails {
  // Defensive: filter out empties/non-strings so a Supabase row with a stray
  // `null` doesn't break the JSONB roundtrip.
  const ids = applicationIds.filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  )
  return {
    cascaded_applications: ids.length,
    application_ids: ids,
  }
}
