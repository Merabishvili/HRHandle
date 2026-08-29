'use client'

import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { getStageStyle } from '@/lib/pipeline/stage-style'
import { pipelineStageLabel } from '@/lib/pipeline/status-i18n'
import type { ApplicationStatus } from '@/lib/types/application'

interface StageTrackerProps {
  /** Ordered list of stages to render. Pass only the active (non-terminal)
   * stages; the design ends the path in Hired (appended here). Each stage's
   * `id` (the per-vacancy pipeline_stage id) makes the current-stage match
   * exact even when two stages share a canonical bucket (e.g. two interviews). */
  stages: { code: ApplicationStatus['code']; name: string; id?: string }[]
  /** Code of the current stage — the fallback match when `currentId` is absent
   * or not found (e.g. the canonical-status fallback tracker). */
  currentCode: ApplicationStatus['code']
  /** Id of the current stage — preferred over `currentCode` so duplicate-bucket
   * stages highlight the exact node the candidate sits on. */
  currentId?: string | undefined
  /** Compact mode = smaller pills + thinner connectors. Used inside the
   * stage-contextual block where the tracker is a microheader. */
  compact?: boolean
}

/**
 * Wave 2.3 stage tracker per Candidate Profile A Refined.dc.html.
 *
 * Horizontal stepper showing each stage as a pill with a thin connector
 * between. Passed + current stages render in the stage's own (saturated)
 * colour; the current stage adds a brand-blue focus ring. Future stages
 * render as a pale tint of their own hue so the pipeline stays colour-coded
 * end to end.
 */
export function StageTracker({ stages, currentCode, currentId, compact = false }: StageTrackerProps) {
  const t = useTranslations()
  // Callers pass only the active (non-terminal) stages, so the terminal "Hired"
  // node is missing. The confirmed design always shows the path ending in Hired
  // — append it here (it's always a future node since the profile only shows
  // active applications).
  const renderStages = stages.some((s) => s.code === 'hired')
    ? stages
    : [...stages, { code: 'hired' as const, name: 'Hired', id: undefined }]
  // Prefer an exact id match (unique per stage); fall back to bucket code.
  const currentIdx =
    (currentId ? renderStages.findIndex((s) => s.id === currentId) : -1) !== -1
      ? renderStages.findIndex((s) => s.id === currentId)
      : renderStages.findIndex((s) => s.code === currentCode)

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
        const pillClassName = `${padding} rounded-md font-semibold`

        if (isCurrent) {
          pillStyle = { background: style.pillBg, color: style.pillText }
        } else if (isPassed) {
          pillStyle = { background: style.pillBg, color: style.pillText }
        } else {
          // Future stage — pale tint of its own hue with a hairline border
          // (was a colourless grey outline), so every stage shows its colour.
          pillStyle = {
            background: style.columnBg,
            color: style.pillText,
            boxShadow: `inset 0 0 0 1px ${style.columnBorder}`,
          }
        }
        if (isCurrent) {
          pillStyle.boxShadow = '0 0 0 3px oklch(0.55 0.18 250 / 0.18)'
        }

        return (
          <div key={stage.id ?? `${stage.code}-${idx}`} className="flex flex-1 items-center gap-1.5" role="listitem">
            <span
              className={pillClassName}
              style={pillStyle}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {pipelineStageLabel(t, stage.name)}
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
