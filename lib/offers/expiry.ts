// Helpers for deciding whether a `sent` offer has timed out. Used by the
// candidate-facing page (view-time safety net) and the daily cron (sets the
// persistent `status = 'expired'`).

/** Returns true if `expiryDate` is strictly before `today`. Both sides are
 * treated as calendar dates (YYYY-MM-DD), not timestamps. A null/undefined
 * expiry is never expired.
 *
 * Implementation note: we parse both strings as UTC dates rather than using
 * the Date constructor with timezone arithmetic. That keeps the boundary
 * predictable — an expiry of 2026-06-30 stops being valid on 2026-07-01 in
 * every timezone, which is the contract candidates and recruiters expect.
 */
export function isOfferExpired(
  expiryDate: string | Date | null | undefined,
  today: Date = new Date(),
): boolean {
  if (!expiryDate) return false

  const expiryYmd =
    expiryDate instanceof Date ? toYmd(expiryDate) : String(expiryDate).slice(0, 10)
  const todayYmd = toYmd(today)
  return expiryYmd < todayYmd
}

function toYmd(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
