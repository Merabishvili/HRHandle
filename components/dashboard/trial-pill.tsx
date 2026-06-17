import Link from 'next/link'

interface TrialPillProps {
  trialEndAt: string | null
  status: string | null | undefined
}

/**
 * Days remaining until a trial expiry timestamp, clamped at 0 so an
 * expired trial reads "0 days left" instead of going negative on the
 * UI. Exported so the small bit of arithmetic is unit-testable;
 * `now` is injectable so the tests aren't time-bombed.
 */
export function daysRemaining(endAt: string, now: number = Date.now()): number {
  const diff = new Date(endAt).getTime() - now
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

/**
 * Compact trial pill rendered in the dashboard header (Wave 1.3).
 *
 * Replaces the previous full-width TrialBanner. Per redesign audit §2.1:
 * the banner ate vertical space on every page; a pill collapses it into
 * the header without losing the count + upgrade affordance.
 *
 * Renders only while the subscription is in the `trial` state — paid
 * customers see nothing, and expired-trial users never reach the dashboard
 * layout (the layout redirects them to /subscription before render).
 */
export function TrialPill({ trialEndAt, status }: TrialPillProps) {
  if (status !== 'trial' || !trialEndAt) return null

  const days = daysRemaining(trialEndAt)
  const label =
    days === 0
      ? 'Trial · expires today'
      : `Trial · ${days} day${days === 1 ? '' : 's'} left`

  return (
    <div className="hidden md:flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 py-0.5 pl-3 pr-1 text-xs font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
      <span>{label}</span>
      <Link
        href="/settings/billing"
        className="ml-1.5 rounded-full border border-amber-300 bg-white px-2.5 py-0.5 font-semibold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
      >
        Upgrade
      </Link>
    </div>
  )
}
