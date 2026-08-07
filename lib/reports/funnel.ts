export const FUNNEL_STAGES = ['applied', 'screening', 'interview', 'offer', 'hired'] as const
export type FunnelStage = (typeof FUNNEL_STAGES)[number]

export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
}

/** i18n keys per funnel stage — callers translate with `t()`. */
export const FUNNEL_STAGE_I18N_KEY: Record<FunnelStage, string> = {
  applied: 'reports.stage.applied',
  screening: 'reports.stage.screening',
  interview: 'reports.stage.interview',
  offer: 'reports.stage.offer',
  hired: 'reports.stage.hired',
}

const STAGE_SORT: Record<FunnelStage, number> = {
  applied: 1,
  screening: 2,
  interview: 3,
  offer: 4,
  hired: 5,
}

export type StatusCode = FunnelStage | 'rejected' | 'withdrawn'

export interface ApplicationRecord {
  id: string
  current_status: StatusCode
}

export interface StatusChangeRecord {
  application_id: string
  to_status: StatusCode
}

/**
 * Compute the highest funnel stage an application ever reached.
 *
 * - If the application's current status is a funnel stage, we count from there.
 * - We also scan every status_changed history row (`to_status`) so a rejected
 *   application that previously reached "interview" counts toward interview.
 * - `rejected` / `withdrawn` are terminal but do not contribute to the funnel.
 *   An application currently rejected may have reached at most whatever stage
 *   appears in its status-change history; if none, it must have been
 *   `applied` to start with (every application enters at applied).
 */
export function maxStageReached(
  app: ApplicationRecord,
  history: StatusChangeRecord[]
): FunnelStage {
  let max: FunnelStage = 'applied'
  let maxSort = STAGE_SORT.applied

  const consider = (code: StatusCode) => {
    if (code === 'rejected' || code === 'withdrawn') return
    const sort = STAGE_SORT[code]
    if (sort > maxSort) {
      max = code
      maxSort = sort
    }
  }

  consider(app.current_status)
  for (const row of history) {
    if (row.application_id === app.id) consider(row.to_status)
  }
  return max
}

export interface FunnelCounts {
  applied: number
  screening: number
  interview: number
  offer: number
  hired: number
  /** Applications that were rejected at some point (whatever stage they reached). */
  rejected: number
  /** Applications that were withdrawn at some point. */
  withdrawn: number
  /** Total applications in the period — for context, including out-of-funnel. */
  total: number
}

/**
 * Build the cumulative funnel: count of applications that ever reached each
 * stage. By construction `applied >= screening >= interview >= offer >= hired`.
 */
export function buildFunnel(
  apps: ApplicationRecord[],
  history: StatusChangeRecord[]
): FunnelCounts {
  let applied = 0
  let screening = 0
  let interview = 0
  let offer = 0
  let hired = 0
  let rejected = 0
  let withdrawn = 0

  for (const app of apps) {
    const max = maxStageReached(app, history)
    applied += 1
    if (STAGE_SORT[max] >= STAGE_SORT.screening) screening += 1
    if (STAGE_SORT[max] >= STAGE_SORT.interview) interview += 1
    if (STAGE_SORT[max] >= STAGE_SORT.offer) offer += 1
    if (STAGE_SORT[max] >= STAGE_SORT.hired) hired += 1
    if (app.current_status === 'rejected') rejected += 1
    if (app.current_status === 'withdrawn') withdrawn += 1
  }

  return { applied, screening, interview, offer, hired, rejected, withdrawn, total: apps.length }
}

/** Conversion rate from one stage to the next, as 0..1 (or null when the numerator is 0). */
export function stageConversion(from: number, to: number): number | null {
  if (from === 0) return null
  return to / from
}
