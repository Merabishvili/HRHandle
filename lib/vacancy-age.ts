/**
 * Recency descriptor for the vacancies-list subtitle ("Full-time · opened 12d
 * ago"). Returns an i18n key + day count rather than a formatted string so the
 * caller localizes it via `t(key, { days })` — the verb changes by status (a
 * draft was "created", anything published is "opened") and "today" is used
 * under a full day.
 *
 * The age is taken from `created_at` (no dedicated published timestamp exists).
 * `now` is injectable so the unit test isn't time-bombed.
 */
export interface VacancyRecency {
  /** next-intl key: vacAge.openedToday | vacAge.createdToday | vacAge.openedAgo | vacAge.createdAgo */
  key: string
  days: number
}

export function vacancyRecencyLabel(
  createdAt: string | Date,
  isDraft: boolean,
  now: Date = new Date(),
): VacancyRecency {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt)
  const days = Math.max(
    0,
    Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)),
  )
  const key = isDraft
    ? days === 0 ? 'vacAge.createdToday' : 'vacAge.createdAgo'
    : days === 0 ? 'vacAge.openedToday' : 'vacAge.openedAgo'
  return { key, days }
}
