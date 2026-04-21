import Link from 'next/link'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TrialBannerProps {
  trialEndAt: string | null
  isExpired: boolean
}

function daysRemaining(endAt: string): number {
  const diff = new Date(endAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export function TrialBanner({ trialEndAt, isExpired }: TrialBannerProps) {
  if (isExpired) {
    return (
      <div className="flex items-center justify-between bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-sm text-destructive">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Your trial has expired. Upgrade to keep full access to your data.
          </span>
        </div>
        <Button size="sm" variant="destructive" asChild className="ml-4 shrink-0">
          <Link href="/subscription">Upgrade now</Link>
        </Button>
      </div>
    )
  }

  if (!trialEndAt) return null

  const days = daysRemaining(trialEndAt)
  if (days > 7) return null

  return (
    <div className="flex items-center justify-between bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:border-amber-800/40 dark:text-amber-400">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          {days === 0
            ? 'Your trial expires today.'
            : `Your trial expires in ${days} day${days === 1 ? '' : 's'}.`}
        </span>
      </div>
      <Button size="sm" variant="outline" asChild className="ml-4 shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400">
        <Link href="/subscription">Upgrade</Link>
      </Button>
    </div>
  )
}
