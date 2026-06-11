// Pure helpers for the audit-log viewer (G-019). Live in their own file so
// both the listing action and the CSV export route can share the same input
// shape + validation, and so the URL→filter parsing is unit-testable without
// spinning up Supabase.

export interface AuditLogFilter {
  /** Substring match against `action` (case-insensitive `ilike`). */
  action: string | null
  /** Substring match against `entity_type` (case-insensitive `ilike`). */
  entityType: string | null
  /** Single user_id to scope to. */
  userId: string | null
  /** Inclusive ISO date (YYYY-MM-DD). */
  from: string | null
  /** Inclusive ISO date (YYYY-MM-DD). */
  to: string | null
}

/** Build a normalized filter from the `?` URL search params. Any unrecognised
 * shape collapses to null so the caller can keep its query simple. */
export function parseAuditLogFilter(
  params: Record<string, string | null | undefined>,
): AuditLogFilter {
  const trim = (v: string | null | undefined): string | null => {
    if (v == null) return null
    const t = v.trim()
    return t.length === 0 ? null : t
  }

  // Date inputs are HTML <input type="date"> values — YYYY-MM-DD. Anything
  // else (timestamps, slashes, garbage) gets rejected so the SQL stays sane.
  const dateOrNull = (v: string | null | undefined): string | null => {
    const t = trim(v)
    if (!t) return null
    return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null
  }

  // user_id has to be a UUID for the SELECT below to make sense. Otherwise
  // the page would call .eq('user_id', 'foo') and silently match nothing.
  const uuidOrNull = (v: string | null | undefined): string | null => {
    const t = trim(v)
    if (!t) return null
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)
      ? t.toLowerCase()
      : null
  }

  return {
    action: trim(params.action),
    entityType: trim(params.entityType),
    userId: uuidOrNull(params.userId),
    from: dateOrNull(params.from),
    to: dateOrNull(params.to),
  }
}

/** True iff the filter has at least one non-null field. Used by the UI to
 * decide whether to render a "Clear filters" button. */
export function isFilterActive(filter: AuditLogFilter): boolean {
  return (
    filter.action !== null ||
    filter.entityType !== null ||
    filter.userId !== null ||
    filter.from !== null ||
    filter.to !== null
  )
}

/** Turn the filter into the URL search params shape so the toolbar can keep
 * the URL in sync. Empty/null fields are omitted. */
export function filterToSearchParams(filter: AuditLogFilter): Record<string, string> {
  const out: Record<string, string> = {}
  if (filter.action) out.action = filter.action
  if (filter.entityType) out.entityType = filter.entityType
  if (filter.userId) out.userId = filter.userId
  if (filter.from) out.from = filter.from
  if (filter.to) out.to = filter.to
  return out
}
