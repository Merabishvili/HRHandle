export interface TimeToHireSample {
  applicationId: string
  vacancyId: string | null
  vacancyTitle: string | null
  daysToHire: number
}

export interface TimeToHireStats {
  count: number
  median: number | null
  p25: number | null
  p75: number | null
  mean: number | null
  min: number | null
  max: number | null
}

/** Linear-interpolated percentile from a *sorted* array. p in [0, 1]. */
export function percentile(sortedAsc: number[], p: number): number | null {
  if (sortedAsc.length === 0) return null
  if (sortedAsc.length === 1) return sortedAsc[0]
  const idx = (sortedAsc.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sortedAsc[lo]
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo)
}

export function summarize(samples: TimeToHireSample[]): TimeToHireStats {
  if (samples.length === 0) {
    return { count: 0, median: null, p25: null, p75: null, mean: null, min: null, max: null }
  }
  const days = samples.map((s) => s.daysToHire).sort((a, b) => a - b)
  const sum = days.reduce((a, b) => a + b, 0)
  return {
    count: days.length,
    median: percentile(days, 0.5),
    p25: percentile(days, 0.25),
    p75: percentile(days, 0.75),
    mean: sum / days.length,
    min: days[0],
    max: days[days.length - 1],
  }
}

export interface PerVacancyBreakdown {
  vacancyId: string
  vacancyTitle: string
  count: number
  median: number | null
}

/** Aggregate per-vacancy time-to-hire stats, sorted by hire count desc then title asc. */
export function byVacancy(samples: TimeToHireSample[]): PerVacancyBreakdown[] {
  const map = new Map<string, { title: string; days: number[] }>()
  for (const s of samples) {
    if (!s.vacancyId) continue
    const key = s.vacancyId
    const entry = map.get(key) ?? { title: s.vacancyTitle ?? 'Untitled', days: [] }
    entry.days.push(s.daysToHire)
    map.set(key, entry)
  }
  const out: PerVacancyBreakdown[] = []
  for (const [vacancyId, { title, days }] of map.entries()) {
    days.sort((a, b) => a - b)
    out.push({
      vacancyId,
      vacancyTitle: title,
      count: days.length,
      median: percentile(days, 0.5),
    })
  }
  out.sort((a, b) => b.count - a.count || a.vacancyTitle.localeCompare(b.vacancyTitle))
  return out
}

/** Round a day-count to one decimal place, or return '—' for null. */
export function formatDays(value: number | null): string {
  if (value === null) return '—'
  return `${value.toFixed(1)}d`
}
