'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import {
  Video,
  Calendar,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Save,
  Send,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createOffer, updateOffer, sendOffer } from '@/lib/actions/offers'
import { markApplicationHired } from '@/lib/actions/applications/status-actions'
import { OfferPanel, type OfferRow } from '@/components/offers/offer-panel'
import type { ApplicationStatus } from '@/lib/types/application'
import { statusLabel } from '@/lib/pipeline/status-i18n'
import { StageTracker } from './stage-tracker'
import { AssessmentSheet } from './assessment-sheet'
import { RescheduleInterviewDialog } from '@/components/interviews/reschedule-interview-dialog'

/** Recommendation value → i18n label key (reused from the score modal). */
const REC_LABEL_KEY: Record<string, string> = {
  strong_yes: 'scoreModal.recStrongYes',
  yes: 'scoreModal.recYes',
  lean_no: 'scoreModal.recLeanNo',
  no: 'scoreModal.recNo',
}

export interface StageContextualBlockProps {
  applicationId: string
  vacancyId: string
  vacancyTitle: string
  /** Candidate display name — the assessment sheet's subtitle. */
  candidateName: string
  /** Offers on this application — when present, the Offer stage shows the sent
   * offer's summary + actions instead of a bare create form. */
  offers: OfferRow[]
  /** Ordered list of non-terminal stages — used by the tracker. */
  stages: { code: ApplicationStatus['code']; name: string; id: string }[]
  currentStage: { code: ApplicationStatus['code']; name: string; id: string }
  /** Candidate-derived data shown on the Screening gate tiles (salary
   * expectation, notice period, location). Real screening-question
   * knockouts arrive via `screeningFlags` below; these three tiles are
   * candidate-profile-level data the recruiter always wants in front of
   * them when making the gate decision. */
  candidate: {
    salaryExpectation: string | null
    noticePeriod: string | null
    location: string | null
  }
  /** Upcoming or recent interviews on this application — only the next
   * upcoming one is highlighted on the Interview state. */
  upcomingInterview: {
    id: string
    type: 'phone' | 'video' | 'onsite'
    scheduledAt: string
    durationMinutes: number
    meetingLink: string | null
  } | null
  /** ALL apply-form screening answers on this application — not just the
   * knockout-flagged ones — so the recruiter sees every question the candidate
   * answered (e.g. a non-knockout "desired salary") on the Screening stage.
   * `isFlag` marks answers that failed a knockout condition. An empty list means
   * the candidate has no apply-form data (added manually) → neutral state (#6). */
  screeningAnswers: {
    questionLabel: string
    answerValue: string | null
    answerType: string
    expectedAnswer: string | null
    isFlag: boolean
  }[]
  /** The current recruiter's own scorecard for this application — shown as a
   * summary on the Interview stage once submitted, so their estimation is
   * visible on the profile (not just re-openable in the modal) (#N6). */
  evaluation: {
    recommendation: string | null
    score: number | null
    submitted: boolean
    reason: string | null
  } | null
}

/**
 * Wave 2.3 stage-contextual block per Candidate Profile A Refined.dc.html.
 *
 * Renders different content depending on the selected application's
 * current stage:
 *   - Screening → lightweight gate (3 data tiles + Yes/No recommendation
 *     + 1-line reason + "Save & advance to Interview" button)
 *   - Interview → scheduled interview tile + "Add full scorecard" +
 *     "Reschedule" actions
 *   - Offer → "Create offer" CTA linking into the existing offer flow
 *   - Other (Applied / Hired / etc.) → minimal "Next move" block
 *
 * The Screening recommendation + reason aren't persisted yet — Wave 2.5
 * will introduce a dedicated candidate_evaluations row for the screening
 * decision (see docs/redesign/tech-debt.md §2). For now the textarea is
 * captured only client-side and discarded on advance. The status change
 * itself does go through `updateApplicationStatus`.
 */
