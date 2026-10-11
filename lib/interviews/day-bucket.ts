import { addDays, isSameDay, isSameWeek } from 'date-fns'

/**
 * The day group an interview is listed under on /interviews: today first, then
 * the coming days, then everything already in the past at the bottom —
 * whatever its status (a completed interview from last week is "Past", not
 * "This week" or "Later"). `now` is injectable.
 */
export type InterviewDayBucket = 'today' | 'tomorrow' | 'this_week' | 'later' | 'past'

export function interviewDayBucket(scheduledAt: Date, now: Date = new Date()): InterviewDayBucket {
  if (isSameDay(scheduledAt, now)) return 'today'
  if (scheduledAt < now) return 'past'
  if (isSameDay(scheduledAt, addDays(now, 1))) return 'tomorrow'
  if (isSameWeek(scheduledAt, now, { weekStartsOn: 1 })) return 'this_week'
  return 'later'
}
