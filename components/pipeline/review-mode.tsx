'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  X,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  XCircle,
  Briefcase,
  Building2,
  ExternalLink,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { CrossVacancyApplication } from './cross-vacancy-board'

interface ReviewModeProps {
  queue: CrossVacancyApplication[]
  onClose: () => void
  /** Move candidate to the next active stage. The board owns the
   * resulting status update + optimistic re-render. */
  onAdvance: (applicationId: string) => Promise<void> | void
  /** Open the rejection dialog for this candidate. The board owns the
   * dialog so we don't double-render rejection UI. */
  onReject: (applicationId: string) => void
}

/**
 * Wave 2.2 (folded into 2.1) — keyboard-driven Review mode.
 *
 * Full-screen overlay showing one candidate at a time from the new-arrivals
 * queue (applications whose status hasn't been changed since they applied).
 * The recruiter judges each candidate without leaving the keyboard:
 *
 *   ←/J  Previous candidate
 *   →/K  Next candidate
 *   A    Advance to next stage (calls onAdvance — board owns the optimistic
 *        update + server action)
 *   R    Reject (opens the existing RejectionDialog via onReject)
 *   Esc  Exit Review mode
 *
 * When the queue empties (or starts empty), the overlay shows a "no new
 * candidates" empty state with an exit button — Review mode without a queue
 * has nothing to do.
 *
 * The component is purposefully thin — all state changes are routed back to
 * the parent board so the kanban updates as the recruiter judges. We track
 * only the visible-index cursor and the local "advancing" / "rejecting"
 * pending flag.
 */
export function ReviewMode({ queue, onClose, onAdvance, onReject }: ReviewModeProps) {
  const [index, setIndex] = useState(0)
  const [pending, setPending] = useState(false)

  // When the queue shrinks (candidate advanced / rejected from this overlay),
  // clamp the cursor instead of letting it dangle off the end.
  useEffect(() => {
    if (index >= queue.length) {
      setIndex(Math.max(0, queue.length - 1))
    }
  }, [queue.length, index])

  const current = queue[index] ?? null

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(i + 1, Math.max(0, queue.length - 1)))
  }, [queue.length])

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1))
  }, [])

  const advance = useCallback(async () => {
    if (!current || pending) return
    setPending(true)
    try {
      await onAdvance(current.id)
    } finally {
      setPending(false)
    }
  }, [current, pending, onAdvance])

  const reject = useCallback(() => {
    if (!current || pending) return
    onReject(current.id)
  }, [current, pending, onReject])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't hijack typing.
      const tag = (e.target as HTMLElement | null)?.tagName
      const isInput =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (e.target as HTMLElement | null)?.isContentEditable
      if (isInput) return

      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'ArrowLeft':
        case 'j':
        case 'J':
          e.preventDefault()
          goPrev()
          break
        case 'ArrowRight':
        case 'k':
        case 'K':
          e.preventDefault()
          goNext()
          break
        case 'a':
        case 'A':
          e.preventDefault()
          void advance()
          break
        case 'r':
        case 'R':
          e.preventDefault()
          reject()
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, goPrev, goNext, advance, reject])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review mode"
      className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm"
    >
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
            Review mode
          </span>
          {queue.length > 0 && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{index + 1}</span> of{' '}
              {queue.length} new
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            ← / → to navigate · A advance · R reject · Esc exit
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Exit review mode"
            className="h-8 w-8"
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          {current ? (
            <article className="rounded-2xl border border-border bg-card p-8 shadow-sm">
              <p className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Briefcase className="h-3 w-3" aria-hidden />
                {current.vacancy_title}
              </p>

              <h2 className="mt-4 text-2xl font-bold text-foreground">
                {current.first_name} {current.last_name}
              </h2>

              {(current.current_position || current.current_company) && (
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {current.current_position && (
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5" aria-hidden />
                      <span>{current.current_position}</span>
                    </div>
                  )}
                  {current.current_company && (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" aria-hidden />
                      <span>{current.current_company}</span>
                    </div>
                  )}
                </div>
              )}

              <p className="mt-3 text-xs text-muted-foreground">
                Applied {format(new Date(current.applied_at), 'MMM d, yyyy')}
              </p>

              <Link
                href={`/candidates/${current.candidate_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Open full profile
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>

              <div className="mt-8 flex flex-wrap items-center gap-2">
                <Button onClick={advance} disabled={pending} className="gap-2">
                  <ArrowRight className="h-4 w-4" aria-hidden />
                  Advance
                  <kbd className="ml-1 rounded border border-primary-foreground/20 bg-primary-foreground/10 px-1.5 py-0.5 font-mono text-[10px]">
                    A
                  </kbd>
                </Button>
                <Button
                  variant="outline"
                  onClick={reject}
                  disabled={pending}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <XCircle className="h-4 w-4" aria-hidden />
                  Reject
                  <kbd className="ml-1 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                    R
                  </kbd>
                </Button>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goPrev}
                  disabled={index === 0}
                  aria-label="Previous candidate"
                  className="h-9 w-9"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goNext}
                  disabled={index >= queue.length - 1}
                  aria-label="Next candidate"
                  className="h-9 w-9"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </article>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
              <p className="text-lg font-medium text-foreground">No new candidates to review</p>
              <p className="mt-2 text-sm text-muted-foreground">
                You&apos;ve worked through every new application. Come back when fresh ones land.
              </p>
              <Button onClick={onClose} className="mt-6">
                Back to board
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
