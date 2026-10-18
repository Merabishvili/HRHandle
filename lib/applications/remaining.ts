import { mapPipelineStageToBucket, type PipelineStageRowForBucket } from '@/lib/pipeline-stages/bucket'
import type { LegacyStatusCode } from '@/lib/pipeline-stages/resolve'

export interface RemainingApplicationRow {
  applicationId: string
  candidateId: string
  candidateName: string
  email: string | null
  /** The application's pipeline stage (null for a legacy row without one). */
  stage: (PipelineStageRowForBucket & { sort_order?: number | null }) | null
}

export interface RemainingCandidate {
  applicationId: string
  candidateId: string
  candidateName: string
  stageName: string
  bucket: LegacyStatusCode
  hasEmail: boolean
}

export interface RemainingSplit {
  /** Still in progress — Applied, review (screening) and interview stages. */
  toReject: RemainingCandidate[]
  /** At an Offer stage — never rejected in bulk; the recruiter decides each one. */
  atOffer: RemainingCandidate[]
}

/** Stages "Reject remaining candidates" covers. Hired, rejected and withdrawn
 * applications are final and left out; Offer is handled one by one. */
export const BULK_REJECTABLE_BUCKETS: readonly LegacyStatusCode[] = ['applied', 'screening', 'interview']

/**
 * Splits one vacancy's applications for "Reject remaining candidates": who is
 * still in progress (rejected together) and who sits at the Offer stage
 * (listed, not touched). Ordered as on the board — by stage, then by name.
 */
export function splitRemaining(rows: RemainingApplicationRow[]): RemainingSplit {
  const toReject: (RemainingCandidate & { order: number })[] = []
  const atOffer: (RemainingCandidate & { order: number })[] = []
  for (const row of rows) {
    // A legacy row with no stage sits in the first column on the board.
    const bucket: LegacyStatusCode = row.stage ? mapPipelineStageToBucket(row.stage) : 'applied'
    const item = {
      applicationId: row.applicationId,
      candidateId: row.candidateId,
      candidateName: row.candidateName,
      stageName: row.stage?.name ?? '',
      bucket,
      hasEmail: !!row.email?.trim(),
      order: row.stage?.sort_order ?? 0,
    }
    if (BULK_REJECTABLE_BUCKETS.includes(bucket)) toReject.push(item)
    else if (bucket === 'offer') atOffer.push(item)
  }
  const byBoardOrder = (a: { order: number; candidateName: string }, b: { order: number; candidateName: string }) =>
    a.order - b.order || a.candidateName.localeCompare(b.candidateName)
  const strip = ({ order: _order, ...rest }: RemainingCandidate & { order: number }): RemainingCandidate => rest
  return {
    toReject: toReject.sort(byBoardOrder).map(strip),
    atOffer: atOffer.sort(byBoardOrder).map(strip),
  }
}

/** Candidate counts per stage name, in board order — "Applied 7 · Screening 3". */
export function countByStage(candidates: RemainingCandidate[]): { stageName: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const c of candidates) counts.set(c.stageName, (counts.get(c.stageName) ?? 0) + 1)
  return [...counts].map(([stageName, count]) => ({ stageName, count }))
}
