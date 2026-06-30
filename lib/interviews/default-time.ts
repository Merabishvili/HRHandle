/**
 * Default date + time for the schedule-interview form — the next usable
 * business slot: round up to the next half-hour, clamp into 09:00–17:30, roll
 * to the next morning when out of hours, and skip weekends. Date and time are
 * computed together so the default is always a real future weekday slot (never
 * the arbitrary current minute, never a past time). `now` is injectable.
 */
export interface InterviewSlot {
  /** yyyy-MM-dd (local). */
  date: string
  /** HH:mm (24h, local). */
  time: string
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function hm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function nextBusinessSlot(now: Date = new Date()): InterviewSlot {
  const d = new Date(now.getTime())
  d.setSeconds(0, 0)

  // Round up to the next half-hour.
  const min = d.getMinutes()
  if (min > 30) {
    d.setHours(d.getHours() + 1, 0, 0, 0)
  } else if (min > 0) {
    d.setMinutes(30, 0, 0)
  }

  // Before business hours → 09:00 today.
  if (d.getHours() < 9) {
    d.setHours(9, 0, 0, 0)
  }

  // After 17:30 → next day, 09:00.
  if (d.getHours() > 17 || (d.getHours() === 17 && d.getMinutes() > 30)) {
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
  }

  // Skip weekends → Monday 09:00.
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
  }

  return { date: ymd(d), time: hm(d) }
}

/** Just the time half of the next business slot. */
export function defaultBusinessTime(now: Date = new Date()): string {
  return nextBusinessSlot(now).time
}
