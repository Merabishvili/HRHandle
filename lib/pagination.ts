// Pagination primitives shared by the candidates and vacancies list pages.
// The list pages use offset pagination (Postgres .range(from, to)) — that's
// the right choice while orgs stay under a few thousand rows. When a customer
// crosses ~5K rows we'll want keyset/cursor; the audit's F-009 entry tracks
// that as a follow-up.

/** Allowed page sizes. Keep this list short to avoid abuse — a recruiter who
 * wants 200 rows at a time can ask. Clamping in `parsePageSize` below means
 * malformed input always lands on the default. */
export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]
export const DEFAULT_PAGE_SIZE: PageSize = 20

/** Parse the `?pageSize=` URL param into a valid {@link PageSize}. Anything
 * unrecognised falls back to the default — never throws so route handlers
 * don't need a try/catch. */
export function parsePageSize(raw: string | number | null | undefined): PageSize {
  if (raw === null || raw === undefined || raw === '') return DEFAULT_PAGE_SIZE
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
  if (!Number.isFinite(n)) return DEFAULT_PAGE_SIZE
  return (PAGE_SIZE_OPTIONS as ReadonlyArray<number>).includes(n)
    ? (n as PageSize)
    : DEFAULT_PAGE_SIZE
}

/** Sentinel placed between page numbers when there's a gap. The component
 * renders these as a non-interactive `…`. */
export const PAGE_GAP = '…' as const
export type PageItem = number | typeof PAGE_GAP

/**
 * Build a compact list of pages for the paginator UI. Always includes page 1
 * and `totalPages`. Around the current page, includes a window of `siblings`
 * on each side. Fills gaps with the {@link PAGE_GAP} sentinel.
 *
 * Examples (siblings=1):
 * - totalPages=1,  current=1  → [1]
 * - totalPages=5,  current=3  → [1, 2, 3, 4, 5]            (small enough — show all)
 * - totalPages=10, current=1  → [1, 2, 3, '…', 10]
 * - totalPages=10, current=5  → [1, '…', 4, 5, 6, '…', 10]
 * - totalPages=10, current=10 → [1, '…', 8, 9, 10]
 *
 * Returns an empty array when `totalPages <= 0` so callers can hide the
 * paginator entirely without any extra guards.
 */
export function getPageWindow(
  currentPage: number,
  totalPages: number,
  siblings = 1,
): PageItem[] {
  if (totalPages <= 0) return []
  if (totalPages === 1) return [1]

  const safeCurrent = Math.min(Math.max(1, Math.floor(currentPage)), totalPages)
  const safeSiblings = Math.max(0, Math.floor(siblings))

  // Show every page when the windowed view wouldn't actually be more compact.
  // Total slots when windowed = 1 (first) + 1 (gap?) + (2*siblings+1) + 1 (gap?) + 1 (last).
  // With siblings=1 that's at most 7 — so for totalPages ≤ 7 the full list is shorter.
  const fullThreshold = 2 * safeSiblings + 5
  if (totalPages <= fullThreshold) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const windowStart = Math.max(2, safeCurrent - safeSiblings)
  const windowEnd = Math.min(totalPages - 1, safeCurrent + safeSiblings)

  const pages: PageItem[] = [1]
  if (windowStart > 2) pages.push(PAGE_GAP)
  for (let p = windowStart; p <= windowEnd; p++) pages.push(p)
  if (windowEnd < totalPages - 1) pages.push(PAGE_GAP)
  pages.push(totalPages)
  return pages
}
