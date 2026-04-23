'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, ChevronUp, Loader2, CheckCircle2, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { APPLICATION_STATUS_COLORS } from '@/lib/types/application'
import { saveEvaluation } from '@/lib/actions/evaluations'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

interface Question {
  id: string
  label: string
  type: 'text' | 'score'
}

interface ExistingAnswer {
  question_id: string
  text_value: string | null
  score_value: number | null
}

interface ExistingEvaluation {
  id: string
  score: number | null
  answers: ExistingAnswer[]
}

interface AppStatus {
  name: string
  code: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected' | 'withdrawn'
}

interface ApplicationEvaluationProps {
  applicationId: string
  vacancyId: string
  vacancyTitle: string
  vacancyDepartment: string | null
  candidateId: string
  appliedAt: string
  appStatus: AppStatus | null
  questions: Question[]
  existingEvaluation: ExistingEvaluation | null
}

function isComplete(
  questions: Question[],
  answers: Record<string, { text: string; score: number | null }>,
  overallScore: string
): boolean {
  if (!overallScore) return false
  for (const q of questions) {
    if (q.type === 'text' && !answers[q.id]?.text?.trim()) return false
    if (q.type === 'score' && !answers[q.id]?.score) return false
  }
  return true
}

export function ApplicationEvaluation({
  applicationId,
  vacancyId,
  vacancyTitle,
  vacancyDepartment,
  candidateId,
  appliedAt,
  appStatus,
  questions,
  existingEvaluation,
}: ApplicationEvaluationProps) {
  const [expanded, setExpanded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [overallScore, setOverallScore] = useState(
    existingEvaluation?.score != null ? String(existingEvaluation.score) : ''
  )

  const [answers, setAnswers] = useState<Record<string, { text: string; score: number | null }>>(() => {
    const initial: Record<string, { text: string; score: number | null }> = {}
    for (const q of questions) {
      const existing = existingEvaluation?.answers.find((a) => a.question_id === q.id)
      initial[q.id] = {
        text: existing?.text_value ?? '',
        score: existing?.score_value ?? null,
      }
    }
    return initial
  })

  const complete = isComplete(questions, answers, overallScore)

  const handleSave = () => {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const scoreNum = overallScore ? parseInt(overallScore, 10) : null
      if (scoreNum != null && (scoreNum < 0 || scoreNum > 100)) {
        setError('Overall score must be between 0 and 100')
        return
      }

      const answerPayload = questions.map((q) => ({
        questionId: q.id,
        textValue: q.type === 'text' ? (answers[q.id]?.text || null) : null,
        scoreValue: q.type === 'score' ? (answers[q.id]?.score ?? null) : null,
      }))

      const result = await saveEvaluation({
        applicationId,
        vacancyId,
        candidateId,
        score: scoreNum,
        answers: answerPayload,
      })

      if (result.success) {
        setSaved(true)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header row — always visible */}
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 p-4 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="space-y-1">
          <Link
            href={`/vacancies/${vacancyId}`}
            className="font-medium text-foreground hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {vacancyTitle}
          </Link>
          {vacancyDepartment && (
            <p className="text-sm text-muted-foreground">{vacancyDepartment}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {appStatus && (
            <Badge variant="secondary" className={APPLICATION_STATUS_COLORS[appStatus.code]}>
              {appStatus.name}
            </Badge>
          )}
          {complete ? (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Complete
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
              <Clock className="mr-1 h-3 w-3" />
              Incomplete
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(appliedAt), { addSuffix: true })}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expandable evaluation form */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-4 space-y-4">
          {questions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No evaluation questions configured for this vacancy.{' '}
              <Link href={`/vacancies/${vacancyId}`} className="underline hover:no-underline">
                Add questions
              </Link>
            </p>
          )}

          {questions.map((q) => (
            <div key={q.id} className="space-y-2">
              <Label className="text-sm font-medium">{q.label}</Label>
              {q.type === 'text' ? (
                <Textarea
                  rows={3}
                  placeholder="Enter your answer..."
                  value={answers[q.id]?.text ?? ''}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [q.id]: { ...prev[q.id], text: e.target.value },
                    }))
                  }
                />
              ) : (
                <div className="flex gap-1 flex-wrap">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          [q.id]: { ...prev[q.id], score: answers[q.id]?.score === n ? null : n },
                        }))
                      }
                      className={`h-8 w-8 rounded-md text-sm font-medium border transition-colors ${
                        answers[q.id]?.score === n
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border bg-background text-foreground hover:bg-muted'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Overall Score (0 – 100)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              placeholder="e.g. 75"
              value={overallScore}
              onChange={(e) => setOverallScore(e.target.value)}
              className="w-32"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && <p className="text-sm text-green-600">Saved successfully.</p>}

          <Button onClick={handleSave} disabled={isPending} size="sm">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Evaluation'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
