/**
 * Builds Flitt's `recurring_data` for a subscription checkout. Pure — no env,
 * no SDK — so the shape Flitt validates is unit-tested.
 *
 * Contract (docs.flitt.com/api/subscriptions): `every`, `period`, `amount` are
 * mandatory, plus either `quantity` or `end_time`.
 *
 * We send **explicit `start_time` + `end_time`** and no `quantity`. When
 * start_time was omitted, Flitt's checkout page filled the dates itself and
 * submitted each one a day early for UTC+ browsers (showed 08/10/2026, sent
 * "2026-10-07") — a start date in the past → payment declined with
 * "2008 Order parameters are incorrect". It also paired its own 5-year end
 * date with our `quantity`, contradicting it.
 *
 * - `start_time` = the **next billing date** (today in Asia/Tbilisi + one
 *   period): the checkout charges the first period now, the schedule's first
 *   charge is the first renewal. Stays in the future even if the page shifts it
 *   a day back (a renewal a day early just extends from the period end — see
 *   lib/flitt/lifecycle.ts).
 * - `end_time` = start + `RECURRING_HORIZON_YEARS`; cancel stops it earlier.
 * - `state: 'shown_readonly'` → the schedule is shown but the payer can't
 *   switch auto-renew off on Flitt's page (`'y'` allows it, leaving us expecting
 *   renewals that never come). Customers cancel from /settings/billing.
 */

/** How far ahead the schedule runs; cancel stops it earlier. */
export const RECURRING_HORIZON_YEARS = 10

/** The merchant's (and Flitt's) local calendar — dates are computed here. */
const MERCHANT_TIMEZONE = 'Asia/Tbilisi'

export type RecurringPeriod = 'day' | 'week' | 'month'

/** Today's calendar date in the merchant timezone, as a UTC-midnight Date. */
function merchantToday(now: Date): Date {
  // en-CA formats as YYYY-MM-DD.
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: MERCHANT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return new Date(`${ymd}T00:00:00Z`)
}

/** Add months, clamping to the month's last day (Jan 31 + 1 → Feb 28). */
function addMonthsClamped(d: Date, months: number): Date {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay))
  return target
}

function addPeriods(d: Date, every: number, period: RecurringPeriod): Date {
  if (period === 'month') return addMonthsClamped(d, every)
  const days = period === 'week' ? every * 7 : every
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000)
}

const ymd = (d: Date) => d.toISOString().slice(0, 10)

export function buildRecurringData(input: {
  every: number
  period: RecurringPeriod
  amountMinor: number
  /** Override the first scheduled charge date (YYYY-MM-DD). */
  startDate?: string | undefined
  now?: Date | undefined
}): Record<string, unknown> {
  const start = input.startDate
    ? new Date(`${input.startDate}T00:00:00Z`)
    : addPeriods(merchantToday(input.now ?? new Date()), input.every, input.period)
  const end = addMonthsClamped(start, RECURRING_HORIZON_YEARS * 12)
  return {
    every: input.every,
    period: input.period,
    amount: input.amountMinor,
    start_time: ymd(start),
    end_time: ymd(end),
    state: 'shown_readonly',
    readonly: 'y',
  }
}
