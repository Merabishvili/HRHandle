'use client'

import { useState, useTransition } from 'react'
import { Loader2, Plus, Trash2, AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  bulkCreateScreeningQuestions,
  deleteScreeningQuestion,
} from '@/lib/actions/screening-questions'

export interface ScreeningQuestionItem {
  id: string
  label: string
  answer_type: 'yes_no' | 'short_text' | 'number' | 'select'
  is_knockout: boolean
  knockout_answer: string | null
  sort_order: number
}

interface ScreeningQuestionsCardProps {
  vacancyId: string
  initialQuestions: ScreeningQuestionItem[]
  canEdit: boolean
}

/**
 * Wave 2.5 Slice 2a — Recruiter-side screening questions card on the
 * vacancy detail Scorecard tab. Lists the questions that will appear on
 * the public apply form once Slice 2b ships the form integration.
 *
 * For now the wizard captures `yes_no` rows only — recruiters can add
 * more from this card with the same shape, and toggle knockout. Other
 * answer types (`short_text`, `number`, `select`) round-trip read-only
 * if they came from elsewhere (e.g. a future Slice 2b form).
 */
export function ScreeningQuestionsCard({
  vacancyId,
  initialQuestions,
  canEdit,
}: ScreeningQuestionsCardProps) {
  const [questions, setQuestions] = useState(initialQuestions)
  const [label, setLabel] = useState('')
  const [knockout, setKnockout] = useState(false)
  const [pending, startTransition] = useTransition()

  const handleAdd = () => {
    const trimmed = label.trim()
    if (!trimmed) return
    startTransition(async () => {
      const result = await bulkCreateScreeningQuestions(vacancyId, [
        { label: trimmed, knockout },
      ])
      if (!result.success) {
        toast.error(result.error)
        return
      }
      // Optimistic insert with a synthetic sort_order; the server-side
      // row gets the real id on the next page revalidate.
      setQuestions((prev) => [
        ...prev,
        {
          id: `optimistic-${prev.length}-${Date.now()}`,
          label: trimmed,
          answer_type: 'yes_no',
          is_knockout: knockout,
          knockout_answer: knockout ? 'yes' : null,
          sort_order: (prev[prev.length - 1]?.sort_order ?? -1) + 1,
        },
      ])
      setLabel('')
      setKnockout(false)
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
                <p className="text-[12.5px] font-medium text-foreground">{q.label}</p>
                <p className="mt-1 text-[11px] font-semibold" style={{ color: q.is_knockout ? 'oklch(0.5 0.19 27)' : 'oklch(0.5 0.02 250)' }}>
                  {q.is_knockout ? (
                    <span className="inline-flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" aria-hidden />
                      Knockout · must = {q.knockout_answer ?? 'yes'}
                    </span>
                  ) : (
                    'Informational'
                  )}
                  <span className="ml-2 text-[10.5px] font-normal uppercase text-muted-foreground">
                    {q.answer_type.replace('_', ' ')}
                  </span>
                </p>
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
          {canEdit ? ' Add one below to surface it on the apply form (ships with Slice 2b).' : ''}
        </p>
      )}

      {canEdit && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            placeholder="e.g. Eligible to work here?"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAdd()
              }
            }}
            disabled={pending}
            maxLength={500}
            className="flex-1 text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setKnockout((v) => !v)}
            aria-pressed={knockout}
            className="h-9 gap-1 px-2 text-[11px] font-bold uppercase"
            style={knockout
              ? { background: 'oklch(0.96 0.05 27)', color: 'oklch(0.5 0.19 27)' }
              : { color: 'oklch(0.5 0.02 250)' }
            }
            title={knockout ? 'Will be saved as knockout · must = Yes' : 'Will be saved as informational'}
          >
            {knockout ? 'Knockout' : 'Informational'}
          </Button>
          <Button onClick={handleAdd} disabled={pending || !label.trim()} size="sm">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      )}

      <p className="mt-3 text-[11.5px] text-muted-foreground">
        Slice 2b adds these to the candidate-facing apply form and writes the answers back into the
        pipeline as flags.
      </p>
    </section>
  )
}
