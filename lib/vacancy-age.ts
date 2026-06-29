/**
 * Recency suffix for the vacancies-list subtitle ("Full-time · opened 12d ago").
 *
 * The design shows employment type + age under each vacancy title. There is no
 * dedicated published/opened timestamp on the vacancies table, so age is taken
 * from `created_at`; only the verb changes by status — a draft was "created",
 * anything published is "opened". Day-granularity to match the design's compact
 * "Nd ago" form (today for < 1 day).
 *
 * `now` is injectable so the unit test isn't time-bombed.
 */
export function vacancyRecencyLabel(
  createdAt: string | Date,
  isDraft: boolean,
  now: Date = new Date(),
): string {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt)
  const verb = isDraft ? 'created' : 'opened'
  const days = Math.max(
    0,
    Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)),
  )
  if (days === 0) return `${verb} today`
  return `${verb} ${days}d ago`
}
