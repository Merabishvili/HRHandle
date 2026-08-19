import { STALE_DAYS } from './stage-style'

/**
 * Granular "time in stage" microcopy for pipeline cards (Wave 2.1 Version B).
 *
 * The design shows tight units ("16h in stage", "1d · LinkedIn", "5d ·
 * stale") rather than the verbose `formatDistanceToNow` output ("about 16
 * hours in stage"). This helper rounds to one of:
 *
 *   < 1 hour       → "Just now"
 *   < 24 hours     → "Nh"      (e.g. "16h")
 *   < N days       → "Nd"      (e.g. "2d", "4d")
 *   ≥ STALE_DAYS   → "Nd"      + stale flag
 *
 * `since` is the timestamp the card considers as "entered the current
 * stage" — for new arrivals that's `applied_at`; for moved candidates
 * it's `last_status_changed_at`.
 *
 * Exported as a single pure function + a derived `isStale` flag so the
 * caller can drive both label and colour off the same calculation.
 */

export interface TimeInStage {
  /** English label for direct render / fallback: "16h", "2d", "Just now".
   * Prefer `timeInStageLabel(t, …)` for localized output. */
  label: string
  /** Unit bucket so callers can localize the label. */
  kind: 'now' | 'hours' | 'days'
  /** The numeric value for `kind` ('hours' → hours, 'days' → days; 0 for 'now'). */
  value: number
  /** True when the time-in-stage hits the design's stale threshold. The
   * card spine + label colour should both flip to amber in that case. */
  isStale: boolean
  /** Total hours rounded to the nearest whole — exposed for the rare
   * caller that wants to sort by it (List view, eventually). */
  hours: number
}

export function timeInStage(
  since: string | Date,
  now: Date = new Date(),
): TimeInStage {
  const sinceDate = since instanceof Date ? since : new Date(since)
  const ms = now.getTime() - sinceDate.getTime()
  const hours = Math.max(0, Math.round(ms / (1000 * 60 * 60)))

  let label: string
  let kind: TimeInStage['kind']
  let value: number
  if (hours < 1) {
    label = 'Just now'
    kind = 'now'
    value = 0
  } else if (hours < 24) {
    label = `${hours}h`
    kind = 'hours'
    value = hours
  } else {
    const days = Math.floor(hours / 24)
    label = `${days}d`
    kind = 'days'
    value = days
  }

  const isStale = hours >= STALE_DAYS * 24

  return { label, kind, value, isStale, hours }
}

/** Localized time-in-stage label ("ახლახ", "16სთ", "2დღ"). Falls back to the
 * English `label` if the keys are missing. */
export function timeInStageLabel(
  t: (key: string, values?: Record<string, string | number>) => string,
  r: Pick<TimeInStage, 'kind' | 'value' | 'label'>,
): string {
  if (r.kind === 'now') return t('pipeline.timeJustNow')
  if (r.kind === 'hours') return t('pipeline.timeHours', { n: r.value })
  return t('pipeline.timeDays', { n: r.value })
}
