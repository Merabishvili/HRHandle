import { mapPipelineStageToBucket, type PipelineStageRowForBucket } from '@/lib/pipeline-stages/bucket'
import type { LegacyStatusCode } from '@/lib/pipeline-stages/resolve'

export interface RemainingApplicationRow {
  applicationId: string
  candidateId: string
  candidateName: string
  email: string | null
  /** The application's pipeline stage id (null for a legacy row without one). */
  stageId: string | null
  stage: (PipelineStageRowForBucket & { sort_order?: number | null }) | null
}

export interface RemainingCandidate {
  applicationId: string
  candidateId: string
  candidateName: string
  hasEmail: boolean
}

export interface RemainingStage {
  /** The pipeline stage id — `none` for legacy applications without a stage. */
  key: string
  /** The stored stage name (localize the seeded ones with `pipelineStageLabel`). */
  name: string
  bucket: LegacyStatusCode
  /** Offer stages start unticked — someone there may be about to accept. */
  isOffer: boolean
  candidates: RemainingCandidate[]
}

/** Buckets still "in progress". Hired, rejected and withdrawn are final. */
const IN_PROGRESS: readonly LegacyStatusCode[] = ['applied', 'screening', 'interview', 'offer']

export const NO_STAGE_KEY = 'none'

/**
 * One vacancy's candidates who are still in progress, grouped by their
 * pipeline stage in board order (custom stages included) — the rows of the
 * "Reject remaining candidates" window. Final stages are left out.
 */
export function groupRemainingByStage(rows: RemainingApplicationRow[]): RemainingStage[] {
  const stages = new Map<string, RemainingStage & { order: number }>()
  for (const row of rows) {
    // A legacy row with no stage sits in the first column on the board.
    const bucket: LegacyStatusCode = row.stage ? mapPipelineStageToBucket(row.stage) : 'applied'
    if (!IN_PROGRESS.includes(bucket)) continue
    const key = row.stageId ?? NO_STAGE_KEY
    let stage = stages.get(key)
    if (!stage) {
      stage = {
        key,
        name: row.stage?.name ?? '',
        bucket,
        isOffer: bucket === 'offer',
        candidates: [],
        order: row.stage?.sort_order ?? -1,
      }
      stages.set(key, stage)
    }
    stage.candidates.push({
      applicationId: row.applicationId,
      candidateId: row.candidateId,
      candidateName: row.candidateName,
      hasEmail: !!row.email?.trim(),
    })
  }
  return [...stages.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...stage }) => ({
      ...stage,
      candidates: stage.candidates.sort((a, b) => a.candidateName.localeCompare(b.candidateName)),
    }))
}

/** Stages ticked when the window opens: everything except Offer. */
export function defaultStageKeys(stages: RemainingStage[]): string[] {
  return stages.filter((s) => !s.isOffer).map((s) => s.key)
}

/** Everyone still in progress, Offer included. */
export function remainingTotal(stages: RemainingStage[]): number {
  return stages.reduce((sum, s) => sum + s.candidates.length, 0)
}

/** The applications to reject: candidates of the ticked stages, minus exceptions. */
export function applicationsToReject(
  stages: RemainingStage[],
  checkedKeys: Iterable<string>,
  excludedApplicationIds: Iterable<string>,
): string[] {
  const checked = new Set(checkedKeys)
  const excluded = new Set(excludedApplicationIds)
  return stages
    .filter((s) => checked.has(s.key))
    .flatMap((s) => s.candidates)
    .filter((c) => !excluded.has(c.applicationId))
    .map((c) => c.applicationId)
}
