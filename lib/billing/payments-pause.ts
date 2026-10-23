/**
 * Payments pause — the fallback for when the payment provider is unavailable
 * for a long time (suspended account, contract ended, outage). Pure; the date
 * comes from the server-only `BILLING_PAUSED_UNTIL` env var (YYYY-MM-DD or
 * ISO), set on Vercel by the owner. While it is in the future:
 *  - paid plans whose period ran out are NOT locked (customers aren't punished
 *    for renewals we can't take); trials still end as usual;
 *  - checkout is refused with a "payments paused" message and Upgrade is off;
 *  - the billing page shows a notice with the date.
 * Remove the variable (or let the date pass) to return to normal.
 * Runbook: docs/4-integrations/flitt.md → "If payments stop".
 */
export function parsePausedUntil(value: string | undefined | null, now: Date = new Date()): Date | null {
  if (!value) return null
  const v = value.trim()
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T23:59:59Z` : v)
  if (Number.isNaN(d.getTime())) return null
  return d.getTime() > now.getTime() ? d : null
}

/** The current pause end, read from the environment (server only). */
export function paymentsPausedUntil(now: Date = new Date()): Date | null {
  return parsePausedUntil(process.env.BILLING_PAUSED_UNTIL, now)
}
