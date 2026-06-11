'use client'

import { useState, useTransition } from 'react'
import { ChevronRight, Loader2, CheckCircle2, Clock, Trash2, Link as LinkIcon, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { APPLICATION_STATUS_COLORS } from '@/lib/types/application'
import { saveEvaluation } from '@/lib/actions/evaluations'
import { updateApplicationStatus, removeApplication } from '@/lib/actions/applications'
import { RejectionDialog, type RejectionReason, type RejectionTemplate } from '@/components/pipeline/rejection-dialog'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { PipelineMiniBar } from '@/components/candidates/pipeline-mini-bar'

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

import type { ApplicationStatusOption as AppStatus } from '@/lib/types/database'

interface ApplicationEvaluationProps {
  applicationId: string
  vacancyId: string
  vacancyTitle: string
  vacancyDepartment: string | null
  candidateId: string
  candidateName: string
  appliedAt: string
  appStatus: AppStatus | null
  allStatuses: AppStatus[]
  rejectionReasons: RejectionReason[]
  rejectionTemplates: RejectionTemplate[]
  questions: Question[]
  existingEvaluation: ExistingEvaluation | null
  /** Public candidate-facing status page token (G-016). Null for very old rows
   * pre-migration 033 — the Copy-link button hides in that case. */
  publicToken: string | null
  onRemoved?: (applicationId: string) => void
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
  candidateName,
  appliedAt,
  appStatus: initialAppStatus,
  allStatuses,
  rejectionReasons,
  rejectionTemplates,
  questions,
  existingEvaluation,
  publicToken,
  onRemoved,
}: ApplicationEvaluationProps) {
  const [expanded, setExpanded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [statusLinkCopied, setStatusLinkCopied] = useState(false)

  const copyStatusLink = async () => {
    if (!publicToken) return
    const url = `${window.location.origin}/status/${publicToken}`
    try {
      await navigator.clipboard.writeText(url)
      setStatusLinkCopied(true)
      setTimeout(() => setStatusLinkCopied(false), 1500)
    } catch (err) {
      console.error('[application-evaluation] clipboard write failed:', err)
    }
  }
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appStatus, setAppStatus] = useState<AppStatus | null>(initialAppStatus)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pendingRejectionStatusId, setPendingRejectionStatusId] = useState<string | null>(null)

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

  const handleStatusChange = (newStatusId: string) => {
    const newStatus = allStatuses.find((s) => s.id === newStatusId) ?? null
    if (newStatus?.code === 'rejected') {
      setPendingRejectionStatusId(newStatusId)
      return
    }
    setAppStatus(newStatus)
    startTransition(async () => {
      const result = await updateApplicationStatus(applicationId, newStatusId)
      if (!result.success) setAppStatus(initialAppStatus)
    })
  }

  const handleRejectionSuccess = () => {
    if (pendingRejectionStatusId) {
      setAppStatus(allStatuses.find((s) => s.id === pendingRejectionStatusId) ?? null)
    }
    setPendingRejectionStatusId(null)
  }

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeApplication(applicationId)
      if (result.success) onRemoved?.(applicationId)
    })
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-card">
        {/* Header row — always visible */}
        <div className="flex w-full items-start justify-between gap-4 p-4">
          <button
            type="button"
            className="flex-1 flex items-center gap-3 text-left min-w-0"
            onClick={() => setExpanded((v) => !v)}
          >
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
            />
            <div className="min-w-0 space-y-0.5">
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
          </button>

          <div className="flex shrink-0 items-center gap-2">
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
          </div>

          {/* Actions: status selector + remove */}
          <div className="flex items-center gap-1 shrink-0 -mt-0.5">
            <Select
              value={appStatus?.id ?? ''}
              onValueChange={handleStatusChange}
              disabled={isPending}
            >
              <SelectTrigger className="h-7 w-auto min-w-[110px] text-xs border-0 bg-transparent focus:ring-0 px-2">
                <SelectValue>
                  {appStatus ? (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${(APPLICATION_STATUS_COLORS as Record<string, string>)[appStatus.code]}`}>
                      {appStatus.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">No status</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {allStatuses.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${(APPLICATION_STATUS_COLORS as Record<string, string>)[s.code]}`}>
                      {s.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {publicToken && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                onClick={copyStatusLink}
                disabled={isPending}
                title="Copy candidate status page link"
                aria-label="Copy candidate status page link"
              >
                {statusLinkCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <LinkIcon className="h-3.5 w-3.5" />}
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Pipeline mini bar */}
        <div className="px-4 pb-3">
          <PipelineMiniBar currentStageCode={appStatus?.code ?? null} />
        </div>

        {/* Expandable evaluation form */}
        {expanded && (
          <div className="border-t border-border px-4 pb-4 pt-4 space-y-4">
            {questions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No evaluation questions configured for this vacancy.{' '}
                <Link href={`/vacancies/${vacancyId}?tab=qe`} className="underline hover:no-underline">
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
                'Save Changes'
              )}
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this vacancy application?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the application for <strong>{vacancyTitle}</strong>. The candidate profile will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRemove}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pendingRejectionStatusId && (
        <RejectionDialog
          open={!!pendingRejectionStatusId}
          applicationId={applicationId}
          statusId={pendingRejectionStatusId}
          candidateName={candidateName}
          reasons={rejectionReasons}
          templates={rejectionTemplates}
          onSuccess={handleRejectionSuccess}
          onCancel={() => setPendingRejectionStatusId(null)}
        />
      )}
    </>
  )
}
