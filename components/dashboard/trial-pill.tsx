import Link from 'next/link'

interface TrialPillProps {
  trialEndAt: string | null
  status: string | null | undefined
}

function daysRemaining(endAt: string): number {
  const diff = new Date(endAt).getTime() - Date.now()
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
        href="/subscription"
        className="ml-1.5 rounded-full border border-amber-300 bg-white px-2.5 py-0.5 font-semibold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
      >
        Upgrade
      </Link>
    </div>
  )
}
