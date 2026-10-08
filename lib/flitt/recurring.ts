/**
 * Builds Flitt's `recurring_data` for a subscription checkout. Pure — no env,
 * no SDK — so the shape Flitt validates is unit-tested.
 *
 * Contract (docs.flitt.com/api/subscriptions):
 *  - `every`, `period`, `amount` are mandatory.
 *  - **Either `quantity` or `end_time` is mandatory** (no default). Omitting
 *    both lets the checkout page open but the payment fails with
 *    "2008 Order parameters are incorrect".
 *  - `start_time` omitted → the schedule is anchored to the approval of the
 *    first (checkout) payment, which is what we want.
 *  - `state: 'shown_readonly'` → the schedule is shown on checkout but the payer
 *    can't switch auto-renew off there (they cancel from our billing page).
 *    `'y'` would let them untick it, leaving us expecting renewals Flitt never
 *    makes.
 */

/** How far ahead the schedule runs; cancel stops it earlier. */
export const RECURRING_HORIZON_YEARS = 10

export type RecurringPeriod = 'day' | 'week' | 'month'

const PERIODS_PER_YEAR: Record<RecurringPeriod, number> = { day: 365, week: 52, month: 12 }

export function buildRecurringData(input: {
  every: number
  period: RecurringPeriod
  amountMinor: number
  startDate?: string | undefined
}): Record<string, unknown> {
  const quantity = Math.ceil((PERIODS_PER_YEAR[input.period] * RECURRING_HORIZON_YEARS) / input.every)
  return {
    every: input.every,
    period: input.period,
    amount: input.amountMinor,
    quantity,
    state: 'shown_readonly',
    readonly: 'y',
    ...(input.startDate ? { start_time: input.startDate } : {}),
  }
}
