'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
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
  canEdit: boolean
}

export function VacancyQuestions({ vacancyId, initialQuestions, canEdit }: VacancyQuestionsProps) {
  const [questions, setQuestions] = useState(initialQuestions)
  const [label, setLabel] = useState('')
  const [type, setType] = useState<'text' | 'score'>('text')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleAdd = () => {
    if (!label.trim()) { setError('Question label is required'); return }
    setError(null)
    startTransition(async () => {
      const result = await addVacancyQuestion(vacancyId, label, type)
      if (result.success) {
        setQuestions((prev) => [
          ...prev,
          { id: result.data.id, label: label.trim(), type, sort_order: prev.length },
        ])
        setLabel('')
        setType('text')
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
    <div className="space-y-4">
      {questions.length > 0 ? (
        <div className="space-y-2">
          {questions.map((q) => (
            <div key={q.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {q.type === 'score' ? 'Score 1-10' : 'Text'}
                </Badge>
                <span className="truncate text-sm text-foreground">{q.label}</span>
              </div>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(q.id)}
                  disabled={isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No evaluation questions yet.{canEdit ? ' Add one below.' : ''}
        </p>
      )}

      {canEdit && (
        <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
          <Label className="text-sm font-medium">Add Question</Label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. How would you rate communication skills?"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              disabled={isPending}
              className="flex-1"
            />
            <Select value={type} onValueChange={(v) => setType(v as 'text' | 'score')} disabled={isPending}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="score">Score 1-10</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={isPending || !label.trim()} size="sm">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </div>
  )
}
