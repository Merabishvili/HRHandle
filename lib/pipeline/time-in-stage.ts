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
  /** Human label intended for direct render: "16h", "2d", "5d", "Just now". */
  label: string
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
  if (hours < 1) {
    label = 'Just now'
  } else if (hours < 24) {
    label = `${hours}h`
  } else {
    const days = Math.floor(hours / 24)
    label = `${days}d`
  }

  const isStale = hours >= STALE_DAYS * 24

  return { label, isStale, hours }
}
