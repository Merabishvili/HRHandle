// Pure helpers for the global search palette (G-023). Live outside the
// server action so both ends of the wire share the same normalisation +
// escaping rules — and so the rules are unit-testable without a DB.

/** Minimum query length before the search action is invoked. Below this we
 * just show the "Keep typing…" empty state instead of hammering the DB with
 * `%a%` matches that return every row in the org. */
export const MIN_QUERY_LENGTH = 2

/** Cap per result group so the palette stays compact. Tuned for the small-
 * org sweet spot — bigger orgs that need more should narrow their query. */
export const MAX_RESULTS_PER_GROUP = 5

/**
 * Trim, collapse whitespace, and reject queries below the minimum length.
 * Returns the cleaned string, or `''` for queries that should be treated as
 * empty (no DB call, palette shows "Keep typing…").
 */
export function normalizeQuery(raw: string | null | undefined): string {
  if (raw == null) return ''
  const collapsed = raw.replace(/\s+/g, ' ').trim()
  if (collapsed.length < MIN_QUERY_LENGTH) return ''
  return collapsed
}

/**
 * Escape characters that have meaning in PostgreSQL `ilike` patterns so a
 * recruiter pasting text with `%` or `_` doesn't get surprising matches.
 *
 * Order matters — escape the backslash first or we double-escape the
 * backslashes the % / _ escapes themselves produce.
 */
export function escapeForIlike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/**
 * Convenience: full pre-DB transformation. Returns the wildcard-wrapped
 * pattern ready to drop into a `.ilike()` filter, or `null` for empty
 * queries (caller skips the search entirely).
 */
export function toIlikePattern(raw: string | null | undefined): string | null {
  const q = normalizeQuery(raw)
  if (!q) return null
  return `%${escapeForIlike(q)}%`
}
