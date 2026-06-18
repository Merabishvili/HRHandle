'use client'

import { X, Check } from 'lucide-react'
import Link from 'next/link'

import { cn } from '@/lib/utils'

export interface WizardStep {
  id: string
  number: number | string
  label: string
  /** Optional small caption under the label (e.g. "NEW · optional"). */
  tag?: string
}

interface WizardShellProps {
  /** Headline at the top of the modal header — e.g. "Create vacancy". */
  title: string
  /** Step number / total — rendered next to the title. */
  stepStatusLabel: string
  /** The ordered step list shown in the left rail. */
  steps: WizardStep[]
  /** Which step's id is currently active. */
  currentStepId: string
  /** Optional hint card rendered at the bottom of the left rail. The
   * vacancy wizard uses this for the "Fill Basics → Save & publish"
   * shortcut copy. */
  railHint?: React.ReactNode
  /** Close link / handler. The wizard host decides whether closing
   * routes back to the index or aborts an in-progress submit. */
  closeHref?: string
  onClose?: () => void
  /** Main form body for the current step. */
  children: React.ReactNode
  /** Footer slot — wizard host renders Save as draft / Save & publish /
   * Next → here, since the actions are step-aware. */
  footer: React.ReactNode
}

/**
 * Wave 2.7 wizard shell per Create Vacancy / Candidate Steps.dc.html.
 *
 * Single rounded outer card with three regions stacked vertically:
 *   - Modal header (title + step status + close)
 *   - Body: left rail with vertical stepper + right form panel
 *   - Footer: action row passed in by the wizard host
 *
 * Reused for both the vacancy and candidate wizards — the candidate
 * variant just supplies different steps + footer.
 */
export function WizardShell({
  title,
  stepStatusLabel,
  steps,
  currentStepId,
  railHint,
  closeHref,
  onClose,
  children,
  footer,
}: WizardShellProps) {
  const currentIdx = steps.findIndex((s) => s.id === currentStepId)
  const currentStep = currentIdx >= 0 ? steps[currentIdx] : null

  return (
    <article className="overflow-hidden rounded-xl border border-[oklch(0.88_0.01_250)] bg-white shadow-[0_1px_3px_0_oklch(0_0_0_/_0.08)]">
      {/* Modal-style header */}
      <header className="flex items-center gap-4 border-b border-[oklch(0.93_0.01_250)] px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-[18px] font-bold text-foreground">{title}</h1>
          <p className="text-[12.5px] text-muted-foreground">
            {stepStatusLabel}
            {currentStep ? ` · ${currentStep.label}` : ''}
          </p>
        </div>
        <div className="ml-auto shrink-0">
          {closeHref ? (
            <Link
              href={closeHref}
              aria-label="Close wizard"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close wizard"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </header>

      {/* Body: left rail + form panel */}
      <div className="flex flex-col lg:flex-row">
        <aside
          className="flex w-full shrink-0 flex-col gap-1 border-b border-[oklch(0.92_0.01_250)] bg-[oklch(0.985_0.002_247)] p-4 sm:p-[18px] lg:w-[240px] lg:border-b-0 lg:border-r"
          aria-label="Wizard steps"
        >
          {steps.map((step, idx) => {
            const isCurrent = idx === currentIdx
            const isPassed = idx < currentIdx
            return (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-2.5 rounded-[9px] px-3 py-2.5',
                  isCurrent && 'bg-[oklch(0.93_0.05_250)]',
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold',
                  )}
                  style={
                    isCurrent
                      ? { background: 'oklch(0.55 0.18 250)', color: '#fff' }
                      : isPassed
                        ? { background: 'oklch(0.93 0.07 155)', color: 'oklch(0.4 0.13 150)' }
                        : { border: '1.5px solid oklch(0.85 0.01 250)', color: 'oklch(0.5 0.02 250)' }
                  }
                  aria-hidden
                >
                  {isPassed ? <Check className="h-3 w-3" /> : step.number}
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      'truncate text-[13px] font-semibold',
                      isCurrent ? 'text-[oklch(0.2_0.16_250)]' : 'text-foreground/80',
                    )}
                  >
                    {step.label}
                  </p>
                  {step.tag && (
                    <p className="text-[10.5px] font-semibold text-[oklch(0.45_0.16_250)]">
                      {step.tag}
                    </p>
                  )}
                </div>
              </div>
            )
          })}

          {railHint && (
            <div className="mt-auto rounded-[10px] border border-[oklch(0.88_0.05_250)] bg-[oklch(0.98_0.012_250)] p-3 text-[11.5px] leading-[1.45] text-foreground/70">
              {railHint}
            </div>
          )}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-4 px-5 py-5 sm:px-6 sm:py-[22px]">
          {children}
        </section>
      </div>

      {/* Footer */}
      <footer className="flex flex-wrap items-center gap-2.5 border-t border-[oklch(0.93_0.01_250)] px-5 py-3.5 sm:px-6">
        {footer}
      </footer>
    </article>
  )
}
