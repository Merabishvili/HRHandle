import { cn } from '@/lib/utils'

const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'] as const
const STAGE_CODES = ['applied', 'screening', 'interview', 'offer', 'hired'] as const

type StageCode = typeof STAGE_CODES[number]

interface PipelineMiniBarProps {
  currentStageCode: StageCode | string | null
}

export function PipelineMiniBar({ currentStageCode }: PipelineMiniBarProps) {
  const currentIdx = STAGE_CODES.indexOf(currentStageCode as StageCode)

  return (
    <div className="mt-3 flex items-center gap-0">
      {STAGES.map((stage, i) => {
        const isDone    = i < currentIdx
        const isCurrent = i === currentIdx
        const connector = i < STAGES.length - 1

        return (
          <div key={stage} className="flex items-center">
            <span
              className={cn(
                'rounded-full px-[9px] py-[3px] text-[10.5px] font-medium leading-none',
                isCurrent && 'border border-[oklch(0.55_0.18_250)] bg-[oklch(0.55_0.18_250/0.15)] text-[oklch(0.35_0.15_250)]',
                isDone    && 'bg-[oklch(0.65_0.17_145/0.15)] text-[oklch(0.35_0.13_145)]',
                !isCurrent && !isDone && 'bg-muted text-muted-foreground',
              )}
            >
              {stage}
            </span>
            {connector && (
              <span
                className={cn(
                  'mx-0.5 h-px w-2 shrink-0',
                  isDone ? 'bg-[oklch(0.65_0.17_145)]' : 'bg-border'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
