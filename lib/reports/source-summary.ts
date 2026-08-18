export const SOURCE_TYPE_LABELS: Record<string, string> = {
  public_form: 'Public apply form',
  manual: 'Manual entry',
  csv_import: 'CSV import',
  linkedin: 'LinkedIn',
  internal: 'Internal',
}

export const UNKNOWN_SOURCE_LABEL = 'Unknown'

export interface SourceRow {
  sourceType: string | null
  /** Was this application ever in the `hired` state? */
  hired: boolean
}

export interface SourceSummaryRow {
  /** Canonical source key (raw value with NULL → 'unknown'). */
  key: string
  label: string
  applications: number
  hires: number
  /** hires / applications, null when applications === 0 — defensive, never expected. */
  conversion: number | null
}

export function labelForSource(raw: string | null | undefined): string {
  if (!raw) return UNKNOWN_SOURCE_LABEL
  return SOURCE_TYPE_LABELS[raw] ?? raw
}

/**
 * Group applications by source_type. NULL collapses to a single "Unknown"
 * bucket. Results sorted by application count desc then label asc.
 */
export function buildSourceSummary(rows: SourceRow[]): SourceSummaryRow[] {
  const map = new Map<string, { label: string; applications: number; hires: number }>()
  for (const row of rows) {
    const key = row.sourceType ?? 'unknown'
    const entry = map.get(key) ?? { label: labelForSource(row.sourceType), applications: 0, hires: 0 }
    entry.applications += 1
    if (row.hired) entry.hires += 1
    map.set(key, entry)
  }
  const out: SourceSummaryRow[] = []
  for (const [key, { label, applications, hires }] of map.entries()) {
    out.push({
      key,
      label,
      applications,
      hires,
      conversion: applications > 0 ? hires / applications : null,
    })
  }
  out.sort((a, b) => b.applications - a.applications || a.label.localeCompare(b.label))
  return out
}

export function formatPercent(value: number | null): string {
  if (value === null) return '—'
  return `${(value * 100).toFixed(1)}%`
}