export function StageContextualBlock({
  applicationId,
  vacancyId,
  vacancyTitle,
  candidateName,
  offers,
  stages,
  currentStage,
  upcomingInterview,
  screeningAnswers,
  evaluation,
}: StageContextualBlockProps) {
  switch (currentStage.code) {
    case 'screening':
      return (
        <ScreeningChecks
          stages={stages}
          currentCode={currentStage.code}
          currentId={currentStage.id}
          screeningAnswers={screeningAnswers}
        />
      )
    case 'interview':
      return (
        <InterviewState
          applicationId={applicationId}
          vacancyId={vacancyId}
          vacancyTitle={vacancyTitle}
          candidateName={candidateName}
          stages={stages}
          currentCode={currentStage.code}
          currentId={currentStage.id}
          upcomingInterview={upcomingInterview}
          evaluation={evaluation}
        />
      )
    case 'offer':
      return (
        <OfferState
          applicationId={applicationId}
          vacancyTitle={vacancyTitle}
          offers={offers}
          stages={stages}
          currentCode={currentStage.code}
          currentId={currentStage.id}
        />
      )
    default:
      return (
        <DefaultStateCard
          stages={stages}
          currentCode={currentStage.code}
          currentId={currentStage.id}
          stageName={currentStage.name}
        />
      )
  }
}

/**
 * Screening state — passive "Screening checks" panel (no manual gate).
 *
 * The earlier Yes/No decision gate + required reason was removed by design:
 * the decision *is* the stage move itself. This panel surfaces the apply-form
 * knockout flags read-only and points the recruiter at the rail's Advance /
 * Reject buttons. Lightweight, so no mobile bottom-sheet is needed anymore.
 */
function ScreeningChecks({
  stages,
  currentCode,
  currentId,
  screeningAnswers,
}: {
  stages: { code: ApplicationStatus['code']; name: string; id: string }[]
  currentCode: ApplicationStatus['code']
  currentId: string
  screeningAnswers: StageContextualBlockProps['screeningAnswers']
}) {
  const t = useTranslations()
  const hasScreeningData = screeningAnswers.length > 0
  const flagCount = screeningAnswers.filter((a) => a.isFlag).length
  // Only show answers that actually have a value — no empty "—" cards (#6).
  const answered = screeningAnswers.filter((a) => (a.answerValue ?? '').trim() !== '')
  // yes/no answers are stored as the literal "yes"/"no" — localize them (#N4b).
  const localizeYesNo = (answerType: string, v: string | null): string => {
    if (!v) return '—'
    if (answerType !== 'yes_no') return v
    const low = v.trim().toLowerCase()
    return low === 'yes' ? t('common.yes') : low === 'no' ? t('common.no') : v
  }
  // "All clear" (green) is only truthful when the candidate actually answered
  // apply-form screening questions and none were flagged. A manually-added
  // candidate has no answers to check → neutral "No screening data" (#6).
  const allClear = hasScreeningData && flagCount === 0

  return (
    <article className="space-y-3.5 rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]">
      <StageTracker stages={stages} currentCode={currentCode} currentId={currentId} compact />

      <header className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-bold text-foreground">
          {t('stageBlock.screeningChecks')}
          {hasScreeningData && (
            <span className="ml-2 text-[12px] font-normal text-muted-foreground">
              {t('stageBlock.autoFlagged')}
            </span>
          )}
        </h3>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold',
            !hasScreeningData
              ? 'bg-[oklch(0.95_0.005_250)] text-muted-foreground'
              : allClear
                ? 'bg-[oklch(0.93_0.06_155)] text-[oklch(0.4_0.13_150)]'
                : 'bg-[oklch(0.97_0.03_70)] text-[oklch(0.45_0.12_55)]',
          )}
        >
          {!hasScreeningData
            ? t('stageBlock.noScreeningData')
            : allClear
              ? t('stageBlock.allClear')
              : t('stageBlock.flagCount', { count: flagCount })}
        </span>
      </header>

      {!hasScreeningData && (
        <p className="rounded-[10px] border border-dashed border-[oklch(0.9_0.01_250)] bg-[oklch(0.985_0.002_247)] px-3 py-2.5 text-[12px] text-muted-foreground">
          {t('stageBlock.noScreeningDataHint')}
        </p>
      )}

      {/* The candidate's actual apply-form screening answers (empty ones hidden).
          A knockout-failed answer is highlighted amber with the expected value. */}
      {answered.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {answered.map((ans, idx) => (
            <AnswerCard
              key={idx}
              label={ans.questionLabel}
              value={localizeYesNo(ans.answerType, ans.answerValue)}
              flagged={ans.isFlag}
              expectedNote={
                ans.isFlag && ans.expectedAnswer
                  ? t('stageBlock.expected', { answer: localizeYesNo(ans.answerType, ans.expectedAnswer) })
                  : null
              }
            />
          ))}
        </div>
      )}

      {/* No manual decision here — the stage move is the decision. */}
      <p className="rounded-[10px] border border-dashed border-[oklch(0.9_0.01_250)] bg-[oklch(0.985_0.002_247)] px-3 py-2.5 text-[12px] text-muted-foreground">
        {t.rich('stageBlock.screenHint', {
          advance: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
          reject: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
        })}
      </p>
    </article>
  )
}

