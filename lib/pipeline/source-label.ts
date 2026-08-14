/**
 * Map the raw value stored in `candidates.source` to a short label that fits
 * the pipeline card design ("1d · LinkedIn", "2d · Apply link"). Shared by the
 * cross-vacancy and per-vacancy pipeline pages so both cards read the same.
 */
export function shortSourceLabel(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^public apply/i.test(trimmed)) return 'Apply link'
  if (/^company website/i.test(trimmed)) return 'Website'
  if (/^job board/i.test(trimmed)) return 'Job board'
  if (/^csv import/i.test(trimmed)) return 'CSV'
  if (/^manual/i.test(trimmed)) return 'Manual'
  return trimmed
}
