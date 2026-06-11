// Declares the per-list-kind shape used by the saved-views feature (G-026).
//
// Each kind names the URL params that COUNT as "filter state" — the ones
// we persist into `saved_views.params` and compare for the "modified after
// loading" badge. Pagination + the default sort are deliberately excluded
// so a saved view doesn't drift from itself just because the recruiter is
// now on page 2 or hasn't touched the sort dropdown.

export const SAVED_VIEW_KINDS = ['candidates', 'vacancies'] as const
export type SavedViewKind = (typeof SAVED_VIEW_KINDS)[number]

export function isSavedViewKind(value: string): value is SavedViewKind {
  return (SAVED_VIEW_KINDS as ReadonlyArray<string>).includes(value)
}

interface KindConfig {
  /** Param keys that participate in saved-view filter comparison. Ordering
   * here also governs the canonical encoded shape so two equivalent filters
   * always serialise identically. */
  readonly filterKeys: ReadonlyArray<string>
  /** Value that should be treated as the default for `sort` — saved views
   * strip this so "no sort touched" matches "sort cleared to default". */
  readonly defaultSort: string
  /** Base path the toolbar links to when loading or saving a view. */
  readonly basePath: string
}

export const SAVED_VIEW_CONFIG: Record<SavedViewKind, KindConfig> = {
  candidates: {
    filterKeys: ['search', 'status', 'sort', 'vacancy'],
    defaultSort: 'created_desc',
    basePath: '/candidates',
  },
  vacancies: {
    filterKeys: ['search', 'status', 'sort'],
    defaultSort: 'created_desc',
    basePath: '/vacancies',
  },
}
