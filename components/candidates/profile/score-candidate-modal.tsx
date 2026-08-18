'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ChevronRight, Loader2, Save, Send } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  getScorecardData,
  saveEvaluation,
  type ScorecardData,
} from '@/lib/actions/evaluations'

interface ScoreCandidateModalProps {
  applicationId: string
  vacancyTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Recommendation = 'strong_yes' | 'yes' | 'lean_no' | 'no'

const RECOMMENDATIONS: { value: Recommendation; labelKey: string; active: string }[] = [
  { value: 'strong_yes', labelKey: 'scoreModal.recStrongYes', active: 'border-[oklch(0.7_0.14_150)] bg-[oklch(0.93_0.08_155)] text-[oklch(0.34_0.14_150)]' },
  { value: 'yes', labelKey: 'scoreModal.recYes', active: 'border-[oklch(0.8_0.1_150)] bg-[oklch(0.95_0.05_155)] text-[oklch(0.38_0.12_150)]' },
  { value: 'lean_no', labelKey: 'scoreModal.recLeanNo', active: 'border-[oklch(0.85_0.08_70)] bg-[oklch(0.97_0.05_70)] text-[oklch(0.45_0.12_55)]' },
  { value: 'no', labelKey: 'scoreModal.recNo', active: 'border-[oklch(0.85_0.06_27)] bg-[oklch(0.96_0.04_27)] text-[oklch(0.5_0.19_27)]' },
]

const RECOMMENDATION_LABEL_KEY: Record<Recommendation, string> = {
  strong_yes: 'scoreModal.recStrongYes',
  yes: 'scoreModal.recYes',
  lean_no: 'scoreModal.recLeanNo',
  no: 'scoreModal.recNo',
}

/**
 * In-place "Score candidate" modal — opened from the candidate profile's
 * "Add full scorecard" (Interview stage). Pulls the vacancy's real scorecard
 * attributes + interview-guide questions (the SETUP) and renders a fillable
 * scoring form for THIS candidate. Submitting saves the reviewer's evaluation;
 * the average of the 1–5 attribute ratings becomes the fit score shown on the
 * pipeline. Never navigates to the vacancy setup page.
 */
export function ScoreCandidateModal({
  applicationId,
  vacancyTitle,
  open,
  onOpenChange,
}: ScoreCandidateModalProps) {
  const t = useTranslations()
  const router = useRouter()
  const [data, setData] = useState<ScorecardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)

  const [scores, setScores] = useState<Record<string, number>>({})
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [reason, setReason] = useState('')