/** One screening question + answer. Green for a normal answer, amber when the
 * answer failed a knockout condition (with the expected value below). */
function AnswerCard({
  label,
  value,
  flagged,
  expectedNote,
}: {
  label: string
  value: string
  flagged: boolean
  expectedNote: string | null
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2',
        flagged
          ? 'border-[oklch(0.86_0.07_70)] bg-[oklch(0.985_0.03_70)]'
          : 'border-[oklch(0.9_0.06_150)] bg-[oklch(0.985_0.02_150)]',
      )}
    >
      <div className="flex items-center gap-1.5">
        {flagged && (
          <AlertTriangle className="h-3 w-3 shrink-0" style={{ color: 'oklch(0.5 0.12 60)' }} aria-hidden />
        )}
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
      <p className="text-[12.5px] font-semibold text-foreground">{value}</p>
      {expectedNote && <p className="mt-0.5 text-[11px] text-muted-foreground">{expectedNote}</p>}
    </div>
  )
}

function InterviewState({
  applicationId,
  vacancyId,
  vacancyTitle,
  candidateName,
  stages,
  currentCode,
  currentId,
  upcomingInterview,
  evaluation,
}: {
  applicationId: string
  vacancyId: string
  vacancyTitle: string
  candidateName: string
  stages: { code: ApplicationStatus['code']; name: string; id: string }[]
  currentCode: ApplicationStatus['code']
  currentId: string
  upcomingInterview: StageContextualBlockProps['upcomingInterview']
  evaluation: StageContextualBlockProps['evaluation']
}) {
  const t = useTranslations()
  const [scoreOpen, setScoreOpen] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const hasScorecard = !!evaluation?.submitted
  const recLabelKey = evaluation?.recommendation
    ? REC_LABEL_KEY[evaluation.recommendation]
    : undefined
  const typeLabelKey =
    upcomingInterview?.type === 'video'
      ? 'interviews.form.typeVideo'
      : upcomingInterview?.type === 'phone'
        ? 'interviews.form.typePhone'
        : 'interviews.form.typeOnsite'
  return (
    <article className="space-y-3 rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]">
      <StageTracker stages={stages} currentCode={currentCode} currentId={currentId} compact />

      {upcomingInterview ? (
        <div className="flex items-center gap-3 rounded-[10px] border border-[oklch(0.91_0.04_300)] bg-[oklch(0.985_0.015_300)] px-3.5 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[oklch(0.9_0.03_300)] bg-white">
            {upcomingInterview.type === 'video' ? (
              <Video className="h-4 w-4 text-[oklch(0.45_0.15_300)]" aria-hidden />
            ) : (
              <Calendar className="h-4 w-4 text-[oklch(0.45_0.15_300)]" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-foreground">
              {t('stageBlock.typeInterview', { type: t(typeLabelKey) })}
            </p>
            <p className="text-[11.5px] text-muted-foreground">
              {format(new Date(upcomingInterview.scheduledAt), "MMM d · HH:mm")} ·{' '}
              {t('interviews.form.minutes', { count: upcomingInterview.durationMinutes })}
            </p>
          </div>
          {upcomingInterview.meetingLink && (
            <a
              href={upcomingInterview.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-[oklch(0.93_0.06_300)] px-3 py-1.5 text-[12px] font-semibold text-[oklch(0.45_0.15_300)] hover:bg-[oklch(0.9_0.07_300)]"
            >
              {t('interviews.join')} <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </div>
      ) : (
        <div className="rounded-[10px] border border-dashed border-[oklch(0.9_0.04_300)] bg-[oklch(0.985_0.015_300)] px-3.5 py-3 text-center text-[12.5px] text-muted-foreground">
          {t('stageBlock.noInterviewYet')}
        </div>
      )}

      {/* The recruiter's own submitted scorecard, so their estimation is
          visible here after submitting (not just re-openable in the modal). */}
      {hasScorecard && (
        <div className="rounded-[10px] border border-[oklch(0.9_0.06_150)] bg-[oklch(0.985_0.02_150)] px-3.5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-foreground">{t('stageBlock.yourScorecard')}</p>
            <div className="flex items-center gap-2">
              {recLabelKey && (
                <span className="rounded border border-[oklch(0.88_0.05_150)] bg-white px-1.5 py-0.5 text-[11px] font-semibold text-foreground">
                  {t(recLabelKey)}
                </span>
              )}
              {typeof evaluation?.score === 'number' && (
                <span className="text-[12px] font-bold text-[oklch(0.38_0.14_150)]">
                  {t('scoreModal.fitPercent', { score: evaluation.score })}
                </span>
              )}
            </div>
          </div>
          {evaluation?.reason && (
            <p className="mt-1 text-[12px] text-muted-foreground">{evaluation.reason}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => setScoreOpen(true)}
          className="gap-1.5 bg-[oklch(0.55_0.18_250)] text-white hover:bg-[oklch(0.5_0.18_250)]"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {hasScorecard ? t('stageBlock.editScorecard') : t('stageBlock.addScorecard')}
        </Button>
        {/* Reschedule only makes sense when there's an interview to move (#N13).
            Opens a reschedule dialog in place — no more blank new-interview
            page that ignored the interview (#N15). */}
        {upcomingInterview && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setRescheduleOpen(true)}
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden />
            {t('stageBlock.reschedule')}
          </Button>
        )}
      </div>

      <p className="text-[11.5px] text-muted-foreground">
        {t('stageBlock.scoreHint')}
      </p>

      <AssessmentSheet
        applicationId={applicationId}
        vacancyId={vacancyId}
        vacancyTitle={vacancyTitle}
        candidateName={candidateName}
        open={scoreOpen}
        onOpenChange={setScoreOpen}
      />

      {upcomingInterview && (
        <RescheduleInterviewDialog
          open={rescheduleOpen}
          onOpenChange={setRescheduleOpen}
          interviewId={upcomingInterview.id}
          scheduledAt={upcomingInterview.scheduledAt}
          durationMinutes={upcomingInterview.durationMinutes}
          candidateHasEmail
        />
      )}
    </article>
  )
}

/**
 * Offer state — inline Create-offer form. Reuses the existing offer server
 * actions (createOffer + sendOffer / Public Offer accept-decline flow). The
 * role title defaults to the vacancy; compensation + dates are optional, offer
 * details are required. Save draft persists; Save & send also emails the
 * candidate their accept/decline link. Created offers then appear in the full
 * OfferPanel below (this is the quick-create entry point).
 */
function OfferState({
  applicationId,
  vacancyTitle,
  offers,
  stages,
  currentCode,
  currentId,
}: {
  applicationId: string
  vacancyTitle: string
  offers: OfferRow[]
  stages: { code: ApplicationStatus['code']; name: string; id: string }[]
  currentCode: ApplicationStatus['code']
  currentId: string
}) {
  const t = useTranslations()
  const router = useRouter()
  // Editing an existing DRAFT happens inline in this SAME form (pre-filled),
  // not the modal popup — consistent with creating the first offer (#N14).
  const draftOffer = offers.find((o) => o.status === 'draft') ?? null
  const [amount, setAmount] = useState(
    draftOffer?.compensation_amount != null ? String(draftOffer.compensation_amount) : '',
  )
  const [currency, setCurrency] = useState(draftOffer?.compensation_currency ?? 'USD')
  const [startDate, setStartDate] = useState(draftOffer?.start_date ?? '')
  const [expiryDate, setExpiryDate] = useState(draftOffer?.expiry_date ?? '')
  const [body, setBody] = useState(draftOffer?.body ?? '')
  const [pending, startTransition] = useTransition()

  const submit = (send: boolean) => {
    if (!body.trim()) {
      toast.error(t('stageBlock.errOfferDetails'))
      return
    }
    const input = {
      role_title: vacancyTitle.trim() || t('stageBlock.theRole'),
      body: body.trim(),
      recruiter_message: draftOffer?.recruiter_message ?? null,
      compensation_amount: amount.trim() ? Number(amount) : null,
      compensation_currency: currency.trim() ? currency.trim().toUpperCase() : null,
      compensation_period: draftOffer?.compensation_period ?? null,
      start_date: startDate || null,
      expiry_date: expiryDate || null,
    }
    startTransition(async () => {
      let offerId: string
      if (draftOffer) {
        const result = await updateOffer(draftOffer.id, input)
        if (!result.success) {
          toast.error(result.error)
          return
        }
        offerId = draftOffer.id
      } else {
        const result = await createOffer(applicationId, input)
        if (!result.success) {
          toast.error(result.error)
          return
        }
        offerId = result.data.id
      }
      if (send) {
        const sent = await sendOffer(offerId)
        if (!sent.success) {
          toast.error(sent.error)
          return
        }
        toast.success(t('stageBlock.offerSent'))
      } else {
        toast.success(t('stageBlock.offerSavedDraft'))
      }
      router.refresh()
    })
  }

  // A SENT offer shows the persistent OfferPanel (status, copy link, withdraw) —
  // sent offers can't be edited inline. A DRAFT falls through to the inline form
  // below, pre-filled, so editing a draft matches creating one (#N14).
  const sentOffer = offers.find((o) => o.status === 'sent')
  if (sentOffer) {
    return (
      <article className="space-y-3.5 rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]">
        <StageTracker stages={stages} currentCode={currentCode} currentId={currentId} compact />
        <OfferPanel
          applicationId={applicationId}
          vacancyTitle={vacancyTitle}
          offers={offers}
          canEdit
        />
      </article>
    )
  }

  // Offer accepted (no live offer) → the candidate said yes. Show it clearly and
  // let the recruiter make the FINAL hire a deliberate step (#N8).
  const acceptedOffer = offers.find((o) => o.status === 'accepted')
  if (acceptedOffer) {
    return (
      <AcceptedOfferState
        applicationId={applicationId}
        vacancyTitle={vacancyTitle}
        offers={offers}
        stages={stages}
        currentCode={currentCode}
        currentId={currentId}
      />
    )
  }

  return (
    <article className="space-y-3.5 rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]">
      <StageTracker stages={stages} currentCode={currentCode} currentId={currentId} compact />

      <header>
        <h3 className="text-[15px] font-bold text-foreground">
          {draftOffer ? t('offer.editDraft') : t('stageBlock.createOffer')}
          <span className="ml-2 text-[12px] font-normal text-muted-foreground">· {vacancyTitle}</span>
        </h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {t('stageBlock.createOfferHint')}
        </p>
      </header>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="of-amount" className="text-[12px]">{t('stageBlock.compensation')}</Label>
          <Input
            id="of-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder={t('stageBlock.compensationPlaceholder')}
            disabled={pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="of-currency" className="text-[12px]">{t('stageBlock.currency')}</Label>
          <Input
            id="of-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={4}
            placeholder="USD"
            disabled={pending}
          />
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="of-start" className="text-[12px]">{t('stageBlock.startDate')}</Label>
          <DatePicker
            value={startDate || null}
            onChange={(v) => setStartDate(v ?? '')}
            placeholder={t('common.dateFormat')}
            disabled={pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="of-expiry" className="text-[12px]">{t('stageBlock.respondByDate')}</Label>
          <DatePicker
            value={expiryDate || null}
            onChange={(v) => setExpiryDate(v ?? '')}
            placeholder={t('common.dateFormat')}
            disabled={pending}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="of-body" className="text-[12px]">{t('stageBlock.offerDetails')}</Label>
        <Textarea
          id="of-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={20000}
          placeholder={t('stageBlock.offerDetailsPlaceholder')}
          disabled={pending}
          className="text-[12.5px]"
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => submit(false)}
          disabled={pending}
          className="gap-1.5"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {t('stageBlock.saveDraft')}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => submit(true)}
          disabled={pending}
          className="gap-1.5 bg-[oklch(0.55_0.18_250)] text-white hover:bg-[oklch(0.5_0.18_250)]"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {t('stageBlock.saveSend')}
        </Button>
      </div>

      {/* Past (closed) offers, read-only — so a re-offer keeps the declined /
          withdrawn history in view without the create modal. Excludes the draft
          being edited above (it's not "history"). */}
      {offers.some((o) => o.id !== draftOffer?.id) && (
        <div className="border-t border-[oklch(0.92_0.01_250)] pt-3.5">
          <OfferPanel
            applicationId={applicationId}
            vacancyTitle={vacancyTitle}
            offers={offers.filter((o) => o.id !== draftOffer?.id)}
            canEdit={false}
          />
        </div>
      )}
    </article>
  )
}

/**
 * Offer-accepted state — the candidate accepted, but the hire is NOT automatic
 * (#N8). Shows a clear "Offer accepted" banner + the offer summary, and a
 * "Mark as Hired" button so the recruiter finalizes the hire deliberately.
 */
function AcceptedOfferState({
  applicationId,
  vacancyTitle,
  offers,
  stages,
  currentCode,
  currentId,
}: {
  applicationId: string
  vacancyTitle: string
  offers: OfferRow[]
  stages: { code: ApplicationStatus['code']; name: string; id: string }[]
  currentCode: ApplicationStatus['code']
  currentId: string
}) {
  const t = useTranslations()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const hire = () => {
    startTransition(async () => {
      const result = await markApplicationHired(applicationId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(t('stageBlock.markedHired'))
      router.refresh()
    })
  }

  return (
    <article className="space-y-3.5 rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]">
      <StageTracker stages={stages} currentCode={currentCode} currentId={currentId} compact />

      <div className="rounded-[10px] border border-[oklch(0.86_0.06_155)] bg-[oklch(0.97_0.04_155)] px-3.5 py-3">
        <p className="text-[13.5px] font-bold text-[oklch(0.36_0.13_150)]">
          {t('stageBlock.offerAccepted')} <span aria-hidden>🎉</span>
        </p>
        <p className="mt-0.5 text-[12px] text-[oklch(0.4_0.08_150)]">
          {t('stageBlock.offerAcceptedHint')}
        </p>
      </div>

      <OfferPanel
        applicationId={applicationId}
        vacancyTitle={vacancyTitle}
        offers={offers}
        canEdit={false}
      />

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={hire}
          disabled={pending}
          className="gap-1.5 bg-[oklch(0.55_0.16_150)] text-white hover:bg-[oklch(0.5_0.16_150)]"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {t('stageBlock.markHired')}
        </Button>
      </div>
    </article>
  )
}

function DefaultStateCard({
  stages,
  currentCode,
  currentId,
  stageName,
}: {
  stages: { code: ApplicationStatus['code']; name: string; id: string }[]
  currentCode: ApplicationStatus['code']
  currentId: string
  stageName: string
}) {
  const t = useTranslations()
  return (
    <article className="space-y-3 rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]">
      <StageTracker stages={stages} currentCode={currentCode} currentId={currentId} compact />
      <p className="text-[13px] text-muted-foreground">
        {t.rich('stageBlock.defaultState', {
          name: statusLabel(t, currentCode, stageName),
          stage: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
        })}
      </p>
    </article>
  )
}
