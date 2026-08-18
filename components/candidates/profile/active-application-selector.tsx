'use client'

import { Briefcase, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { getStageStyle } from '@/lib/pipeline/stage-style'
import { statusLabel } from '@/lib/pipeline/status-i18n'
import type { ApplicationStatus } from '@/lib/types/application'

export interface ActiveApplicationOption {
  applicationId: string
  vacancyTitle: string
  stage: { code: ApplicationStatus['code']; name: string } | null
}

interface ActiveApplicationSelectorProps {
  /** All live (non-terminal) applications for this candidate. The selector
   * never includes closed ones — those live in the History panel instead. */
  options: ActiveApplicationOption[]
  /** Currently selected application id (the one whose stage-contextual
   * block is rendered below). */
  selectedId: string | null
  onSelect: (applicationId: string) => void
}

/**
 * Wave 2.3 active-application selector per Candidate Profile A Refined.dc.html
 *
 * Single pill at the top of the profile body. Shows the currently-selected
 * live application's role title + stage badge. Clicking opens a popover with
 * every other live application — picking one switches the stage-contextual
 * block below. Disabled (rendered as a label only) when there's exactly
 * one live application.
 *
 * Empty state ("no live applications") is handled by the caller — when
 * there's nothing live, this component isn't rendered.
 */
export function ActiveApplicationSelector({
  options,
  selectedId,
  onSelect,
}: ActiveApplicationSelectorProps) {
  const t = useTranslations()
  const selected = options.find((o) => o.applicationId === selectedId) ?? options[0] ?? null
  if (!selected) return null

  const stageStyle = selected.stage ? getStageStyle(selected.stage.code) : null

  const triggerContent = (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border-[1.5px] border-[oklch(0.55_0.18_250)] bg-white px-3 py-1.5',
        'shadow-[0_0_0_3px_oklch(0.55_0.18_250_/_0.1)]',
      )}
    >
      <Briefcase className="h-3.5 w-3.5 text-[oklch(0.45_0.16_250)]" aria-hidden />
      <span className="text-[13px] font-semibold text-foreground">{selected.vacancyTitle}</span>
      {selected.stage && stageStyle && (
        <span
          className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold"
          style={{ background: stageStyle.pillBg, color: stageStyle.pillText }}
        >
          {statusLabel(t, selected.stage.code, selected.stage.name)}
        </span>
      )}
      {options.length > 1 && (
        <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
      )}
    </div>
  )

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[oklch(0.45_0.16_250)]">
        {t('activeApp.label')}
      </span>

      {options.length === 1 ? (
        triggerContent
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label={t('activeApp.switchAria')} className="cursor-pointer">
              {triggerContent}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-1">
            <ul className="flex flex-col gap-0.5">
              {options.map((option) => {
                const isCurrent = option.applicationId === selected.applicationId
                const optionStageStyle = option.stage ? getStageStyle(option.stage.code) : null
                return (
                  <li key={option.applicationId}>
                    <button
                      type="button"
                      onClick={() => onSelect(option.applicationId)}
                      aria-pressed={isCurrent}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-muted',
                        isCurrent && 'bg-muted',
                      )}
                    >
                      <span className="flex-1 truncate font-medium">{option.vacancyTitle}</span>
                      {option.stage && optionStageStyle && (
                        <span
                          className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold"
                          style={{ background: optionStageStyle.pillBg, color: optionStageStyle.pillText }}
                        >
                          {statusLabel(t, option.stage.code, option.stage.name)}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </PopoverContent>
        </Popover>
      )}

      <span className="text-[12px] text-muted-foreground">
        {t('activeApp.hint')}
      </span>
    </div>
  )
}