  // Lazy-load the vacancy's questions + any existing evaluation when opened.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    getScorecardData(applicationId).then((res) => {
      if (cancelled) return
      setLoading(false)
      if (!res.success) {
        toast.error(res.error)
        onOpenChange(false)
        return
      }
      setData(res.data)
      // Prefill from an existing evaluation.
      const prefill: Record<string, number> = {}
      for (const a of res.data.existing?.answers ?? []) {
        if (typeof a.scoreValue === 'number') prefill[a.questionId] = a.scoreValue
      }
      setScores(prefill)
      setRecommendation(res.data.existing?.recommendation ?? null)
      setReason(res.data.existing?.recommendationReason ?? '')
    })
    return () => {
      cancelled = true
    }
  }, [open, applicationId, onOpenChange])

  const scoreQuestions = data?.questions.filter((q) => q.type === 'score') ?? []
  const guideQuestions = data?.questions.filter((q) => q.type === 'text') ?? []
  const allRated = scoreQuestions.length > 0 && scoreQuestions.every((q) => scores[q.id])
  const fitScore = allRated
    ? Math.round(
        (scoreQuestions.reduce((acc, q) => acc + (scores[q.id] ?? 0), 0) /
          (scoreQuestions.length * 5)) *
          100,
      )
    : null

  const persist = async (submit: boolean) => {
    if (!data) return
    if (submit) {
      if (!allRated) {
        toast.error(t('scoreModal.errRateAll'))
        return
      }
      if (!recommendation) {
        toast.error(t('scoreModal.errPickRec'))
        return
      }
      if (!reason.trim()) {
        toast.error(t('scoreModal.errReason'))
        return
      }
    }
    setSaving(true)
    const answers = scoreQuestions.map((q) => ({
      questionId: q.id,
      textValue: null,
      scoreValue: scores[q.id] ?? null,
    }))
    const result = await saveEvaluation({
      applicationId,
      vacancyId: data.vacancyId,
      candidateId: data.candidateId,
      score: fitScore,
      answers,
      recommendation,
      recommendationReason: reason.trim() || null,
      submitted: submit,
    })
    setSaving(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    if (submit) {
      toast.success(t('scoreModal.submitted'))
      onOpenChange(false)
      router.refresh()
    } else {
      toast.success(t('scoreModal.draftSaved'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('scoreModal.title')}</DialogTitle>
          <DialogDescription>
            {t('scoreModal.subtitle', { title: vacancyTitle })}
          </DialogDescription>
        </DialogHeader>

        {loading || !data ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('scoreModal.loading')}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Interview guide — read-only reference, collapsed by default */}
            {guideQuestions.length > 0 && (
              <div className="rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setGuideOpen((v) => !v)}
                  aria-expanded={guideOpen}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                >
                  <ChevronRight
                    className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', guideOpen && 'rotate-90')}
                    aria-hidden
                  />
                  <span className="text-[13px] font-semibold text-foreground">{t('scoreModal.interviewGuide')}</span>
                  <span className="text-[12px] text-muted-foreground">
                    {t('scoreModal.guideCount', { count: guideQuestions.length })}
                  </span>
                </button>
                {guideOpen && (
                  <ul className="space-y-1.5 border-t border-border px-4 py-3">
                    {guideQuestions.map((q) => (
                      <li key={q.id} className="text-[12.5px] leading-relaxed text-muted-foreground">
                        {q.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Scorecard — the vacancy's real attributes, rated 1–5 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-foreground">{t('scoreModal.scorecard')}</h3>
                {fitScore !== null && (
                  <span className="rounded-full bg-[oklch(0.93_0.07_155)] px-2.5 py-0.5 text-[12px] font-bold text-[oklch(0.38_0.14_150)]">
                    {t('scoreModal.fitPercent', { score: fitScore })}
                  </span>
                )}
              </div>

              {scoreQuestions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[12.5px] text-muted-foreground">
                  {t('scoreModal.noAttributes')}
                </p>
              ) : (
                scoreQuestions.map((q) => (
                  <div key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-foreground">{q.label}</span>
                      <span
                        className={cn(
                          'rounded border px-1.5 py-0.5 text-[10.5px] font-semibold',
                          q.mustHave
                            ? 'border-[oklch(0.88_0.06_27)] bg-[oklch(0.97_0.03_27)] text-[oklch(0.5_0.19_27)]'
                            : 'border-border text-muted-foreground',
                        )}
                      >
                        {q.mustHave ? t('wizard.mustHave') : t('wizard.niceToHave')}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() =>
                            setScores((prev) => {
                              const next = { ...prev }
                              if (next[q.id] === n) delete next[q.id]
                              else next[q.id] = n
                              return next
                            })
                          }
                          className={cn(
                            'h-8 w-8 rounded-md border text-sm font-medium transition-colors',
                            scores[q.id] === n
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-foreground hover:bg-muted',
                          )}
                          aria-label={t('scoreModal.ratingAria', { label: q.label, n })}
                          aria-pressed={scores[q.id] === n}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Overall recommendation */}
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold">
                {t('scoreModal.overallRec')} <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {RECOMMENDATIONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRecommendation(r.value)}
                    aria-pressed={recommendation === r.value}
                    className={cn(
                      'rounded-lg border px-2 py-2 text-[12.5px] font-semibold transition-colors',
                      recommendation === r.value
                        ? r.active
                        : 'border-border text-foreground hover:bg-muted',
                    )}
                  >
                    {t(r.labelKey)}
                  </button>
                ))}
              </div>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('scoreModal.reasonPlaceholder')}
                rows={2}
                maxLength={300}
                className="text-[12.5px]"
              />
            </div>

            {/* Other reviewers' cards — revealed only once you've submitted
                yours (anti-anchoring). */}
            {data.existing?.submitted && data.otherCards.length > 0 ? (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-[13px] font-semibold text-foreground">
                  {t('scoreModal.otherScorecards', { count: data.otherCards.length })}
                </p>
                <ul className="space-y-2.5">
                  {data.otherCards.map((c, i) => (
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
                {data.otherSubmittedCount > 0
                  ? t('scoreModal.othersSubmitted', { count: data.otherSubmittedCount })
                  : t('scoreModal.othersHidden')}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={() => persist(false)} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {t('stageBlock.saveDraft')}
              </Button>
              <Button type="button" onClick={() => persist(true)} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {t('scoreModal.submit')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
