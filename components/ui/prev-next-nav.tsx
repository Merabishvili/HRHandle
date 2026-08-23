import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

interface PrevNextNavProps {
  /** Href for the previous record, or null when at the start of the list. */
  prevHref: string | null
  /** Href for the next record, or null when at the end of the list. */
  nextHref: string | null
  prevLabel: string
  nextLabel: string
}

/**
 * Compact prev/next pager for detail pages (#2). Renders two arrow buttons.
 * Renders NOTHING when there are no neighbours on either side (e.g. the org
 * only has one candidate/vacancy). Each arrow is disabled at the list
 * boundary. Plain anchors — usable from server and client components alike.
 */
export function PrevNextNav({ prevHref, nextHref, prevLabel, nextLabel }: PrevNextNavProps) {
  if (!prevHref && !nextHref) return null

  const base =
    'inline-flex h-7 w-7 items-center justify-center rounded-md border border-[oklch(0.88_0.01_250)] text-muted-foreground transition-colors'

  return (
    <div className="flex items-center gap-1">
      {prevHref ? (
        <Link href={prevHref} aria-label={prevLabel} title={prevLabel} className={cn(base, 'hover:bg-muted hover:text-foreground')}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Link>
      ) : (
        <span aria-disabled="true" aria-label={prevLabel} className={cn(base, 'cursor-not-allowed opacity-40')}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </span>
      )}
      {nextHref ? (
        <Link href={nextHref} aria-label={nextLabel} title={nextLabel} className={cn(base, 'hover:bg-muted hover:text-foreground')}>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : (
        <span aria-disabled="true" aria-label={nextLabel} className={cn(base, 'cursor-not-allowed opacity-40')}>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </span>
      )}
    </div>
  )
}
