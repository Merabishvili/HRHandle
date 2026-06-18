'use client'

import { useState } from 'react'
import { X, ArrowRight, XCircle, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ApplicationStatus } from '@/lib/types/application'
import { cn } from '@/lib/utils'

interface BulkBarProps {
  selectedCount: number
  statuses: ApplicationStatus[]
  onMove: (statusId: string) => Promise<void> | void
  onReject: () => void
  onClear: () => void
}

/**
 * Wave 2.1 — bulk action bar.
 *
 * Anchored at the bottom of the viewport when selectedCount > 0. Lets the
 * recruiter move the entire selection to a non-terminal stage in one shot
 * (Move to ▾) or trigger a bulk reject (opens the existing
 * RejectionDialog scoped to the selection — the parent board owns the
 * dialog). Clear deselects without acting.
 *
 * The bar is positioned with safe-area-inset awareness so it stays above
 * the iOS home indicator and never overlaps the kanban content visibly —
 * the parent board adds bottom padding when the bar is up so cards in the
 * last column row remain reachable.
 */
export function BulkBar({
  selectedCount,
  statuses,
  onMove,
  onReject,
  onClear,
}: BulkBarProps) {
  const [moveOpen, setMoveOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const moveableStages = statuses.filter(
    (s) => s.is_active && !['hired', 'rejected', 'withdrawn'].includes(s.code),
  )

  const handleMove = async (statusId: string) => {
    setMoveOpen(false)
    setPending(true)
    try {
      await onMove(statusId)
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-2',
      )}
    >
      <div className="flex max-w-3xl flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-lg">
        <p className="text-sm font-medium text-foreground">
          {selectedCount} selected
        </p>

        <div className="mx-1 hidden h-5 w-px bg-border sm:block" />

        <Select
          open={moveOpen}
          onOpenChange={setMoveOpen}
          onValueChange={handleMove}
          disabled={pending}
        >
          <SelectTrigger className="h-8 gap-1.5 text-xs">
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            <SelectValue placeholder="Move to…" />
          </SelectTrigger>
          <SelectContent>
            {moveableStages.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={onReject}
          disabled={pending}
          className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
        >
          <XCircle className="h-3.5 w-3.5" aria-hidden />
          Reject
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={pending}
          aria-label="Clear selection"
          className="ml-auto h-8 w-8 p-0"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <X className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </div>
    </div>
  )
}
