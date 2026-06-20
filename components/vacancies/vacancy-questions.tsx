'use client'

import { useEffect, useState, useTransition } from 'react'
import { Plus, Trash2, Loader2, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  addVacancyQuestion,
  removeVacancyQuestion,
  toggleVacancyQuestionMustHave,
} from '@/lib/actions/evaluations'

interface Question {
  id: string
  label: string
  type: 'text' | 'score'
  sort_order: number
  /** Wave 2.5 — hard-requirement flag, score-type only. Default false. */
  must_have?: boolean
}

interface VacancyQuestionsProps {
  vacancyId: string
  initialQuestions: Question[]
  questionType: 'text' | 'score'
  canEdit: boolean
}

export function VacancyQuestions({ vacancyId, initialQuestions, questionType, canEdit }: VacancyQuestionsProps) {
  const [questions, setQuestions] = useState(initialQuestions)
  const [label, setLabel] = useState('')
  const [mustHaveDraft, setMustHaveDraft] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-sync when the server prop changes (e.g. after the AI assessment
  // suggester runs router.refresh()). Without this, useState keeps the
  // stale snapshot from first mount and the newly-added question doesn't
  // appear until the recruiter manually reloads.
  useEffect(() => {
    setQuestions(initialQuestions)
  }, [initialQuestions])
  const [isPending, startTransition] = useTransition()

  const placeholder = questionType === 'text'
    ? 'e.g. Describe your approach to problem solving'
    : 'e.g. Communication skills'

  const emptyText = questionType === 'text' ? 'No questionary items yet.' : 'No evaluation criteria yet.'

  const handleAdd = () => {
    if (!label.trim()) { setError('Label is required'); return }
    setError(null)
    const draftLabel = label.trim()
    const draftMustHave = questionType === 'score' && mustHaveDraft
    startTransition(async () => {
      const result = await addVacancyQuestion(vacancyId, label, questionType, draftMustHave)
      if (result.success) {
        setQuestions((prev) => [
          ...prev,
          {
            id: result.data.id,
            label: draftLabel,
            type: questionType,
            sort_order: prev.length,
            must_have: draftMustHave,
          },
        ])
        setLabel('')
        setMustHaveDraft(false)
      } else {
        setError(result.error)
      }
    })
  }

  const handleRemove = (questionId: string) => {
    startTransition(async () => {
      const result = await removeVacancyQuestion(questionId, vacancyId)
      if (result.success) {
        setQuestions((prev) => prev.filter((q) => q.id !== questionId))
      }
    })
  }

  const handleToggleMustHave = (questionId: string, next: boolean) => {
    setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, must_have: next } : q)))
    startTransition(async () => {
      const result = await toggleVacancyQuestionMustHave(questionId, vacancyId, next)
      if (!result.success) {
        setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, must_have: !next } : q)))
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-3">
      {questions.length > 0 ? (
        <div className="space-y-2">
          {questions.map((q) => (
            <div key={q.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 gap-2">
              <span className="truncate text-sm text-foreground">{q.label}</span>
              <div className="flex items-center gap-1 shrink-0">
                {q.type === 'score' && (
                  canEdit ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleMustHave(q.id, !q.must_have)}
                      disabled={isPending}
                      aria-pressed={Boolean(q.must_have)}
                      aria-label={q.must_have ? 'Mark nice-to-have' : 'Mark must-have'}
                      className="h-7 gap-1 px-2 text-[11px] font-bold uppercase"
                      style={
                        q.must_have
                          ? { background: 'oklch(0.96 0.05 27)', color: 'oklch(0.5 0.19 27)' }
                          : { color: 'oklch(0.5 0.02 250)' }
                      }
                    >
                      <Star
                        className="h-3 w-3"
                        fill={q.must_have ? 'oklch(0.5 0.19 27)' : 'none'}
                        aria-hidden
                      />
                      {q.must_have ? 'Must-have' : 'Nice-to-have'}
                    </Button>
                  ) : q.must_have ? (
                    <span
                      className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-bold uppercase"
                      style={{ background: 'oklch(0.96 0.05 27)', color: 'oklch(0.5 0.19 27)' }}
                    >
                      <Star className="h-3 w-3" fill="oklch(0.5 0.19 27)" aria-hidden />
                      Must-have
                    </span>
                  ) : null
                )}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    aria-label="Remove question"
                    onClick={() => handleRemove(q.id)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyText}{canEdit ? ' Add one below.' : ''}</p>
      )}

      {canEdit && (
        <div className="flex gap-2 pt-1">
          <Input
            placeholder={placeholder}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            disabled={isPending}
            maxLength={500}
            className="flex-1 text-sm"
          />
          {questionType === 'score' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMustHaveDraft((v) => !v)}
              aria-pressed={mustHaveDraft}
              className="h-9 gap-1 px-2 text-[11px] font-bold uppercase"
              style={
                mustHaveDraft
                  ? { background: 'oklch(0.96 0.05 27)', color: 'oklch(0.5 0.19 27)' }
                  : { color: 'oklch(0.5 0.02 250)' }
              }
              title={mustHaveDraft ? 'Will be saved as must-have' : 'Will be saved as nice-to-have'}
            >
              <Star
                className="h-3 w-3"
                fill={mustHaveDraft ? 'oklch(0.5 0.19 27)' : 'none'}
                aria-hidden
              />
              {mustHaveDraft ? 'Must-have' : 'Nice-to-have'}
            </Button>
          )}
          <Button onClick={handleAdd} disabled={isPending || !label.trim()} size="sm">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
