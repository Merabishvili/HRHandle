'use client'

import { Sparkles, Pencil } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

export type EntryMode = 'cv' | 'manual'

interface StepPathSelectProps {
  /** Currently-selected mode. Both tiles render the same step body
   * downstream — the mode only changes whether the CV-upload affordance
   * lights up at the top of Step 1. */
  value: EntryMode | null
  onChange: (next: EntryMode) => void
}

/**
 * Wave 2.7 candidate wizard — Step 0 / Choose path per Create Candidate
 * Steps.dc.html.
 *
 * Two-tile path selector. "Upload CV first" is the brand-blue
 * highlighted default per the design — AI prefill is the recommended
 * happy path. "Fill manually" is the fallback when the recruiter has
 * the candidate's details in hand already.
 */
export function StepPathSelect({ value, onChange }: StepPathSelectProps) {
  const t = useTranslations()
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted-foreground">
        {t('candWizard.path.question')}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <PathTile
          icon={Sparkles}
          title={t('candWizard.path.cvTitle')}
          body={t('candWizard.path.cvBody')}
          selected={value === 'cv'}
          onClick={() => onChange('cv')}
        />
        <PathTile
          icon={Pencil}
          title={t('candWizard.path.manualTitle')}
          body={t('candWizard.path.manualBody')}
          selected={value === 'manual'}
          onClick={() => onChange('manual')}
          subdued
        />
      </div>
    </div>
  )
}

function PathTile({
  icon: Icon,
  title,
  body,
  selected,
  onClick,
  subdued,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  title: string
  body: string
  selected: boolean
  onClick: () => void
  subdued?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex flex-col items-start gap-2 rounded-xl p-4 text-left transition-colors',
        selected
          ? 'border-[1.5px] border-[oklch(0.55_0.18_250)] bg-[oklch(0.98_0.015_250)]'
          : 'border border-[oklch(0.9_0.01_250)] hover:bg-muted/40',
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={
            selected
              ? { background: 'oklch(0.93 0.05 250)' }
              : { background: 'oklch(0.95 0.01 250)' }
          }
          aria-hidden
        >
          <Icon
            className={cn('h-[18px] w-[18px]', selected ? 'text-[oklch(0.45_0.16_250)]' : 'text-muted-foreground')}
          />
        </span>
        <span
          className={cn(
            'text-[14px] font-bold',
            selected ? 'text-[oklch(0.2_0.16_250)]' : subdued ? 'text-foreground/80' : 'text-foreground',
          )}
        >
          {title}
        </span>
      </div>
      <p className="text-[12.5px] leading-[1.5] text-muted-foreground">{body}</p>
    </button>
  )
}
