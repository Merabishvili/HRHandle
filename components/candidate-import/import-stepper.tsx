'use client'

import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = ['upload', 'review', 'confirm'] as const
export type StepKey = (typeof STEPS)[number]

const LABEL: Record<StepKey, string> = {
  upload: 'csvImport.step.upload',
  review: 'csvImport.step.review',
  confirm: 'csvImport.step.confirm',
}

export function ImportStepper({ current }: { current: StepKey }) {
  const t = useTranslations()
  const currentIdx = STEPS.indexOf(current)
  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        return (
          <div key={step} className="flex items-center">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-[26px] w-[26px] items-center justify-center rounded-full text-[12px] font-bold',
                  done && 'bg-success text-success-foreground',
                  active && 'bg-primary text-primary-foreground',
                  !done && !active && 'border border-border text-muted-foreground',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-sm',
                  active || done ? 'font-semibold text-foreground' : 'text-muted-foreground',
                )}
              >
                {t(LABEL[step])}
              </span>
            </div>
            {i < STEPS.length - 1 && <span className="mx-3.5 h-px w-16 bg-border" />}
          </div>
        )
      })}
    </div>
  )
}
