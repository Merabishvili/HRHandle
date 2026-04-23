'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addVacancyQuestion, removeVacancyQuestion } from '@/lib/actions/evaluations'

interface Question {
  id: string
  label: string
  type: 'text' | 'score'
  sort_order: number
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
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const placeholder = questionType === 'text'
    ? 'e.g. Describe your approach to problem solving'
    : 'e.g. Communication skills'

  const emptyText = questionType === 'text' ? 'No questionary items yet.' : 'No evaluation criteria yet.'

  const handleAdd = () => {
    if (!label.trim()) { setError('Label is required'); return }
    setError(null)
    startTransition(async () => {
      const result = await addVacancyQuestion(vacancyId, label, questionType)
      if (result.success) {
        setQuestions((prev) => [
          ...prev,
          { id: result.data.id, label: label.trim(), type: questionType, sort_order: prev.length },
        ])
        setLabel('')
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

  return (
    <div className="space-y-3">
      {questions.length > 0 ? (
        <div className="space-y-2">
          {questions.map((q) => (
            <div key={q.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 gap-2">
              <span className="truncate text-sm text-foreground">{q.label}</span>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(q.id)}
                  disabled={isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
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
            className="flex-1 text-sm"
          />
          <Button onClick={handleAdd} disabled={isPending || !label.trim()} size="sm">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
