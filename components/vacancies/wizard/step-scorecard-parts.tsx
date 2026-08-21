'use client'

import { type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  supportsKnockout,
  TYPE_LABEL_KEY,
  type ScorecardScreeningQuestion,
  type NumberOp,
} from './scorecard-shared'

/**
 * One screening question in the wizard list — editable in place: an
 * Informational | Knockout segmented control and, when Knockout, the
 * type-appropriate passing-condition editor. Short-text can't be a knockout.
 */
export function ScreeningQuestionRow({
  q,
  onPatch,
  onRemove,
}: {
  q: ScorecardScreeningQuestion
  onPatch: (patch: Partial<ScorecardScreeningQuestion>) => void
  onRemove: () => void
}) {
  const t = useTranslations()
  const canKnockout = supportsKnockout(q.answerType)

  return (
    <li className="rounded-[9px] border border-[oklch(0.92_0.01_250)] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-foreground">
          {q.label}
        </span>
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {t(TYPE_LABEL_KEY[q.answerType])}
        </span>
        {q.knockout && (
          <span className="shrink-0 rounded bg-[oklch(0.96_0.05_27)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[oklch(0.5_0.19_27)]">
            {t('wizard.knockout')}
          </span>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('wizard.removeNamed', { label: q.label })}
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {/* Purpose */}
      <div
        className="mt-2 inline-flex rounded-md border border-[oklch(0.9_0.01_250)] p-0.5"
        role="radiogroup"
        aria-label={t('wizard.questionPurpose')}
      >
        <PurposeButton active={!q.knockout} onClick={() => onPatch({ knockout: false })}>
          {t('wizard.informational')}
        </PurposeButton>
        <PurposeButton
          active={q.knockout}
          disabled={!canKnockout}
          onClick={() => onPatch({ knockout: true })}
        >
          {t('wizard.knockout')}
        </PurposeButton>
      </div>
      {!canKnockout && (
        <p className="mt-1 text-[10.5px] text-muted-foreground">
          {t('wizard.shortTextNoKnockout')}
        </p>
      )}

      {/* Passing-condition editor */}
      {q.knockout && canKnockout && (
        <div className="mt-2">
          <KnockoutConditionEditor q={q} onPatch={onPatch} />
        </div>
      )}
    </li>
  )
}

/**
 * Type-appropriate passing-condition editor for a knockout screening question
 * (yes/no answer, number comparison, or select options). Shared by the create
 * wizard and the vacancy-edit screening card so both offer the same UX (#N9).
 */
export function KnockoutConditionEditor({
  q,
  onPatch,
}: {
  q: ScorecardScreeningQuestion
  onPatch: (patch: Partial<ScorecardScreeningQuestion>) => void
}) {
  const t = useTranslations()
  const options = q.options ?? []
  return (
    <div className="rounded-md border border-[oklch(0.93_0.03_27)] bg-[oklch(0.99_0.008_27)] p-2.5">
      {q.answerType === 'yes_no' && (
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-muted-foreground">{t('wizard.passingAnswer')}</span>
          {(['yes', 'no'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onPatch({ passYesNo: v })}
              aria-pressed={q.passYesNo === v}
              className={cn(
                'rounded-md border px-2.5 py-1 text-[11.5px] font-semibold capitalize transition-colors',
                q.passYesNo === v
                  ? 'border-[oklch(0.55_0.18_250)] bg-[oklch(0.98_0.015_250)] text-[oklch(0.2_0.16_250)]'
                  : 'border-[oklch(0.9_0.01_250)] text-foreground/75 hover:bg-muted/40',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {q.answerType === 'number' && (
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-muted-foreground">{t('wizard.passesWhen')}</span>
          <select
            value={q.numberOp}
            onChange={(e) => onPatch({ numberOp: e.target.value as NumberOp })}
            aria-label={t('wizard.comparison')}
            className="h-8 rounded-md border border-[oklch(0.9_0.01_250)] bg-white px-2 text-[12px]"
          >
            <option value="lte">≤</option>
            <option value="gte">≥</option>
            <option value="between">{t('wizard.between')}</option>
          </select>
          <Input
            type="number"
            inputMode="numeric"
            value={q.numberValue ?? ''}
            onChange={(e) =>
              onPatch({ numberValue: e.target.value === '' ? null : Number(e.target.value) })
            }
            placeholder={t('wizard.valuePlaceholder')}
            className="h-8 w-[110px] text-[12px]"
            aria-label={t('wizard.knockoutValueAria')}
          />
          {q.numberOp === 'between' && (
            <>
              <span className="text-muted-foreground">{t('auth.and')}</span>
              <Input
                type="number"
                inputMode="numeric"
                value={q.numberValue2 ?? ''}
                onChange={(e) =>
                  onPatch({
                    numberValue2: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                placeholder={t('wizard.valuePlaceholder')}
                className="h-8 w-[110px] text-[12px]"
                aria-label={t('wizard.knockoutUpperValueAria')}
              />
            </>
          )}
        </div>
      )}

      {q.answerType === 'select' && (
        <div className="text-[12px]">
          <p className="mb-1.5 text-muted-foreground">{t('wizard.passingOptions')}</p>
          <div className="flex flex-col gap-1">
            {options.map((opt) => {
              const checked = q.passOptions.some((o) => o.toLowerCase() === opt.toLowerCase())
              return (
                <label key={opt} className="flex items-center gap-2 text-foreground/85">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      onPatch({
                        passOptions: e.target.checked
                          ? [...q.passOptions, opt]
                          : q.passOptions.filter((o) => o.toLowerCase() !== opt.toLowerCase()),
                      })
                    }
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                  {opt}
                </label>
              )
            })}
          </div>
          {q.passOptions.length === 0 && (
            <p className="mt-1 text-[10.5px] text-[oklch(0.5_0.19_27)]">
              {t('wizard.pickOnePassing')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function PurposeButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'rounded-[5px] px-2.5 py-1 text-[11.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        active ? 'bg-[oklch(0.55_0.18_250)] text-white' : 'text-foreground/70 hover:bg-muted/50',
      )}
    >
      {children}
    </button>
  )
}
