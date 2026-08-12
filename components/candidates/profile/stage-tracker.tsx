'use client'

import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { getStageStyle } from '@/lib/pipeline/stage-style'
import { statusLabel } from '@/lib/pipeline/status-i18n'
import type { ApplicationStatus } from '@/lib/types/application'

interface StageTrackerProps {
  /** Ordered list of stages to render. Pass only the active (non-terminal)
   * stages for the standard tracker; the design shows Applied → Screening →
   * Interview → Offer → Hired with no Rejected/Withdrawn. */
  stages: { code: ApplicationStatus['code']; name: string }[]
  /** Code of the current stage (highlighted with brand-blue ring). Steps
   * before it render as `passed` (filled), steps after as `pending`. */
  currentCode: ApplicationStatus['code']
  /** Compact mode = smaller pills + thinner connectors. Used inside the
   * stage-contextual block where the tracker is a microheader. */
  compact?: boolean
}

/**
 * Wave 2.3 stage tracker per Candidate Profile A Refined.dc.html.
 *
 * Horizontal stepper showing each stage as a pill with a thin connector
 * between. Passed stages render in the stage's own colour; the current
 * stage adds a brand-blue focus ring. Future stages render as a thin
 * outline with neutral text.
 */
export function StageTracker({ stages, currentCode, compact = false }: StageTrackerProps) {
  const t = useTranslations()
  // Callers pass only the active (non-terminal) stages, so the terminal "Hired"
  // node is missing. The confirmed design always shows the full 5-node path
  // ending in Hired — append it here so every tracker renders it (it's always a
  // pending/future node since the profile only shows active applications).
  const renderStages = stages.some((s) => s.code === 'hired')
    ? stages
    : [...stages, { code: 'hired' as const, name: 'Hired' }]
  const currentIdx = renderStages.findIndex((s) => s.code === currentCode)

  return (
    <div
      className={cn(
        'flex items-center',
        compact ? 'gap-1.5 text-[10.5px]' : 'gap-1.5 text-[11.5px]',
      )}
      role="list"
      aria-label={t('stageTracker.aria')}
    >
      {renderStages.map((stage, idx) => {
        const isCurrent = idx === currentIdx
        const isPassed = currentIdx >= 0 && idx < currentIdx
        const style = getStageStyle(stage.code)
        const isLast = idx === renderStages.length - 1

        const padding = compact ? 'px-1.5 py-0.5' : 'px-2.5 py-[3px]'

        let pillStyle: React.CSSProperties = {}
        let pillClassName = `${padding} rounded-md font-semibold`

        if (isCurrent) {
          pillStyle = { background: style.pillBg, color: style.pillText }
          pillClassName += ' shadow-[0_0_0_3px_oklch(0.55_0.18_250_/_0.12)]'
        } else if (isPassed) {
          pillStyle = { background: style.pillBg, color: style.pillText }
        } else {
          pillClassName += ' border border-[oklch(0.9_0.01_250)] text-muted-foreground'
        }

        return (
          <div key={stage.code} className="flex flex-1 items-center gap-1.5" role="listitem">
            <span
              className={pillClassName}
              style={pillStyle}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {statusLabel(t, stage.code, stage.name)}
            </span>
            {!isLast && (
              <span
                className={cn(
                  'flex-1 rounded-full',
                  compact ? 'h-px' : 'h-0.5',
                )}
                style={{
                  background: isPassed ? 'oklch(0.85 0.04 155)' : 'oklch(0.9 0.01 250)',
                }}
                aria-hidden
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
