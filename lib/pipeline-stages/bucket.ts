import type { LegacyStatusCode } from './resolve'

/**
 * Wave 2.6 Slice 2a — Recruiter-facing bucket-mapper.
 *
 * The cross-vacancy board (/pipeline) renders one column per canonical
 * legacy status code (Applied / Screening / Interview / Offer / Hired /
 * Rejected / Withdrawn). Once vacancies have their own custom
 * pipeline_stages rows, each application's stage needs to "collapse"
 * back to one of those canonical codes so the board's column model
 * stays intact.
 *
 * The mapping keys off the `type` enum on `pipeline_stages` (locked Q3:
 * `standard | review | interview | offer`), with `is_terminal` resolving
 * the standard/terminal split — every terminal standard stage falls into
 * one of the three terminal buckets (hired / rejected / withdrawn). The
 * NAME is consulted only to disambiguate which terminal bucket a custom
 * terminal stage belongs to; a recruiter naming a custom rejection
 * stage "Closed" or "Not a fit" still ends up in the Rejected bucket
 * via case-insensitive substring match.
 *
 * Pulled out as a pure function so the cross-vacancy page (and any
 * future readers — reports, exports, candidate profile) can reuse the
 * mapping without re-implementing the switch.
 */
export interface PipelineStageRowForBucket {
  type: 'standard' | 'review' | 'interview' | 'offer'
  name: string
  is_terminal: boolean
}

export function mapPipelineStageToBucket(
  row: PipelineStageRowForBucket,
): LegacyStatusCode {
  if (row.type === 'review') return 'screening'
  if (row.type === 'interview') return 'interview'
  if (row.type === 'offer') return 'offer'

  // type === 'standard' — split by is_terminal.
  if (!row.is_terminal) return 'applied'

  // Terminal standard. The seeder writes three: Hired / Rejected /
  // Withdrawn. Custom rows let recruiters add their own terminals
  // (e.g. "Closed - not a fit"). Match by lowercase substring against
  // the legacy code's keyword stem. Order matters: 'hire' is checked
  // first so a stage named "Re-hired" doesn't fall into rejected.
  // 'withdr' (not 'withdraw') catches both "Withdrawn" and the past-
  // tense "Withdrew" without bringing other unrelated words into scope.
  const lower = row.name.toLowerCase()
  if (lower.includes('hire')) return 'hired'
  if (lower.includes('withdr')) return 'withdrawn'
  // Default terminal standard → rejected (the most common custom case).
  return 'rejected'
}
