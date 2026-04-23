'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, ChevronUp, Loader2, CheckCircle2, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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

function calcScore(
  questions: Question[],
  answers: Record<string, { text: string; score: number | null }>
): number | null {
  const scoreQs = questions.filter((q) => q.type === 'score')
  if (scoreQs.length === 0) return null
  if (scoreQs.some((q) => !answers[q.id]?.score)) return null
  const sum = scoreQs.reduce((acc, q) => acc + (answers[q.id]?.score ?? 0), 0)
  return Math.round((sum / (scoreQs.length * 10)) * 100)
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

  const calculatedScore = calcScore(questions, answers)

  const handleSave = () => {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const answerPayload = questions.map((q) => ({
        questionId: q.id,
        textValue: q.type === 'text' ? (answers[q.id]?.text || null) : null,
        scoreValue: q.type === 'score' ? (answers[q.id]?.score ?? null) : null,
      }))

      const result = await saveEvaluation({
        applicationId,
        vacancyId,
        candidateId,
        score: calculatedScore,
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
          {calculatedScore !== null ? (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              {calculatedScore}%
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

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
            <span className="text-sm font-medium">Overall Score</span>
            {calculatedScore !== null ? (
              <Badge variant="secondary" className="text-sm font-semibold">
                {calculatedScore}%
              </Badge>
            ) : (
              <span className="text-sm text-muted-foreground">
                {questions.some((q) => q.type === 'score') ? 'Fill all score criteria' : 'No score criteria'}
              </span>
            )}
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
