'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, Loader2, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  bulkCreateScreeningQuestions,
  deleteScreeningQuestion,
} from '@/lib/actions/screening-questions'

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

const TYPE_LABELS: Record<AnswerType, string> = {
  yes_no: 'Yes / No',
  short_text: 'Short text',
  number: 'Number',
  select: 'Select',
}

const supportsKnockout = (t: AnswerType) => t === 'yes_no' || t === 'select'
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
  const [questions, setQuestions] = useState(initialQuestions)
  const [label, setLabel] = useState('')
  const [answerType, setAnswerType] = useState<AnswerType>('yes_no')
  const [knockout, setKnockout] = useState(false)
  const [optionsInput, setOptionsInput] = useState('')
  const [pending, startTransition] = useTransition()

  const parsedOptions = optionsInput
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0)

  const handleAdd = () => {
    const trimmed = label.trim()
    if (!trimmed) return
    if (needsOptions(answerType) && parsedOptions.length === 0) return
    const knockoutEff = supportsKnockout(answerType) ? knockout : false

    startTransition(async () => {
      const result = await bulkCreateScreeningQuestions(vacancyId, [
        {
          label: trimmed,
          answerType,
          knockout: knockoutEff,
          options: needsOptions(answerType) ? parsedOptions : undefined,
        },
      ])
      if (!result.success) {
        toast.error(result.error)
        return
      }
      // Optimistic insert with a synthetic id; the next revalidate
      // replaces it with the server row.
      setQuestions((prev) => [
        ...prev,
        {
          id: `optimistic-${prev.length}-${Date.now()}`,
          label: trimmed,
          answer_type: answerType,
          is_knockout: knockoutEff,
          knockout_answer: !knockoutEff
            ? null
            : answerType === 'yes_no'
              ? 'yes'
              : answerType === 'select'
                ? parsedOptions[0] ?? null
                : null,
          options: needsOptions(answerType) ? parsedOptions : null,
          sort_order: (prev[prev.length - 1]?.sort_order ?? -1) + 1,
        },
      ])
      setLabel('')
      setAnswerType('yes_no')
      setKnockout(false)
      setOptionsInput('')
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
      aria-label="Screening questions"
    >
      <header className="mb-1 flex items-center gap-2">
        <h2 className="text-[15px] font-bold text-foreground">Screening questions</h2>
        <span className="rounded bg-[oklch(0.93_0.07_155)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[oklch(0.36_0.14_150)]">
          NEW
        </span>
      </header>
      <p className="mb-3 text-[12.5px] text-muted-foreground">
        Asked on the public apply form. Knockout answers flag the application internally — they
        don&apos;t block the candidate from submitting.
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
                    {TYPE_LABELS[q.answer_type]}
                  </span>
                </div>
                <p
                  className="mt-1 text-[11px] font-semibold"
                  style={{ color: q.is_knockout ? 'oklch(0.5 0.19 27)' : 'oklch(0.5 0.02 250)' }}
                >
                  {q.is_knockout ? (
                    <span className="inline-flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" aria-hidden />
                      Knockout · must = {q.knockout_answer ?? '—'}
                    </span>
                  ) : (
                    'Informational'
                  )}
                </p>
                {q.answer_type === 'select' && q.options && q.options.length > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Options: {q.options.join(' · ')}
                  </p>
                )}
              </div>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${q.label}`}
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
          No screening questions yet.
          {canEdit ? ' Add one below to surface it on the apply form.' : ''}
        </p>
      )}

      {canEdit && (
        <div className="mt-3 flex flex-col gap-2 rounded-[9px] border border-dashed border-[oklch(0.88_0.01_250)] p-2.5">
          <Input
            placeholder="e.g. Eligible to work here?"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !needsOptions(answerType)) {
                e.preventDefault()
                handleAdd()
              }
            }}
            disabled={pending}
            maxLength={500}
            className="text-sm"
          />

          {/* Type picker */}
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Answer type">
            {(['yes_no', 'short_text', 'number', 'select'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={answerType === t}
                onClick={() => {
                  setAnswerType(t)
                  if (!supportsKnockout(t)) setKnockout(false)
                }}
                disabled={pending}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[11.5px] font-semibold transition-colors',
                  answerType === t
                    ? 'border-[oklch(0.55_0.18_250)] bg-[oklch(0.98_0.015_250)] text-[oklch(0.2_0.16_250)]'
                    : 'border-[oklch(0.9_0.01_250)] text-foreground/75 hover:bg-muted/40',
                )}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Options input — select only */}
          {needsOptions(answerType) && (
            <Input
              value={optionsInput}
              onChange={(e) => setOptionsInput(e.target.value)}
              placeholder="Options, comma-separated — e.g. Citizen, Permanent Resident, Visa needed"
              disabled={pending}
              className="text-sm"
              aria-label="Select options"
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setKnockout((v) => !v)}
              disabled={pending || !supportsKnockout(answerType)}
              aria-pressed={knockout}
              className={cn(
                'rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                knockout
                  ? 'border-[oklch(0.86_0.05_27)] bg-[oklch(0.96_0.05_27)] text-[oklch(0.5_0.19_27)]'
                  : 'border-[oklch(0.9_0.01_250)] text-foreground/70',
              )}
              title={
                supportsKnockout(answerType)
                  ? knockout
                    ? 'Will auto-flag if answer is wrong'
                    : 'Informational only'
                  : 'Knockout only applies to Yes/No and Select'
              }
            >
              {knockout ? 'Knockout' : 'Informational'}
            </button>
            <Button
              onClick={handleAdd}
              disabled={
                pending ||
                !label.trim() ||
                (needsOptions(answerType) && parsedOptions.length === 0)
              }
              size="sm"
              className="ml-auto"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Add
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <p className="mt-3 text-[11.5px] text-muted-foreground">
        Answers feed into the candidate profile as screening flags; knockout wrong-answers light up
        the screening gate before the recruiter advances the candidate.
      </p>
    </section>
  )
}
