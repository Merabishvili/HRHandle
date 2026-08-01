'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import {
  X,
  ChevronLeft,
  ChevronRight,
  XCircle,
  SkipForward,
  CalendarPlus,
  ArrowRight,
  FileText,
  ExternalLink,
  Sparkles,
  Loader2,
  CheckCircle2,
  CalendarCheck,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { InterviewForm } from '@/components/interviews/interview-form'
import { toDisplayName } from '@/lib/format-name'
import { getDocumentSignedUrl } from '@/lib/actions/documents'
import {
  getReviewCandidateDetail,
  getInterviewFormData,
  type ReviewCandidateDetail,
  type InterviewFormData,
} from '@/lib/actions/review-mode'
import type { ApplicationStatus } from '@/lib/types/application'
import type { CrossVacancyApplication } from './cross-vacancy-board'

interface ReviewModeProps {
  queue: CrossVacancyApplication[]
  /** Active (non-terminal) stages in sort order — drives the dynamic
   * "Advance to {next stage}" label. */
  activeStatuses: ApplicationStatus[]
  onClose: () => void
  /** Move candidate to the next active stage. The board owns the resulting
   * status update + optimistic re-render (which shrinks the queue). */
  onAdvance: (applicationId: string) => Promise<void> | void
  /** Open the board's rejection dialog for this candidate. */
  onReject: (applicationId: string) => void
}

type SummaryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; text: string }
  | { status: 'too_thin' }
  | { status: 'rate_limited' }
  | { status: 'no_key' }
  | { status: 'error' }

/** Deterministic avatar tint per first letter — stable variation for scanning,
 * matching the kanban card treatment. */
const AVATAR_HUES = [
  { bg: 'oklch(0.93 0.07 155)', text: 'oklch(0.38 0.14 150)' },
  { bg: 'oklch(0.93 0.04 250)', text: 'oklch(0.45 0.16 250)' },
  { bg: 'oklch(0.95 0.06 95)', text: 'oklch(0.45 0.1 80)' },
  { bg: 'oklch(0.93 0.06 300)', text: 'oklch(0.45 0.15 300)' },
  { bg: 'oklch(0.94 0.05 210)', text: 'oklch(0.42 0.12 210)' },
]
function avatarStyle(seed: string): { background: string; color: string } {
  const hue = AVATAR_HUES[(seed.charCodeAt(0) || 0) % AVATAR_HUES.length]!
  return { background: hue.bg, color: hue.text }
}

/**
 * Pipeline Quick Review Mode — full-bleed triage per `Review Mode Fixed.dc.html`.
 *
 * A dark backdrop with prev/next chevrons flanking a single rich candidate
 * card: header + tags, a CV summary (generated on demand), a CV preview + a
 * salary/notice/source fact column, and four keyboard-driven actions —
 * Reject (R) · Skip (K) · Schedule (S) · Advance (A). Advance/Reject shrink the
 * "new" queue (the board owns those writes); Skip just moves on; Schedule opens
 * the interview form in an overlay and returns here without auto-advancing.
 *
 *   ← / →  navigate · A advance · R reject · K skip · S schedule · Esc exit
 *
 * The Fit-analysis line from the design is intentionally omitted until the AI
 * Fit Analysis feature (redesign S11) ships — the spec calls for hiding it when
 * there's no scorecard breakdown to show.
 */
