'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Send, Check, ExternalLink } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { createAutosaver } from '@/lib/scorecards/autosave'
import {
  getScorecardData,
  saveEvaluation,
  type ScorecardData,
  type ScorecardQuestion,
  type ScorecardRecommendation,
} from '@/lib/actions/evaluations'

interface AssessmentSheetProps {
  applicationId: string
  vacancyId: string
  vacancyTitle: string
  candidateName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const RECOMMENDATIONS: { value: ScorecardRecommendation; labelKey: string; active: string }[] = [
  { value: 'strong_yes', labelKey: 'scoreModal.recStrongYes', active: 'border-[oklch(0.7_0.14_150)] bg-[oklch(0.93_0.08_155)] text-[oklch(0.34_0.14_150)]' },
  { value: 'yes', labelKey: 'scoreModal.recYes', active: 'border-[oklch(0.8_0.1_150)] bg-[oklch(0.95_0.05_155)] text-[oklch(0.38_0.12_150)]' },
  { value: 'lean_no', labelKey: 'scoreModal.recLeanNo', active: 'border-[oklch(0.85_0.08_70)] bg-[oklch(0.97_0.05_70)] text-[oklch(0.45_0.12_55)]' },
  { value: 'no', labelKey: 'scoreModal.recNo', active: 'border-[oklch(0.85_0.06_27)] bg-[oklch(0.96_0.04_27)] text-[oklch(0.5_0.19_27)]' },
]

const RECOMMENDATION_LABEL_KEY: Record<ScorecardRecommendation, string> = {
  strong_yes: 'scoreModal.recStrongYes',
  yes: 'scoreModal.recYes',
  lean_no: 'scoreModal.recLeanNo',
  no: 'scoreModal.recNo',
}

interface FormState {
  scores: Record<string, number>
  texts: Record<string, string>
  recommendation: ScorecardRecommendation | null
  reason: string
}

/**
 * Assessment side sheet — Phase 1 (single scroll). Replaces the old centred
 * "Score candidate" modal. Right-anchored so the candidate's profile stays
 * visible behind it. Three DISCRETE sections (questions → scorecard →
 * conclusion) rendered in one scroll; Phase 2 (the stepped wizard) will wrap
 * these same sections in a step controller, so they're kept self-contained.
 *
 * Nothing is mandatory — you can submit an empty card. Everything autosaves as
 * a draft (debounced + flushed on tab-hide / close) so a browser close never
 * loses work. `წარადგინე` (Submit) flips the card to submitted, which is what
 * surfaces it in the permanent record and reveals other reviewers' cards.
 */
export function AssessmentSheet({
  applicationId,
  vacancyId,
  vacancyTitle,
  candidateName,
  open,
  onOpenChange,
}: AssessmentSheetProps) {
  const t = useTranslations()
  const router = useRouter()
  const [data, setData] = useState<ScorecardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<FormState>({ scores: {}, texts: {}, recommendation: null, reason: '' })

  // Mirror the latest form + data into refs so the debounced autosave reads the
  // freshest values without re-creating the autosaver on every keystroke.
  const formRef = useRef(form)
  formRef.current = form
  const dataRef = useRef<ScorecardData | null>(data)
  dataRef.current = data

  const scoreQuestions = data?.questions.filter((q) => q.type === 'score') ?? []
  const textQuestions = data?.questions.filter((q) => q.type === 'text') ?? []

  // Persist the current draft. Omits `submitted` so the DB value is preserved
  // (a new card inserts as draft; an already-submitted card stays submitted
  // while being edited — no silent un-submit mid-edit).
  const persistDraft = useCallback(async () => {
    const d = dataRef.current
    if (!d) return
    const f = formRef.current
    const scored = d.questions.filter((q) => q.type === 'score')
    const allRated = scored.length > 0 && scored.every((q) => f.scores[q.id])
    const fitScore = allRated
      ? Math.round((scored.reduce((acc, q) => acc + (f.scores[q.id] ?? 0), 0) / (scored.length * 5)) * 100)
      : null
    const answers = d.questions.map((q) => ({
      questionId: q.id,
      textValue: q.type === 'text' ? (f.texts[q.id]?.trim() || null) : null,
      scoreValue: q.type === 'score' ? (f.scores[q.id] ?? null) : null,
    }))
    setSaving(true)
    const result = await saveEvaluation({
      applicationId,
      vacancyId: d.vacancyId,
      candidateId: d.candidateId,
      score: fitScore,
      answers,
      recommendation: f.recommendation,
      recommendationReason: f.reason.trim() || null,
    })
    setSaving(false)
    if (result.success) setSavedAt(new Date().toISOString())
  }, [applicationId])

  const autosaverRef = useRef(createAutosaver(() => void persistDraft()))
  useEffect(() => {
    autosaverRef.current = createAutosaver(() => void persistDraft())
  }, [persistDraft])

  // Any edit (re)arms the debounce.
  const touch = useCallback((updater: (prev: FormState) => FormState) => {
    setForm(updater)
    autosaverRef.current.schedule()
  }, [])

  // Lazy-load the vacancy's questions + this reviewer's existing card on open.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setSavedAt(null)
    getScorecardData(applicationId).then((res) => {
      if (cancelled) return
      setLoading(false)
      if (!res.success) {
        toast.error(res.error)
        onOpenChange(false)
        return
      }
      setData(res.data)
      const scores: Record<string, number> = {}
      const texts: Record<string, string> = {}
      for (const a of res.data.existing?.answers ?? []) {
        if (typeof a.scoreValue === 'number') scores[a.questionId] = a.scoreValue
        if (a.textValue) texts[a.questionId] = a.textValue
      }
      setForm({
        scores,
        texts,
        recommendation: res.data.existing?.recommendation ?? null,
        reason: res.data.existing?.recommendationReason ?? '',
      })
    })
    return () => {
      cancelled = true
    }
  }, [open, applicationId, onOpenChange])

  // Flush pending saves when the tab is hidden or the page is being unloaded,
  // so closing the browser mid-fill doesn't lose the last edit.
  useEffect(() => {
    if (!open) return
    const flush = () => autosaverRef.current.flush()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
      // Closing/unmounting the sheet: persist whatever is pending.
      autosaverRef.current.flush()
    }
  }, [open])

  const submit = async () => {
    const d = dataRef.current
    if (!d) return
    // Make sure no debounced draft races the submit.
    autosaverRef.current.cancel()
    const f = formRef.current
    const scored = d.questions.filter((q) => q.type === 'score')
    const allRated = scored.length > 0 && scored.every((q) => f.scores[q.id])
    const fitScore = allRated
      ? Math.round((scored.reduce((acc, q) => acc + (f.scores[q.id] ?? 0), 0) / (scored.length * 5)) * 100)
      : null
    const answers = d.questions.map((q) => ({
      questionId: q.id,
      textValue: q.type === 'text' ? (f.texts[q.id]?.trim() || null) : null,
      scoreValue: q.type === 'score' ? (f.scores[q.id] ?? null) : null,
    }))
    setSubmitting(true)
    const result = await saveEvaluation({
      applicationId,
      vacancyId: d.vacancyId,
      candidateId: d.candidateId,
      score: fitScore,
      answers,
      recommendation: f.recommendation,
      recommendationReason: f.reason.trim() || null,
      submitted: true,
    })
    setSubmitting(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success(t('assess.submitted'))
    onOpenChange(false)
    router.refresh()
  }

  // Running average over scored criteria (provisional feedback; the saved fit %
  // still requires all criteria rated).
  const scoredValues = scoreQuestions.map((q) => form.scores[q.id]).filter((n): n is number => !!n)
  const runningAvg = scoredValues.length > 0
    ? (scoredValues.reduce((a, b) => a + b, 0) / scoredValues.length).toFixed(1)
    : null
  const answeredTextCount = textQuestions.filter((q) => (form.texts[q.id] ?? '').trim().length > 0).length

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-[600px]"
      >
        <SheetHeader className="border-b border-border p-5 pb-4">
          <SheetTitle className="text-[18px] font-bold">{t('assess.title')}</SheetTitle>
          <SheetDescription className="text-[13px]">
            {candidateName ? `${candidateName} · ${vacancyTitle}` : vacancyTitle}
          </SheetDescription>
        </SheetHeader>

        {loading || !data ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('scoreModal.loading')}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="flex flex-col gap-6 p-5">
              <GuideAnswersSection
                questions={textQuestions}
                vacancyId={vacancyId}
                texts={form.texts}
                onChange={(id, v) => touch((p) => ({ ...p, texts: { ...p.texts, [id]: v } }))}
              />

              <ScorecardSection
                questions={scoreQuestions}
                vacancyId={vacancyId}
                scores={form.scores}
                runningAvg={runningAvg}
                onToggle={(id, n) =>
                  touch((p) => {
                    const next = { ...p.scores }
                    if (next[id] === n) delete next[id]
                    else next[id] = n
                    return { ...p, scores: next }
                  })
                }
              />

              <ConclusionSection
                recommendation={form.recommendation}
                reason={form.reason}
                criteriaCount={scoreQuestions.length}
                runningAvg={runningAvg}
                answeredCount={answeredTextCount}
                totalQuestions={textQuestions.length}
                onPickRecommendation={(r) => touch((p) => ({ ...p, recommendation: p.recommendation === r ? null : r }))}
                onReason={(v) => touch((p) => ({ ...p, reason: v }))}
                otherCards={data.existing?.submitted ? data.otherCards : []}
                otherSubmittedCount={data.otherSubmittedCount}
                mySubmitted={!!data.existing?.submitted}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-border p-4">
          <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                {t('assess.saving')}
              </>
            ) : savedAt ? (
              <>
                <Check className="h-3.5 w-3.5 text-[oklch(0.6_0.15_145)]" aria-hidden />
                {t('assess.savedAt', { time: new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}
              </>
            ) : (
              t('assess.willAutosave')
            )}
          </span>
          <Button
            type="button"
            onClick={submit}
            disabled={submitting || loading || !data}
            className="ml-auto gap-1.5 bg-[oklch(0.55_0.18_250)] text-white hover:bg-[oklch(0.5_0.18_250)]"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
            {t('assess.submit')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Empty-state panel linking to the vacancy's scorecard-and-interview setup. */
function EmptySetup({ vacancyId, text }: { vacancyId: string; text: string }) {
  const t = useTranslations()
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-5 text-center">
      <p className="text-[12.5px] text-muted-foreground">{text}</p>
      <Link
        href={`/vacancies/${vacancyId}?tab=qe`}
        className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[oklch(0.45_0.16_250)] hover:underline"
      >
        {t('assess.setupLink')}
        <ExternalLink className="h-3 w-3" aria-hidden />
      </Link>
    </div>
  )
}

/** Section 1 — interview questions, each with an autosaving answer field. */
function GuideAnswersSection({
  questions,
  vacancyId,
  texts,
  onChange,
}: {
  questions: ScorecardQuestion[]
  vacancyId: string
  texts: Record<string, string>
  onChange: (id: string, value: string) => void
}) {
  const t = useTranslations()
  return (
    <section>
      <h3 className="text-[15px] font-bold text-foreground">{t('assess.sectionQuestions')}</h3>
      <p className="mb-3 mt-0.5 text-[12.5px] text-muted-foreground">{t('assess.questionsIntro')}</p>
      {questions.length === 0 ? (
        <EmptySetup vacancyId={vacancyId} text={t('assess.noQuestions')} />
      ) : (
        <div className="flex flex-col gap-3">
          {questions.map((q, i) => {
            const filled = (texts[q.id] ?? '').trim().length > 0
            return (
              <div key={q.id} className="rounded-lg border border-border p-3.5">
                <div className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold',
                      filled
                        ? 'bg-[oklch(0.6_0.15_145_/_0.14)] text-[oklch(0.4_0.13_150)]'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="flex-1 text-[13.5px] leading-[1.5] text-foreground">{q.label}</p>
                </div>
                <Textarea
                  value={texts[q.id] ?? ''}
                  onChange={(e) => onChange(q.id, e.target.value)}
                  placeholder={t('assess.answerPlaceholder')}
                  rows={2}
                  maxLength={5000}
                  className="mt-2.5 text-[13px]"
                />
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/** Section 2 — scorecard criteria rated 1–5 with anchor labels. */
function ScorecardSection({
  questions,
  vacancyId,
  scores,
  runningAvg,
  onToggle,
}: {
  questions: ScorecardQuestion[]
  vacancyId: string
  scores: Record<string, number>
  runningAvg: string | null
  onToggle: (id: string, n: number) => void
}) {
  const t = useTranslations()
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-2">
        <h3 className="text-[15px] font-bold text-foreground">{t('assess.sectionScorecard')}</h3>
        {runningAvg && (
          <span className="text-right">
            <span className="block text-[20px] font-bold leading-none text-foreground">{runningAvg}</span>
            <span className="text-[10.5px] text-muted-foreground">{t('assess.runningAverage')}</span>
          </span>
        )}
      </div>
      {questions.length === 0 ? (
        <EmptySetup vacancyId={vacancyId} text={t('assess.noCriteria')} />
      ) : (
        <div className="flex flex-col gap-4">
          {questions.map((q) => (
            <div key={q.id}>
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-[13.5px] font-medium text-foreground">{q.label}</span>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10.5px] font-semibold',
                    q.mustHave
                      ? 'bg-[oklch(0.96_0.04_27)] text-[oklch(0.5_0.19_27)]'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {q.mustHave ? t('wizard.mustHave') : t('wizard.niceToHave')}
                </span>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onToggle(q.id, n)}
                    aria-pressed={scores[q.id] === n}
                    aria-label={t('scoreModal.ratingAria', { label: q.label, n })}
                    className={cn(
                      'h-9 flex-1 rounded-md border text-[13px] font-semibold transition-colors',
                      scores[q.id] === n
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-[10.5px] text-muted-foreground">
                <span>{t('assess.anchorLow')}</span>
                <span>{t('assess.anchorMid')}</span>
                <span>{t('assess.anchorHigh')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/** Section 3 — recommendation + reason + read-back summary + peers' cards. */
function ConclusionSection({
  recommendation,
  reason,
  criteriaCount,
  runningAvg,
  answeredCount,
  totalQuestions,
  onPickRecommendation,
  onReason,
  otherCards,
  otherSubmittedCount,
  mySubmitted,
}: {
  recommendation: ScorecardRecommendation | null
  reason: string
  criteriaCount: number
  runningAvg: string | null
  answeredCount: number
  totalQuestions: number
  onPickRecommendation: (r: ScorecardRecommendation) => void
  onReason: (v: string) => void
  otherCards: ScorecardData['otherCards']
  otherSubmittedCount: number
  mySubmitted: boolean
}) {
  const t = useTranslations()
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[15px] font-bold text-foreground">{t('assess.sectionConclusion')}</h3>

      <div className="rounded-lg border border-border bg-muted/20 px-3.5 py-2.5 text-[12px] text-muted-foreground">
        {t('assess.readback', {
          criteria: criteriaCount,
          avg: runningAvg ?? '—',
          answered: answeredCount,
          total: totalQuestions,
        })}
      </div>

      <div>
        <Label className="text-[13px] font-semibold">{t('assess.recommendation')}</Label>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RECOMMENDATIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => onPickRecommendation(r.value)}
              aria-pressed={recommendation === r.value}
              className={cn(
                'rounded-lg border px-2 py-2 text-[12.5px] font-semibold transition-colors',
                recommendation === r.value ? r.active : 'border-border text-foreground hover:bg-muted',
              )}
            >
              {t(r.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <Textarea
        value={reason}
        onChange={(e) => onReason(e.target.value)}
        placeholder={t('assess.reasonPlaceholder')}
        rows={2}
        maxLength={300}
        className="text-[12.5px]"
      />

      {mySubmitted && otherCards.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-[13px] font-semibold text-foreground">
            {t('scoreModal.otherScorecards', { count: otherCards.length })}
          </p>
          <ul className="space-y-2.5">
            {otherCards.map((c, i) => (
              <li key={i} className="space-y-0.5">
                <div className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="font-medium text-foreground">{c.reviewerName}</span>
                  <span className="flex items-center gap-2">
                    {c.recommendation && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-foreground">
                        {t(RECOMMENDATION_LABEL_KEY[c.recommendation])}
                      </span>
                    )}
                    {typeof c.score === 'number' && (
                      <span className="tabular-nums text-muted-foreground">{t('scoreModal.fitPercent', { score: c.score })}</span>
                    )}
                  </span>
                </div>
                {c.recommendationReason && (
                  <p className="text-[12px] text-muted-foreground">{c.recommendationReason}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[11.5px] text-muted-foreground">
          {otherSubmittedCount > 0
            ? t('scoreModal.othersSubmitted', { count: otherSubmittedCount })
            : t('scoreModal.othersHidden')}
        </p>
      )}
    </section>
  )
}
