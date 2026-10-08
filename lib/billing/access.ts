/**
 * Subscription access rules — pure, no I/O (unit-testable, safe anywhere).
 *
 * Decides whether an org is locked out of the dashboard (redirected to
 * /settings/billing). Covers both an expired trial and a paid period that has
 * ended without a successful renewal.
 */

/** Days a failed/late auto-renewal keeps working after the period ends. */
export const RENEWAL_GRACE_DAYS = 3

const DAY_MS = 24 * 60 * 60 * 1000

export interface SubscriptionAccessFields {
  status: string
  trial_end_at: string | null
  current_period_end_at: string | null
  next_billing_at: string | null
}

/**
 * True when the org must be sent to billing.
 *
 * - `expired` → locked.
 * - `trial` → locked once `trial_end_at` passes.
 * - Paid (`active` / `past_due` / `canceled`) with a period end:
 *   - auto-renew on (`next_billing_at` set) → locked `RENEWAL_GRACE_DAYS`
 *     after the period end, so a late or failed renewal has time to recover;
 *   - auto-renew off (canceled) → locked right at the period end.
 * - No period end (manual / complimentary plan) → never locked.
 */
export function isSubscriptionLocked(
  sub: SubscriptionAccessFields | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!sub) return false
  if (sub.status === 'expired') return true

  if (sub.status === 'trial') {
    return !!sub.trial_end_at && new Date(sub.trial_end_at) < now
  }

  if (!sub.current_period_end_at) return false
  const end = new Date(sub.current_period_end_at).getTime()
  const autoRenewOn = !!sub.next_billing_at && sub.status !== 'canceled'
  const deadline = autoRenewOn ? end + RENEWAL_GRACE_DAYS * DAY_MS : end
  return now.getTime() > deadline
}

/**
 * Status to show on the billing page. A locked paid plan reads `expired`
 * whatever is stored — nothing rewrites the row when a period simply runs out.
 */
export function displaySubscriptionStatus<T extends string>(
  sub: SubscriptionAccessFields & { status: T; plan_code: string },
  now: Date = new Date(),
): T | 'expired' {
  return sub.plan_code !== 'trial' && isSubscriptionLocked(sub, now) ? 'expired' : sub.status
}

/**
 * Members don't manage billing, but when the org is locked the dashboard
 * layout sends everyone to /settings/billing — redirecting a member away again
 * would loop (pipeline → billing → pipeline …), so they get a read-only view.
 */
export function canViewBilling(role: string, locked: boolean): boolean {
  return role === 'owner' || role === 'admin' || locked
}
