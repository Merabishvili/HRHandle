import {
  FUNNEL_STAGES,
  FUNNEL_STAGE_LABELS,
  type FunnelCounts,
  stageConversion,
} from '@/lib/reports/funnel'
import { getStageStyle } from '@/lib/pipeline/stage-style'

interface FunnelChartProps {
  data: FunnelCounts
}

/**
 * Wave 2.10 — Funnel chart per `Reports and Interviews.dc.html` §1.
 *
 * The previous implementation used Recharts with a single brand-blue
 * fill — the design fix specifies the **stage palette** (Applied blue /
 * Screening amber / Interview purple / Offer teal / Hired green), with
 * bars width-scaled to the max count and a conversion % beside every
 * non-entry row. CSS is enough; Recharts was overkill here.
 *
 * Width is calculated as `count / max(applied, 1)` so the Applied bar
 * always sits at 100% and downstream bars shrink in proportion.
 */
export function FunnelChart({ data }: FunnelChartProps) {
  const maxCount = Math.max(data.applied, 1)

  return (
    <div className="flex flex-col gap-2.5">
      {FUNNEL_STAGES.map((stage, idx) => {
        const count = data[stage]
        const prev = idx === 0 ? null : FUNNEL_STAGES[idx - 1] ?? null
        const conv = prev === null ? null : stageConversion(data[prev], count)
        const style = getStageStyle(stage)
        // Use a tiny minimum width so zero-count bars are still visible as
        // a sliver instead of disappearing entirely — keeps the label
        // alignment consistent across rows.
        const widthPct = Math.max(2, Math.round((count / maxCount) * 100))

        return (
          <div key={stage} className="flex items-center gap-3.5">
            <span className="w-[90px] shrink-0 text-[12.5px] text-foreground/70">
              {FUNNEL_STAGE_LABELS[stage]}
            </span>
            <div
              className="flex h-[34px] items-center rounded-[7px] px-3"
              style={{ width: `${widthPct}%`, background: style.pillBg }}
            >
              <span
                className="text-[13px] font-bold tabular-nums"
                style={{ color: style.pillText }}
              >
                {count}
              </span>
            </div>
            {conv !== null && (
              <span className="text-[11.5px] text-muted-foreground tabular-nums">
                {Math.round(conv * 100)}%
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
