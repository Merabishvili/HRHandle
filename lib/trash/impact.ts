// Pure helpers for the restore-from-trash UI (G-020). Live outside the
// server-action file so the audit-row → impact derivation is unit-testable.

export interface CandidateRestoreImpact {
  cascadedApplicationIds: string[]
}

/** Given an audit-log row's `details` JSONB blob, extract the application
 * IDs that were soft-deleted alongside the candidate. We expect the shape
 * BL-007 produced:
 *
 *   { cascaded_applications: number, application_ids: string[] }
 *
 * The number is informational only; we re-count from the array because it's
 * the IDs that drive the restore UPDATE. Empty/missing array → no cascade.
 */
export function extractRestoreImpact(
  details: unknown,
): CandidateRestoreImpact {
  if (!details || typeof details !== 'object') {
    return { cascadedApplicationIds: [] }
  }
  const raw = (details as { application_ids?: unknown }).application_ids
  if (!Array.isArray(raw)) {
    return { cascadedApplicationIds: [] }
  }
  const ids = raw.filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  )
  return { cascadedApplicationIds: ids }
}

/** Days remaining before the daily purge cron will hard-delete a soft-
 * deleted row. Mirrors `PURGE_THRESHOLD_DAYS = 30` from the cron route.
 * Returns 0 when the row is at or past the threshold (purge is imminent or
 * overdue — recruiter can still hard-delete manually now). */
export function daysUntilPurge(
  deletedAt: string | Date | null | undefined,
  now: Date = new Date(),
  thresholdDays = 30,
): number {
  if (!deletedAt) return thresholdDays
  const deleted = deletedAt instanceof Date ? deletedAt : new Date(deletedAt)
  if (Number.isNaN(deleted.getTime())) return thresholdDays
  const elapsedMs = now.getTime() - deleted.getTime()
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24))
  return Math.max(0, thresholdDays - elapsedDays)
}
