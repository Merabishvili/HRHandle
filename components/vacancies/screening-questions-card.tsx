'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Loader2, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  bulkCreateScreeningQuestions,
  deleteScreeningQuestion,
} from '@/lib/actions/screening-questions'
import {
  blankQuestion,
  supportsKnockout,
  toKnockoutCondition,
  type ScorecardScreeningQuestion,
} from '@/components/vacancies/wizard/scorecard-shared'
import {
  PurposeButton,
  KnockoutConditionEditor,
} from '@/components/vacancies/wizard/step-scorecard-parts'
import { encodeKnockoutAnswer } from '@/lib/screening-questions/knockout-condition'

type AnswerType = 'yes_no' | 'short_text' | 'number' | 'select'

export interface ScreeningQuestionItem {
  id: string
  label: string
  answer_type: AnswerType
  is_knockout: boolean
  knockout_answer: string | null
  options: string[] | null
  sort_order: number
}

interface ScreeningQuestionsCardProps {
  vacancyId: string
  initialQuestions: ScreeningQuestionItem[]
  canEdit: boolean
}

const TYPE_LABEL_KEYS: Record<AnswerType, string> = {
  yes_no: 'screenQ.typeYesNo',
  short_text: 'screenQ.typeShortText',
  number: 'screenQ.typeNumber',
  select: 'screenQ.typeSelect',
}

const needsOptions = (t: AnswerType) => t === 'select'

/**
 * Wave 2.5 Slice 2a + cleanup — Recruiter-side screening questions card
 * on the Vacancy Detail Scorecard tab. Lists the questions that will
 * appear on the public apply form, and lets owners/admins add or remove
 * them with full answer-type support (yes_no / short_text / number /
 * select with options).
 */
