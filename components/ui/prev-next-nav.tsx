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

const base =
  'inline-flex items-center gap-1.5 rounded-lg border border-[oklch(0.88_0.01_250)] bg-white px-3 py-2 text-[13px] font-medium text-foreground transition-colors'

/**
 * Prev/next pager bar for detail pages (#2) — a full-width row that sits ABOVE
 * the detail card, with a labelled "‹ Previous …" button on the left and a
 * "Next … ›" button on the right. Renders NOTHING when there are no neighbours
 * on either side (e.g. the org only has one record); each side is disabled at
 * the list boundary.
 */
export function PrevNextNav({ prevHref, nextHref, prevLabel, nextLabel }: PrevNextNavProps) {
  if (!prevHref && !nextHref) return null

  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      {prevHref ? (
        <Link href={prevHref} className={cn(base, 'hover:bg-muted')}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {prevLabel}
        </Link>
      ) : (
        <span aria-disabled="true" className={cn(base, 'cursor-not-allowed opacity-40')}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {prevLabel}
        </span>
      )}
      {nextHref ? (
        <Link href={nextHref} className={cn(base, 'hover:bg-muted')}>
          {nextLabel}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : (
        <span aria-disabled="true" className={cn(base, 'cursor-not-allowed opacity-40')}>
          {nextLabel}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </span>
      )}
    </div>
  )
}
