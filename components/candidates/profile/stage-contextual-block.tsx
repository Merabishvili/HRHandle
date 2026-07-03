'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  Briefcase,
  Clock,
  MapPin,
  Video,
  Calendar,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  Loader2,
  Save,
  Send,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createOffer, sendOffer } from '@/lib/actions/offers'
import type { ApplicationStatus } from '@/lib/types/application'
import { StageTracker } from './stage-tracker'
import { ScoreCandidateModal } from './score-candidate-modal'

export interface StageContextualBlockProps {
  applicationId: string
  vacancyTitle: string
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
  /** Wave 2.5 Slice 2b — knockout-flagged screening answers on this
   * application. Rendered as a small "Screening flags" callout on the
   * Screening stage so the recruiter sees which questions the candidate
   * fell short on before they decide whether to advance. */
  screeningFlags: {
    questionLabel: string
    answerValue: string | null
    expectedAnswer: string | null
  }[]
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
  vacancyTitle,
  stages,
  currentStage,
  candidate,
  upcomingInterview,
  screeningFlags,
}: StageContextualBlockProps) {
  switch (currentStage.code) {
    case 'screening':
      return (
        <ScreeningChecks
          stages={stages}
          currentCode={currentStage.code}
          candidate={candidate}
          screeningFlags={screeningFlags}
        />
      )
    case 'interview':
      return (
        <InterviewState
          applicationId={applicationId}
          vacancyTitle={vacancyTitle}
          stages={stages}
          currentCode={currentStage.code}
          upcomingInterview={upcomingInterview}
        />
      )
    case 'offer':
      return (
        <OfferState
          applicationId={applicationId}
          vacancyTitle={vacancyTitle}
          stages={stages}
          currentCode={currentStage.code}
        />
      )
    default:
      return (
        <DefaultStateCard
          stages={stages}
          currentCode={currentStage.code}
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
  candidate,
  screeningFlags,
}: {
  stages: { code: ApplicationStatus['code']; name: string; id: string }[]
  currentCode: ApplicationStatus['code']
  candidate: StageContextualBlockProps['candidate']
  screeningFlags: StageContextualBlockProps['screeningFlags']
}) {
  const flagCount = screeningFlags.length
  const allClear = flagCount === 0

  return (
    <article className="space-y-3.5 rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]">
      <StageTracker stages={stages} currentCode={currentCode} compact />

      <header className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-bold text-foreground">
          Screening checks
          <span className="ml-2 text-[12px] font-normal text-muted-foreground">
            · auto-flagged from the apply form
          </span>
        </h3>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold',
            allClear
              ? 'bg-[oklch(0.93_0.06_155)] text-[oklch(0.4_0.13_150)]'
              : 'bg-[oklch(0.97_0.03_70)] text-[oklch(0.45_0.12_55)]',
          )}
        >
          {allClear ? 'All clear' : `${flagCount} flag${flagCount === 1 ? '' : 's'}`}
        </span>
      </header>

      {/* Read-only info chips pulled from the candidate profile. */}
      <div className="grid gap-2 sm:grid-cols-3">
        <GateCard icon={Briefcase} label="Salary expectation" value={candidate.salaryExpectation ?? '—'} />
        <GateCard icon={Clock} label="Notice period" value={candidate.noticePeriod ?? '—'} />
        <GateCard icon={MapPin} label="Location" value={candidate.location ?? '—'} />
      </div>

      {flagCount > 0 && (
        <div
          className="rounded-[10px] border px-3 py-2.5"
          style={{
            borderColor: 'oklch(0.86 0.07 70)',
            background: 'oklch(0.985 0.03 70)',
          }}
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <AlertTriangle
              className="h-3.5 w-3.5"
              style={{ color: 'oklch(0.5 0.12 60)' }}
              aria-hidden
            />
            <p className="text-[12px] font-bold" style={{ color: 'oklch(0.4 0.08 55)' }}>
              Knockout flags ({flagCount})
            </p>
          </div>
          <ul className="space-y-1.5">
            {screeningFlags.map((flag, idx) => (
              <li key={idx} className="text-[12px] text-foreground/85">
                <span className="font-semibold">{flag.questionLabel}:</span>{' '}
                <span className="text-foreground/70">{flag.answerValue || '—'}</span>
                {flag.expectedAnswer && (
                  <span className="text-muted-foreground"> (expected: {flag.expectedAnswer})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* No manual decision here — the stage move is the decision. */}
      <p className="rounded-[10px] border border-dashed border-[oklch(0.9_0.01_250)] bg-[oklch(0.985_0.002_247)] px-3 py-2.5 text-[12px] text-muted-foreground">
        No manual yes/no here — to screen in, use{' '}
        <span className="font-semibold text-foreground">Advance</span>; to screen out, use{' '}
        <span className="font-semibold text-foreground">Reject</span> (right).
      </p>
    </article>
  )
}

function GateCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[oklch(0.9_0.06_150)] bg-[oklch(0.985_0.02_150)] px-3 py-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-[oklch(0.42_0.14_150)]" aria-hidden />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="truncate text-[12.5px] font-semibold text-foreground">{value}</p>
      </div>
    </div>
  )
}

function InterviewState({
  applicationId,
  vacancyTitle,
  stages,
  currentCode,
  upcomingInterview,
}: {
  applicationId: string
  vacancyTitle: string
  stages: { code: ApplicationStatus['code']; name: string; id: string }[]
  currentCode: ApplicationStatus['code']
  upcomingInterview: StageContextualBlockProps['upcomingInterview']
}) {
  const [scoreOpen, setScoreOpen] = useState(false)
  return (
    <article className="space-y-3 rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]">
      <StageTracker stages={stages} currentCode={currentCode} compact />

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
              <span className="capitalize">{upcomingInterview.type}</span> interview
            </p>
            <p className="text-[11.5px] text-muted-foreground">
              {format(new Date(upcomingInterview.scheduledAt), "MMM d · HH:mm")} ·{' '}
              {upcomingInterview.durationMinutes} min
            </p>
          </div>
          {upcomingInterview.meetingLink && (
            <a
              href={upcomingInterview.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-[oklch(0.93_0.06_300)] px-3 py-1.5 text-[12px] font-semibold text-[oklch(0.45_0.15_300)] hover:bg-[oklch(0.9_0.07_300)]"
            >
              Join <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </div>
      ) : (
        <div className="rounded-[10px] border border-dashed border-[oklch(0.9_0.04_300)] bg-[oklch(0.985_0.015_300)] px-3.5 py-3 text-center text-[12.5px] text-muted-foreground">
          No interview scheduled yet for this application.
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
          Add full scorecard
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href={`/interviews/new?reschedule=${upcomingInterview?.id ?? ''}`}>
            <Calendar className="h-3.5 w-3.5" aria-hidden />
            Reschedule
          </Link>
        </Button>
      </div>

      <p className="text-[11.5px] text-muted-foreground">
        Score this candidate against the role&apos;s scorecard — the average of the 1–5 ratings
        becomes the fit score on the kanban.
      </p>

      <ScoreCandidateModal
        applicationId={applicationId}
        vacancyTitle={vacancyTitle}
        open={scoreOpen}
        onOpenChange={setScoreOpen}
      />
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
  stages,
  currentCode,
}: {
  applicationId: string
  vacancyTitle: string
  stages: { code: ApplicationStatus['code']; name: string; id: string }[]
  currentCode: ApplicationStatus['code']
}) {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [startDate, setStartDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [body, setBody] = useState('')
  const [pending, startTransition] = useTransition()

  const submit = (send: boolean) => {
    if (!body.trim()) {
      toast.error('Add the offer details before saving.')
      return
    }
    startTransition(async () => {
      const result = await createOffer(applicationId, {
        role_title: vacancyTitle.trim() || 'the role',
        body: body.trim(),
        recruiter_message: null,
        compensation_amount: amount.trim() ? Number(amount) : null,
        compensation_currency: currency.trim() ? currency.trim().toUpperCase() : null,
        compensation_period: null,
        start_date: startDate || null,
        expiry_date: expiryDate || null,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      if (send) {
        const sent = await sendOffer(result.data.id)
        if (!sent.success) {
          toast.error(sent.error)
          return
        }
        toast.success('Offer sent to candidate.')
      } else {
        toast.success('Offer saved as draft.')
      }
      setAmount('')
      setBody('')
      setStartDate('')
      setExpiryDate('')
      router.refresh()
    })
  }

  return (
    <article className="space-y-3.5 rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]">
      <StageTracker stages={stages} currentCode={currentCode} compact />

      <header>
        <h3 className="text-[15px] font-bold text-foreground">
          Create offer
          <span className="ml-2 text-[12px] font-normal text-muted-foreground">· {vacancyTitle}</span>
        </h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Sends the candidate an accept/decline link. Compensation and dates are optional.
        </p>
      </header>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="of-amount" className="text-[12px]">Compensation</Label>
          <Input
            id="of-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. 95000"
            disabled={pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="of-currency" className="text-[12px]">Currency</Label>
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
          <Label htmlFor="of-start" className="text-[12px]">Start date</Label>
          <Input
            id="of-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="of-expiry" className="text-[12px]">Respond-by date</Label>
          <Input
            id="of-expiry"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            disabled={pending}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="of-body" className="text-[12px]">Offer details</Label>
        <Textarea
          id="of-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={20000}
          placeholder="Benefits, equity, signing bonus, vacation, remote/hybrid, reporting line — anything the candidate needs to know. Line breaks are preserved."
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
          Save draft
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => submit(true)}
          disabled={pending}
          className="gap-1.5 bg-[oklch(0.55_0.18_250)] text-white hover:bg-[oklch(0.5_0.18_250)]"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Save &amp; send
        </Button>
      </div>
    </article>
  )
}

function DefaultStateCard({
  stages,
  currentCode,
  stageName,
}: {
  stages: { code: ApplicationStatus['code']; name: string; id: string }[]
  currentCode: ApplicationStatus['code']
  stageName: string
}) {
  return (
    <article className="space-y-3 rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]">
      <StageTracker stages={stages} currentCode={currentCode} compact />
      <p className="text-[13px] text-muted-foreground">
        Application is in the <span className="font-semibold text-foreground">{stageName}</span> stage.
        Use the right-rail actions to advance, schedule, or close it.
      </p>
    </article>
  )
}
