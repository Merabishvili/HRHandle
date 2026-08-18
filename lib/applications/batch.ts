// Pure helpers for bulk operations on applications (G-024). Live outside the
// server action so the per-row outcome → summary mapping can be unit-tested
// without spinning up Supabase.

export type RowOutcome = 'moved' | 'skipped' | 'failed'

export interface RowResult {
  applicationId: string
  outcome: RowOutcome
  /** Free-text reason for skip/fail; surfaced in the toast or audit-log. */
  message?: string
}

export interface OutcomeSummary {
  moved: number
  skipped: number
  failed: number
  total: number
}

/** Roll an array of per-row outcomes into a summary the toast can render in
 * a single sentence. `total` is included so the caller can show "X of Y
 * moved" without re-summing on the client. */
export function partitionByOutcome(results: ReadonlyArray<RowResult>): OutcomeSummary {
  let moved = 0
  let skipped = 0
  let failed = 0
  for (const r of results) {
    if (r.outcome === 'moved') moved++
    else if (r.outcome === 'skipped') skipped++
    else if (r.outcome === 'failed') failed++
  }
  return { moved, skipped, failed, total: results.length }
}

/** Render a one-sentence summary for the toast. Keeps the language consistent
 * with `partitionByOutcome` so the messages don't drift between sites. */
export function summaryToString(summary: OutcomeSummary, stageLabel: string): string {
  const parts: string[] = []
  if (summary.moved > 0) parts.push(`${summary.moved} moved to ${stageLabel}`)
  if (summary.skipped > 0) parts.push(`${summary.skipped} skipped`)
  if (summary.failed > 0) parts.push(`${summary.failed} failed`)
  if (parts.length === 0) return 'No changes.'
  return parts.join(' · ') + '.'
}