export function ScreeningQuestionsCard({
  vacancyId,
  initialQuestions,
  canEdit,
}: ScreeningQuestionsCardProps) {
  const tr = useTranslations()
  const [questions, setQuestions] = useState(initialQuestions)
  // The question being added — modelled on the wizard's shape so it can reuse
  // the wizard's purpose toggle + passing-condition editor (#N9).
  const [draft, setDraft] = useState<ScorecardScreeningQuestion>(() => blankQuestion('', 'yes_no'))
  const [optionsInput, setOptionsInput] = useState('')
  const [pending, startTransition] = useTransition()

  const parsedOptions = optionsInput
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0)

  const patch = (p: Partial<ScorecardScreeningQuestion>) => setDraft((d) => ({ ...d, ...p }))
  // Draft carrying the live options list so the select-knockout editor can show
  // its checkboxes; passOptions is clamped to the options that still exist.
  const draftForEditor: ScorecardScreeningQuestion = {
    ...draft,
    options: parsedOptions,
    passOptions: draft.passOptions.filter((o) =>
      parsedOptions.some((p) => p.toLowerCase() === o.toLowerCase()),
    ),
  }
  const knockoutEff = supportsKnockout(draft.answerType) ? draft.knockout : false
  const selectNeedsPassing =
    knockoutEff && draft.answerType === 'select' && draftForEditor.passOptions.length === 0
  const canAdd =
    !!draft.label.trim() &&
    (!needsOptions(draft.answerType) || parsedOptions.length > 0) &&
    !selectNeedsPassing

  const resetDraft = () => {
    setDraft(blankQuestion('', 'yes_no'))
    setOptionsInput('')
  }

  const handleAdd = () => {
    const trimmed = draft.label.trim()
    if (!trimmed || !canAdd) return
    const condition = toKnockoutCondition(draftForEditor)

    startTransition(async () => {
      const result = await bulkCreateScreeningQuestions(vacancyId, [
        {
          label: trimmed,
          answerType: draft.answerType,
          knockout: knockoutEff,
          options: needsOptions(draft.answerType) ? parsedOptions : undefined,
          knockoutCondition: condition,
        },
      ])
      if (!result.success) {
        toast.error(result.error)
        return
      }
      // Optimistic insert with a synthetic id; the next revalidate replaces it.
      setQuestions((prev) => [
        ...prev,
        {
          id: `optimistic-${prev.length}-${Date.now()}`,
          label: trimmed,
          answer_type: draft.answerType,
          is_knockout: knockoutEff,
          knockout_answer: knockoutEff ? encodeKnockoutAnswer(draft.answerType, condition) : null,
          options: needsOptions(draft.answerType) ? parsedOptions : null,
          sort_order: (prev[prev.length - 1]?.sort_order ?? -1) + 1,
        },
      ])
      resetDraft()
    })
  }

  const handleRemove = (questionId: string) => {
    startTransition(async () => {
      const result = await deleteScreeningQuestion(questionId, vacancyId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setQuestions((prev) => prev.filter((q) => q.id !== questionId))
    })
  }

  return (
    <section
      className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]"
      aria-label={tr('screenQ.aria')}
    >
      <header className="mb-1 flex items-center gap-2">
        <h2 className="text-[15px] font-bold text-foreground">{tr('screenQ.title')}</h2>
        <span className="rounded bg-[oklch(0.93_0.07_155)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[oklch(0.36_0.14_150)]">
          {tr('pipeline.newBadge')}
        </span>
      </header>
      <p className="mb-3 text-[12.5px] text-muted-foreground">
        {tr('screenQ.desc')}
      </p>

      {questions.length > 0 ? (
        <ul className="space-y-2">
          {questions.map((q) => (
            <li
              key={q.id}
              className="flex items-start gap-2 rounded-[9px] border border-[oklch(0.92_0.01_250)] px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-[12.5px] font-medium text-foreground">{q.label}</p>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {tr(TYPE_LABEL_KEYS[q.answer_type])}
                  </span>
                </div>
                <p
                  className="mt-1 text-[11px] font-semibold"
                  style={{ color: q.is_knockout ? 'oklch(0.5 0.19 27)' : 'oklch(0.5 0.02 250)' }}
                >
                  {q.is_knockout ? (
                    <span className="inline-flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" aria-hidden />
                      {tr('screenQ.knockoutMust', { answer: q.knockout_answer ?? '—' })}
                    </span>
                  ) : (
                    tr('screenQ.informational')
                  )}
                </p>
                {q.answer_type === 'select' && q.options && q.options.length > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {tr('screenQ.options', { list: q.options.join(' · ') })}
                  </p>
                )}
              </div>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={tr('screenQ.remove', { label: q.label })}
                  onClick={() => handleRemove(q.id)}
                  disabled={pending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[9px] border border-dashed border-border bg-muted/30 px-3 py-2.5 text-[12.5px] text-muted-foreground">
          {tr('screenQ.empty')}
          {canEdit ? tr('screenQ.emptyAdd') : ''}
        </p>
      )}

      {canEdit && (
        <div className="mt-3 flex flex-col gap-2 rounded-[9px] border border-dashed border-[oklch(0.88_0.01_250)] p-2.5">
          <Input
            placeholder={tr('screenQ.labelPlaceholder')}
            value={draft.label}
            onChange={(e) => patch({ label: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !needsOptions(draft.answerType) && !draft.knockout) {
                e.preventDefault()
                handleAdd()
              }
            }}
            disabled={pending}
            maxLength={500}
            className="text-sm"
          />

          {/* Type picker */}
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={tr('screenQ.answerTypeAria')}>
            {(['yes_no', 'short_text', 'number', 'select'] as const).map((at) => (
              <button
                key={at}
                type="button"
                role="radio"
                aria-checked={draft.answerType === at}
                onClick={() => patch({ answerType: at, knockout: supportsKnockout(at) ? draft.knockout : false })}
                disabled={pending}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[11.5px] font-semibold transition-colors',
                  draft.answerType === at
                    ? 'border-[oklch(0.55_0.18_250)] bg-[oklch(0.98_0.015_250)] text-[oklch(0.2_0.16_250)]'
                    : 'border-[oklch(0.9_0.01_250)] text-foreground/75 hover:bg-muted/40',
                )}
              >
                {tr(TYPE_LABEL_KEYS[at])}
              </button>
            ))}
          </div>

          {/* Options input — select only */}
          {needsOptions(draft.answerType) && (
            <Input
              value={optionsInput}
              onChange={(e) => setOptionsInput(e.target.value)}
              placeholder={tr('screenQ.optionsPlaceholder')}
              disabled={pending}
              className="text-sm"
              aria-label={tr('screenQ.selectOptionsAria')}
            />
          )}

          {/* Purpose — Informational vs Mandatory (knockout), both visible.
              Reuses the wizard's toggle + passing-condition editor (#N9). */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex rounded-md border border-[oklch(0.9_0.01_250)] p-0.5"
              role="radiogroup"
              aria-label={tr('wizard.questionPurpose')}
            >
              <PurposeButton active={!draft.knockout} onClick={() => patch({ knockout: false })}>
                {tr('screenQ.informational')}
              </PurposeButton>
              <PurposeButton
                active={draft.knockout}
                disabled={!supportsKnockout(draft.answerType)}
                onClick={() => patch({ knockout: true })}
              >
                {tr('screenQ.knockout')}
              </PurposeButton>
            </div>
            {!supportsKnockout(draft.answerType) && (
              <span className="text-[10.5px] text-muted-foreground">{tr('wizard.shortTextNoKnockout')}</span>
            )}
            <Button onClick={handleAdd} disabled={pending || !canAdd} size="sm" className="ml-auto">
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" aria-hidden /> {tr('addCandVac.addBtn')}
                </>
              )}
            </Button>
          </div>

          {knockoutEff && (
            <KnockoutConditionEditor q={draftForEditor} onPatch={patch} />
          )}
        </div>
      )}

      <p className="mt-3 text-[11.5px] text-muted-foreground">
        {tr('screenQ.footer')}
      </p>
    </section>
  )
}
