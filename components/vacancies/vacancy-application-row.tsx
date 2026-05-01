'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Trash2, Loader2, ChevronRight, CheckCircle2, Clock } from 'lucide-react'
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
import { updateApplicationStatus, removeApplication } from '@/lib/actions/applications'
import { saveEvaluation } from '@/lib/actions/evaluations'
import { RejectionDialog, type RejectionReason, type RejectionTemplate } from '@/components/pipeline/rejection-dialog'

interface AppStatus {
  id: string
  name: string
  code: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected' | 'withdrawn'
}

interface GeneralStatus {
  id: string
  name: string
  code: 'active' | 'hired' | 'archived'
}

interface Question {
  id: string
  label: string
  type: 'text' | 'score'
}

interface ExistingEvaluation {
  id: string
  score: number | null
  answers: { question_id: string; text_value: string | null; score_value: number | null }[]
}

interface Props {
  applicationId: string
  candidateId: string
  candidateName: string
  initials: string
  appliedAt: string
  currentStatusId: string | null
  generalStatus: GeneralStatus | null
  allStatuses: AppStatus[]
  rejectionReasons: RejectionReason[]
  rejectionTemplates: RejectionTemplate[]
  vacancyId: string
  questions: Question[]
  existingEvaluation: ExistingEvaluation | null
  onRemoved: (applicationId: string) => void
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

export function VacancyApplicationRow({
  applicationId,
  candidateId,
  candidateName,
  initials,
  appliedAt,
  currentStatusId,
  generalStatus,
  allStatuses,
  rejectionReasons,
  rejectionTemplates,
  vacancyId,
  questions,
  existingEvaluation,
  onRemoved,
}: Props) {
  const [statusId, setStatusId] = useState<string>(currentStatusId ?? '')
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pendingRejectionStatusId, setPendingRejectionStatusId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Evaluation state
  const [answers, setAnswers] = useState<Record<string, { text: string; score: number | null }>>(() => {
    const init: Record<string, { text: string; score: number | null }> = {}
    for (const q of questions) {
      const existing = existingEvaluation?.answers.find((a) => a.question_id === q.id)
      init[q.id] = { text: existing?.text_value ?? '', score: existing?.score_value ?? null }
    }
    return init
  })
  const [evalSaved, setEvalSaved] = useState(false)
  const [evalError, setEvalError] = useState<string | null>(null)

  const currentStatus = allStatuses.find((s) => s.id === statusId)
  const calculatedScore = calcScore(questions, answers)

  const handleStatusChange = (newStatusId: string) => {
    if (newStatusId === statusId) return
    const newStatus = allStatuses.find((s) => s.id === newStatusId)
    if (newStatus?.code === 'rejected') {
      setPendingRejectionStatusId(newStatusId)
      return
    }
    setStatusId(newStatusId)
    startTransition(async () => {
      const result = await updateApplicationStatus(applicationId, newStatusId)
      if (!result.success) setStatusId(currentStatusId ?? '')
    })
  }

  const handleRejectionSuccess = () => {
    if (pendingRejectionStatusId) setStatusId(pendingRejectionStatusId)
    setPendingRejectionStatusId(null)
  }

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeApplication(applicationId)
      if (result.success) onRemoved(applicationId)
    })
  }

  const handleSaveEvaluation = () => {
    setEvalError(null)
    setEvalSaved(false)
    startTransition(async () => {
      const result = await saveEvaluation({
        applicationId,
        vacancyId,
        candidateId,
        score: calculatedScore,
        answers: questions.map((q) => ({
          questionId: q.id,
          textValue: q.type === 'text' ? (answers[q.id]?.text || null) : null,
          scoreValue: q.type === 'score' ? (answers[q.id]?.score ?? null) : null,
        })),
      })
      if (result.success) {
        setEvalSaved(true)
        setTimeout(() => setEvalSaved(false), 3000)
      } else {
        setEvalError(result.error)
      }
    })
  }

  return (
    <>
      <div>
        {/* Main row */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/50">
          {/* Expand toggle + candidate info */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              title={expanded ? 'Collapse' : 'Assessment & Questionary'}
            >
              <ChevronRight
                className={`h-4 w-4 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
              />
            </button>
            <Link href={`/candidates/${candidateId}`} className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <span className="text-xs font-medium text-primary">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{candidateName}</p>
                <p className="text-xs text-muted-foreground">
                  Applied {formatDistanceToNow(new Date(appliedAt), { addSuffix: true })}
                </p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Score badge */}
            {calculatedScore !== null ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {calculatedScore}%
              </Badge>
            ) : questions.some((q) => q.type === 'score') ? (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                <Clock className="mr-1 h-3 w-3" />
                Incomplete
              </Badge>
            ) : null}

            {/* Status selector */}
            <Select value={statusId} onValueChange={handleStatusChange} disabled={isPending}>
              <SelectTrigger className="h-7 w-auto min-w-[110px] text-xs border-0 bg-transparent focus:ring-0 px-2">
                <SelectValue>
                  {currentStatus ? (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${(APPLICATION_STATUS_COLORS as Record<string, string>)[currentStatus.code]}`}>
                      {currentStatus.name}
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

            {/* Remove button */}
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

        {/* Expanded evaluation form */}
        {expanded && (
          <div className="border-t border-border bg-muted/20 px-6 py-4 space-y-4">
            {questions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No assessment questions configured for this vacancy.{' '}
                <Link href={`/vacancies/${vacancyId}?tab=qe`} className="underline hover:no-underline">
                  Add questions
                </Link>
              </p>
            ) : (
              <>
                {questions.map((q) => (
                  <div key={q.id} className="space-y-2">
                    <Label className="text-sm font-medium">{q.label}</Label>
                    {q.type === 'text' ? (
                      <Textarea
                        rows={3}
                        placeholder="Enter answer…"
                        value={answers[q.id]?.text ?? ''}
                        onChange={(e) =>
                          setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id], text: e.target.value } }))
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

                <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                  <span className="text-sm font-medium">Overall Score</span>
                  {calculatedScore !== null ? (
                    <Badge variant="secondary" className="font-semibold">{calculatedScore}%</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {questions.some((q) => q.type === 'score') ? 'Fill all score criteria' : 'No score criteria'}
                    </span>
                  )}
                </div>

                {evalError && <p className="text-sm text-destructive">{evalError}</p>}
                {evalSaved && <p className="text-sm text-green-600">Saved successfully.</p>}

                <Button size="sm" onClick={handleSaveEvaluation} disabled={isPending}>
                  {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                  Save Changes
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Rejection dialog */}
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

      {/* Remove confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove candidate from vacancy?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{candidateName}</strong> from this vacancy. The candidate profile will not be deleted.
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
    </>
  )
}