export function ReviewMode({ queue, activeStatuses, onClose, onAdvance, onReject }: ReviewModeProps) {
  const t = useTranslations()
  const [index, setIndex] = useState(0)
  const [pending, setPending] = useState(false)

  const [detailByCandidate, setDetailByCandidate] = useState<
    Record<string, ReviewCandidateDetail | 'loading' | 'error'>
  >({})
  const [summaryByCandidate, setSummaryByCandidate] = useState<Record<string, SummaryState>>({})
  const [scheduledIds, setScheduledIds] = useState<Set<string>>(new Set())

  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleData, setScheduleData] = useState<InterviewFormData | null>(null)
  const [scheduleLoading, setScheduleLoading] = useState(false)

  // Clamp the cursor when the queue shrinks (candidate advanced / rejected).
  useEffect(() => {
    if (index >= queue.length) setIndex(Math.max(0, queue.length - 1))
  }, [queue.length, index])

  const current = queue[index] ?? null

  // Lazily fetch the richer per-candidate detail (location / languages / CV /
  // salary / notice) as the recruiter lands on each candidate.
  useEffect(() => {
    const candidateId = current?.candidate_id
    if (!candidateId || detailByCandidate[candidateId]) return
    setDetailByCandidate((prev) => ({ ...prev, [candidateId]: 'loading' }))
    getReviewCandidateDetail(candidateId).then((res) => {
      setDetailByCandidate((prev) => ({
        ...prev,
        [candidateId]: res.success ? res.data : 'error',
      }))
    })
  }, [current?.candidate_id, detailByCandidate])

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(i + 1, Math.max(0, queue.length - 1)))
  }, [queue.length])
  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  const advance = useCallback(async () => {
    if (!current || pending) return
    setPending(true)
    try {
      await onAdvance(current.id)
    } finally {
      setPending(false)
    }
  }, [current, pending, onAdvance])

  const reject = useCallback(() => {
    if (!current || pending) return
    onReject(current.id)
  }, [current, pending, onReject])

  const openSchedule = useCallback(async () => {
    if (!current) return
    setScheduleOpen(true)
    if (!scheduleData) {
      setScheduleLoading(true)
      const res = await getInterviewFormData()
      setScheduleLoading(false)
      if (res.success) {
        setScheduleData(res.data)
      } else {
        toast.error(t('review.schedulerFailed'))
        setScheduleOpen(false)
      }
    }
  }, [current, scheduleData, t])

  const generateSummary = useCallback(async (candidateId: string) => {
    setSummaryByCandidate((prev) => ({ ...prev, [candidateId]: { status: 'loading' } }))
    try {
      const res = await fetch('/api/ai/candidate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId }),
      })
      const body = await res.json()
      if (body.ok && typeof body.summary === 'string') {
        setSummaryByCandidate((prev) => ({ ...prev, [candidateId]: { status: 'ok', text: body.summary } }))
        return
      }
      const reason = body?.reason
      const status: 'too_thin' | 'rate_limited' | 'no_key' | 'error' =
        reason === 'too_thin' || reason === 'rate_limited' || reason === 'no_key' ? reason : 'error'
      setSummaryByCandidate((prev) => ({ ...prev, [candidateId]: { status } }))
    } catch (err) {
      console.error('[review-mode] summary request failed:', err)
      setSummaryByCandidate((prev) => ({ ...prev, [candidateId]: { status: 'error' } }))
    }
  }, [])

  const openCv = useCallback(async (documentId: string) => {
    const res = await getDocumentSignedUrl(documentId)
    if (res.success) window.open(res.data.url, '_blank', 'noopener,noreferrer')
    else toast.error(t('review.cvOpenFailed'))
  }, [t])

  // Dynamic Advance label — the next active stage after the current one.
  const nextStage = useMemo(() => {
    if (!current) return null
    const sorted = [...activeStatuses].sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex((s) => s.id === current.status_id)
    return idx >= 0 ? sorted[idx + 1] ?? null : null
  }, [current, activeStatuses])

  // Keyboard shortcuts. Suspended while the Schedule overlay is open (its own
  // inputs + Radix Dialog own the keyboard then).
  useEffect(() => {
    if (scheduleOpen) return
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return
      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'ArrowLeft':
          e.preventDefault()
          goPrev()
          break
        case 'ArrowRight':
          e.preventDefault()
          goNext()
          break
        case 'a':
        case 'A':
          e.preventDefault()
          void advance()
          break
        case 'r':
        case 'R':
          e.preventDefault()
          reject()
          break
        case 'k':
        case 'K':
          e.preventDefault()
          goNext()
          break
        case 's':
        case 'S':
          e.preventDefault()
          void openSchedule()
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [scheduleOpen, onClose, goPrev, goNext, advance, reject, openSchedule])

  const detail = current ? detailByCandidate[current.candidate_id] : undefined
  const detailData = detail && detail !== 'loading' && detail !== 'error' ? detail : null
  const summary = current ? summaryByCandidate[current.candidate_id] ?? { status: 'idle' } : { status: 'idle' as const }
  const isScheduled = current ? scheduledIds.has(current.id) : false

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review mode"
      className="fixed inset-0 z-50 flex flex-col bg-[oklch(0.22_0.02_250)]"
    >
      {/* Top bar */}
      <header className="flex flex-shrink-0 items-center gap-3 px-5 py-4 text-[oklch(0.85_0.01_250)] sm:px-7">
        <span className="rounded-md bg-[oklch(0.3_0.04_250)] px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-[0.04em] text-[oklch(0.75_0.12_250)]">
          {t('review.badge')}
        </span>
        {queue.length > 0 && (
          <span className="text-[13px] text-[oklch(0.65_0.01_250)]">
            {t('review.progress', { index: index + 1, total: queue.length })}
          </span>
        )}
        <div className="ml-auto flex items-center gap-4">
          <span className="hidden text-[12.5px] text-[oklch(0.55_0.01_250)] lg:inline">
            {t('review.shortcuts')}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('review.exit')}
            className="text-[oklch(0.7_0.01_250)] transition-colors hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </header>

      {current ? (
        <>
          {/* Card row with flanking chevrons */}
          <div className="flex min-h-0 flex-1 items-center justify-center gap-3 px-3 pb-4 sm:gap-5 sm:px-7">
            <ChevronButton
              direction="prev"
              onClick={goPrev}
              disabled={index === 0}
            />

            <article className="flex max-h-full w-full max-w-[860px] flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-[0_20px_40px_-10px_oklch(0_0_0/0.4)] sm:p-7">
              {/* Header */}
              <div className="flex items-center gap-3.5">
                <span
                  className="flex shrink-0 items-center justify-center rounded-full text-[18px] font-bold"
                  style={{ ...avatarStyle(current.first_name), height: 52, width: 52 }}
                >
                  {`${current.first_name[0] ?? ''}${current.last_name[0] ?? ''}`.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-bold text-[oklch(0.15_0.02_250)]">
                    {toDisplayName(current.first_name)} {toDisplayName(current.last_name)}
                    {isScheduled && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-[oklch(0.93_0.06_155)] px-2 py-0.5 align-middle text-[11px] font-bold text-[oklch(0.4_0.13_150)]">
                        <CalendarCheck className="h-3 w-3" aria-hidden />
                        {t('review.interviewScheduled')}
                      </span>
                    )}
                  </h2>
                  <p className="mt-0.5 truncate text-[13px] text-[oklch(0.5_0.02_250)]">
                    {t('review.appliedTo')}{' '}
                    <strong className="text-[oklch(0.35_0.02_250)]">{current.vacancy_title}</strong>
                    {' · '}
                    {format(new Date(current.applied_at), 'MMM d, yyyy')}
                    {current.source ? ` · ${t('review.via', { source: current.source })}` : ''}
                  </p>
                </div>
                {/* Tag row */}
                <div className="hidden shrink-0 flex-wrap justify-end gap-2 sm:flex">
                  {detailData?.location && <FactTag>{detailData.location}</FactTag>}
                  {typeof detailData?.yearsOfExperience === 'number' && (
                    <FactTag>{t('review.yearsExperience', { count: detailData.yearsOfExperience })}</FactTag>
                  )}
                  {detailData && detailData.languages.length > 0 && (
                    <FactTag>{detailData.languages.join(' · ')}</FactTag>
                  )}
                </div>
              </div>

              {/* CV summary — generated on demand */}
              <section className="rounded-[10px] border border-[oklch(0.92_0.01_250)] bg-[oklch(0.985_0.002_247)] p-3.5">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[oklch(0.5_0.02_250)]">
                    {t('review.summaryFromCv')}
                  </span>
                  {summary.status === 'ok' && (
                    <button
                      type="button"
                      onClick={() => generateSummary(current.candidate_id)}
                      className="text-[11.5px] font-medium text-[oklch(0.45_0.16_250)] hover:opacity-80"
                    >
                      {t('review.regenerate')}
                    </button>
                  )}
                </div>
                {summary.status === 'ok' ? (
                  <p className="text-[13.5px] leading-[1.55] text-[oklch(0.25_0.02_250)]">{summary.text}</p>
                ) : summary.status === 'loading' ? (
                  <p className="flex items-center gap-2 text-[13px] text-[oklch(0.5_0.02_250)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    {t('review.generating')}
                  </p>
                ) : summary.status === 'idle' ? (
                  <button
                    type="button"
                    onClick={() => generateSummary(current.candidate_id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[oklch(0.86_0.05_250)] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[oklch(0.4_0.16_250)] hover:bg-[oklch(0.98_0.015_250)]"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    {t('review.generateSummary')}
                  </button>
                ) : (
                  <p className="text-[12.5px] text-[oklch(0.5_0.02_250)]">
                    {summary.status === 'too_thin'
                      ? t('review.summaryTooThin')
                      : summary.status === 'rate_limited'
                        ? t('review.summaryRateLimited')
                        : summary.status === 'no_key'
                          ? t('review.summaryNoKey')
                          : t('review.summaryError')}{' '}
                    {summary.status !== 'no_key' && (
                      <button
                        type="button"
                        onClick={() => generateSummary(current.candidate_id)}
                        className="font-semibold text-[oklch(0.45_0.16_250)] hover:opacity-80"
                      >
                        {t('common.tryAgain')}
                      </button>
                    )}
                  </p>
                )}
              </section>

              {/* CV preview + facts */}
              <div className="flex flex-col gap-3.5 sm:flex-row">
                {detailData?.cvDocument ? (
                  <button
                    type="button"
                    onClick={() => openCv(detailData.cvDocument!.id)}
                    className="flex h-24 flex-1 items-center justify-center gap-2 rounded-[10px] border border-dashed border-[oklch(0.85_0.01_250)] bg-white text-[13px] text-[oklch(0.4_0.02_250)] transition-colors hover:bg-[oklch(0.98_0.005_250)]"
                  >
                    <FileText className="h-4 w-4" aria-hidden />
                    <span className="max-w-[280px] truncate">{detailData.cvDocument.fileName}</span>
                    <ExternalLink className="h-3.5 w-3.5 text-[oklch(0.55_0.02_250)]" aria-hidden />
                  </button>
                ) : (
                  <div className="flex h-24 flex-1 items-center justify-center rounded-[10px] border border-dashed border-[oklch(0.88_0.01_250)] bg-[oklch(0.98_0.002_247)] text-[12.5px] text-[oklch(0.55_0.02_250)]">
                    {detail === 'loading' ? t('common.loading') : t('review.noCv')}
                  </div>
                )}
                <div className="flex w-full flex-col gap-2 text-[12.5px] sm:w-[210px] sm:shrink-0">
                  <FactRow label={t('review.salaryExp')} value={detailData?.salaryExpectation ?? '—'} />
                  <FactRow label={t('review.notice')} value={detailData?.noticePeriod ?? '—'} />
                  <FactRow label={t('review.sourceLabel')} value={current.source ?? '—'} />
                </div>
              </div>

              {/* Open full profile */}
              <Link
                href={`/candidates/${current.candidate_id}`}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[oklch(0.45_0.16_250)] hover:underline"
              >
                {t('review.openFullProfile')}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            </article>

            <ChevronButton
              direction="next"
              onClick={goNext}
              disabled={index >= queue.length - 1}
            />
          </div>

          {/* Action bar */}
          <div className="flex flex-shrink-0 flex-wrap items-center justify-center gap-2.5 px-5 pb-6 sm:px-7">
            <ActionButton label={t('pipeline.bulk.reject')} shortcut="R" onClick={reject} disabled={pending} icon={XCircle} />
            <ActionButton label={t('review.action.skip')} shortcut="K" onClick={goNext} disabled={index >= queue.length - 1} icon={SkipForward} />
            <ActionButton label={t('pipeline.bulk.schedule')} shortcut="S" onClick={() => void openSchedule()} disabled={pending} icon={CalendarPlus} />
            <ActionButton
              label={nextStage ? t('review.action.advanceTo', { stage: nextStage.name }) : t('review.action.advance')}
              shortcut="A"
              onClick={() => void advance()}
              disabled={pending || !nextStage}
              icon={ArrowRight}
              primary
            />
          </div>
        </>
      ) : (
        /* Completion state */
        <div className="flex flex-1 items-center justify-center px-6 pb-10">
          <div className="flex max-w-md flex-col items-center rounded-2xl bg-white p-10 text-center shadow-[0_20px_40px_-10px_oklch(0_0_0/0.4)]">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[oklch(0.93_0.06_155)]">
              <CheckCircle2 className="h-7 w-7 text-[oklch(0.42_0.13_150)]" aria-hidden />
            </div>
            <h2 className="text-lg font-bold text-[oklch(0.15_0.02_250)]">
              {t('review.completeTitle')}
            </h2>
            <p className="mt-2 text-[13.5px] text-[oklch(0.5_0.02_250)]">
              {t('review.completeBody')}
            </p>
            <Button onClick={onClose} className="mt-6">
              {t('review.backToPipeline')}
            </Button>
          </div>
        </div>
      )}

      {/* Schedule overlay — the real interview form, lazily loaded, returns
          here on save without leaving Review Mode. */}
      <Dialog open={scheduleOpen} onOpenChange={(o) => !o && setScheduleOpen(false)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogTitle className="mb-2">{t('review.scheduleInterview')}</DialogTitle>
          {scheduleLoading || !scheduleData ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t('review.loadingScheduler')}
            </div>
          ) : (
            <InterviewForm
              candidates={scheduleData.candidates}
              vacancies={scheduleData.vacancies}
              applications={scheduleData.applications}
              teamMembers={scheduleData.teamMembers}
              defaultCandidateId={current?.candidate_id}
              defaultVacancyId={current?.vacancy_id}
              defaultInterviewerId={scheduleData.currentUserId}
              hasGoogleCalendar={scheduleData.hasGoogleCalendar}
              hasZoom={scheduleData.hasZoom}
              hasMicrosoft={scheduleData.hasMicrosoft}
              defaultMeetingProvider={scheduleData.defaultMeetingProvider}
              onScheduled={() => {
                setScheduleOpen(false)
                if (current) setScheduledIds((prev) => new Set(prev).add(current.id))
              }}
              onCancel={() => setScheduleOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ChevronButton({
  direction,
  onClick,
  disabled,
}: {
  direction: 'prev' | 'next'
  onClick: () => void
  disabled: boolean
}) {
  const t = useTranslations()
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'prev' ? t('review.prevCandidate') : t('review.nextCandidate')}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[oklch(0.4_0.01_250)] text-[oklch(0.6_0.01_250)] transition-colors hover:border-[oklch(0.5_0.01_250)] hover:text-[oklch(0.8_0.01_250)] disabled:opacity-30 disabled:hover:border-[oklch(0.4_0.01_250)] disabled:hover:text-[oklch(0.6_0.01_250)]"
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  )
}

function ActionButton({
  label,
  shortcut,
  onClick,
  disabled,
  icon: Icon,
  primary,
}: {
  label: string
  shortcut: string
  onClick: () => void
  disabled?: boolean
  icon: typeof XCircle
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-[13.5px] font-semibold transition-colors disabled:opacity-40 ' +
        (primary
          ? 'bg-[oklch(0.55_0.18_250)] text-white hover:bg-[oklch(0.5_0.18_250)]'
          : 'bg-[oklch(0.3_0.02_250)] text-[oklch(0.9_0.01_250)] hover:bg-[oklch(0.35_0.02_250)]')
      }
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
      <span
        className={
          'rounded px-1.5 py-0.5 text-[11.5px] ' +
          (primary ? 'bg-[oklch(0.45_0.16_250)]' : 'bg-[oklch(0.4_0.02_250)]')
        }
      >
        {shortcut}
      </span>
    </button>
  )
}

function FactTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-[oklch(0.95_0.01_250)] px-2.5 py-1 text-[12px] text-[oklch(0.4_0.02_250)]">
      {children}
    </span>
  )
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[oklch(0.55_0.02_250)]">{label}</span>
      <span className="truncate font-semibold text-[oklch(0.25_0.02_250)]" title={value}>
        {value}
      </span>
    </div>
  )
}
