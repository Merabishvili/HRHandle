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

export interface OfferCountdown {
  /** Whole calendar days from today until expiry. 0 means "today is the last
   * valid day". Never negative — expired offers return null from
   * offerCountdown(), not a negative value. */
  daysLeft: number
  /** Human label intended for direct display in the UI. */
  label: string
  /** Urgency hue the caller can map to a colour: `urgent` for ≤1 day,
   * `soon` for ≤7 days, `normal` otherwise. */
  urgency: 'urgent' | 'soon' | 'normal'
}

/** Days-until-expiry view for a `sent` offer. Returns null if the offer is
 * already expired (use `isOfferExpired` for the boolean) or if no expiry
 * date is set (open-ended offer — no countdown to show).
 *
 * Like `isOfferExpired`, the comparison is YMD-stable: midnight in any
 * timezone doesn't flip the result. */
export function offerCountdown(
  expiryDate: string | Date | null | undefined,
  today: Date = new Date(),
): OfferCountdown | null {
  if (!expiryDate) return null
  if (isOfferExpired(expiryDate, today)) return null

  const expiryYmd =
    expiryDate instanceof Date ? toYmd(expiryDate) : String(expiryDate).slice(0, 10)
  const todayYmd = toYmd(today)

  const msPerDay = 1000 * 60 * 60 * 24
  const expiryUtc = Date.parse(`${expiryYmd}T00:00:00Z`)
  const todayUtc = Date.parse(`${todayYmd}T00:00:00Z`)
  const daysLeft = Math.max(0, Math.round((expiryUtc - todayUtc) / msPerDay))

  let label: string
  let urgency: OfferCountdown['urgency']
  if (daysLeft === 0) {
    label = 'Expires today'
    urgency = 'urgent'
  } else if (daysLeft === 1) {
    label = '1 day left'
    urgency = 'urgent'
  } else if (daysLeft <= 7) {
    label = `${daysLeft} days left`
    urgency = 'soon'
  } else {
    label = `${daysLeft} days left`
    urgency = 'normal'
  }

  return { daysLeft, label, urgency }
}

function toYmd(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
