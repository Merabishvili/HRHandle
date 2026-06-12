export const PERIODS = ['7d', '30d', '90d', '365d', 'all'] as const
export type Period = (typeof PERIODS)[number]

export const DEFAULT_PERIOD: Period = '30d'

export const PERIOD_LABELS: Record<Period, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '365d': 'Last 365 days',
  all: 'All time',
}

export function isPeriod(value: string | null | undefined): value is Period {
  return value !== null && value !== undefined && (PERIODS as readonly string[]).includes(value)
}

export function parsePeriod(value: string | null | undefined): Period {
  return isPeriod(value) ? value : DEFAULT_PERIOD
}

export interface PeriodRange {
  start: Date | null
  end: Date
}

/** Convert a period to an inclusive [start, end] date range. `start = null` means "all time". */
export function periodToRange(period: Period, now: Date = new Date()): PeriodRange {
  const end = now
  if (period === 'all') return { start: null, end }
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return { start, end }
}
