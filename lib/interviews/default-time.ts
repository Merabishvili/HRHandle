/**
 * Sensible default interview time for the schedule form — the next half-hour
 * slot, clamped into business hours (09:00–17:30); otherwise 09:00. Avoids
 * defaulting to the arbitrary current minute. `now` is injectable for tests.
 */
export function defaultBusinessTime(now: Date = new Date()): string {
  let h = now.getHours()
  let m = now.getMinutes()
  if (m > 30) {
    m = 0
    h += 1
  } else if (m > 0) {
    m = 30
  }
  if (h < 9 || h > 17 || (h === 17 && m > 30)) {
    h = 9
    m = 0
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
