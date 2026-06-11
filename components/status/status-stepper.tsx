import { STEPPER_BUCKETS, type Bucket } from '@/lib/application-status-bucket'
import { Check } from 'lucide-react'

interface StatusStepperProps {
  /** Current bucket. "closed" suppresses the stepper (caller decides what to
   * render instead — see the page for the closed-case banner). */
  currentBucket: Bucket
  /** When true, the current step is rendered as completed instead of in-progress
   * — used for `outcome: 'hired'` so the candidate sees a finalised decision. */
  decisionComplete?: boolean
}

export function StatusStepper({
  currentBucket,
  decisionComplete = false,
}: StatusStepperProps) {
  const currentIndex = STEPPER_BUCKETS.findIndex((s) => s.bucket === currentBucket)

  return (
    <ol className="flex w-full items-center justify-between gap-2">
      {STEPPER_BUCKETS.map((step, i) => {
        const isCompleted =
          i < currentIndex || (i === currentIndex && decisionComplete)
        const isCurrent = i === currentIndex && !decisionComplete
        const isFuture = i > currentIndex

        return (
          <li key={step.bucket} className="flex flex-1 flex-col items-center text-center">
            <div
              className={[
                'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                isCompleted
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : isCurrent
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-gray-300 bg-white text-gray-400',
              ].join(' ')}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {isCompleted ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
            </div>
            <span
              className={[
                'mt-2 text-xs font-medium',
                isCurrent
                  ? 'text-indigo-700'
                  : isCompleted
                    ? 'text-emerald-700'
                    : isFuture
                      ? 'text-gray-400'
                      : 'text-gray-600',
              ].join(' ')}
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
