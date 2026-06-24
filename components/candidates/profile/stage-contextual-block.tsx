'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  Check,
  X,
  Briefcase,
  Clock,
  MapPin,
  Video,
  Calendar,
  ChevronRight,
  ExternalLink,
  Sparkles,
  AlertTriangle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { updateApplicationStatus } from '@/lib/actions/applications'
import type { ApplicationStatus } from '@/lib/types/application'
import { StageTracker } from './stage-tracker'

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
        <ScreeningGateResponsive
          applicationId={applicationId}
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
 * A-12d — Mobile bottom-sheet wrapper for the Screening gate.
 *
 * Per `docs/redesign/mobile/candidate-profile.md`: "Action-heavy forms
 * benefit from the modal-like focus of a bottom sheet." The Screening
 * gate is the heaviest form on the profile (Yes/No + required reason
 * + screening-flags callout + three data cards + Save). On `sm+` we
 * render it inline as before; on mobile we render a compact trigger
 * card and open the full gate in a bottom sheet.
 *
 * The Sheet defers mounting its content until opened, so `ScreeningGate`
 * mounts in exactly one place at any time — no double state. Inline
 * and sheet versions share the same component code below.
 */
function ScreeningGateResponsive({
  applicationId,
  stages,
  currentCode,
  candidate,
  screeningFlags,
}: {
  applicationId: string
  stages: { code: ApplicationStatus['code']; name: string; id: string }[]
  currentCode: ApplicationStatus['code']
  candidate: StageContextualBlockProps['candidate']
  screeningFlags: StageContextualBlockProps['screeningFlags']
}) {
  const flagCount = screeningFlags.length

  return (
    <>
      {/* Inline on sm+ */}
      <div className="hidden sm:block">
        <ScreeningGate
          applicationId={applicationId}
          stages={stages}
          currentCode={currentCode}
          candidate={candidate}
          screeningFlags={screeningFlags}
        />
      </div>

      {/* Compact trigger on mobile; Sheet content mounts on open. */}
      <div className="sm:hidden">
        <Sheet>
          <article className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4">
            <StageTracker stages={stages} currentCode={currentCode} compact />
            <header className="mt-3.5">
              <h3 className="text-[15px] font-bold text-foreground">Screening decision</h3>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Quick gate — is this candidate worth a full interview?
              </p>
            </header>

            {flagCount > 0 && (
              <div
                className="mt-3 flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-[12px]"
                style={{
                  borderColor: 'oklch(0.86 0.07 70)',
                  background: 'oklch(0.985 0.03 70)',
                  color: 'oklch(0.4 0.08 55)',
                }}
              >
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                <span className="font-semibold">
                  {flagCount} screening flag{flagCount === 1 ? '' : 's'}
                </span>
                <span className="text-muted-foreground">— review before deciding</span>
              </div>
            )}

            <SheetTrigger asChild>
              <Button
                type="button"
                className="mt-3.5 w-full gap-1.5 bg-[oklch(0.55_0.18_250)] text-white hover:bg-[oklch(0.5_0.18_250)]"
              >
                Open screening gate
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </SheetTrigger>
          </article>

          <SheetContent
            side="bottom"
            className="max-h-[90vh] overflow-y-auto rounded-t-2xl p-0"
          >
            <SheetHeader className="border-b border-border px-4 py-3">
              <SheetTitle className="text-left text-base font-bold">
                Screening decision
              </SheetTitle>
            </SheetHeader>
            <div className="p-4">
              <ScreeningGate
                applicationId={applicationId}
                stages={stages}
                currentCode={currentCode}
                candidate={candidate}
                screeningFlags={screeningFlags}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}

function ScreeningGate({
  applicationId,
  stages,
  currentCode,
  candidate,
  screeningFlags,
}: {
  applicationId: string
  stages: { code: ApplicationStatus['code']; name: string; id: string }[]
  currentCode: ApplicationStatus['code']
  candidate: StageContextualBlockProps['candidate']
  screeningFlags: StageContextualBlockProps['screeningFlags']
}) {
  const router = useRouter()
  const [decision, setDecision] = useState<'yes' | 'no' | null>(null)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  const interviewStage = stages.find((s) => s.code === 'interview')

  const advance = () => {
    if (!interviewStage) return
    if (!reason.trim()) {
      toast.error('Add a one-line reason before advancing.')
      return
    }
    startTransition(async () => {
      const result = await updateApplicationStatus(applicationId, interviewStage.id)
      if (!result.success) {
        toast.error('Failed to advance — try again.')
        return
      }
      toast.success('Advanced to interview.')
      router.refresh()
    })
  }

  return (
    <article className="space-y-3.5 rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]">
      <StageTracker stages={stages} currentCode={currentCode} compact />

      <header>
        <h3 className="text-[15px] font-bold text-foreground">
          Screening decision
          <span className="ml-2 text-[12px] font-normal text-muted-foreground">
            · quick gate — is this worth a full interview?
          </span>
        </h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Lightweight on purpose. The full <strong className="text-foreground">scorecard</strong>{' '}
          (attributes rated 1–5) appears at the Interview stage.
        </p>
      </header>

      <div className="grid gap-2 sm:grid-cols-3">
        <GateCard icon={Briefcase} label="Salary expectation" value={candidate.salaryExpectation ?? '—'} />
        <GateCard icon={Clock} label="Notice period" value={candidate.noticePeriod ?? '—'} />
        <GateCard icon={MapPin} label="Location" value={candidate.location ?? '—'} />
      </div>

      {screeningFlags.length > 0 && (
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
            <p
              className="text-[12px] font-bold"
              style={{ color: 'oklch(0.4 0.08 55)' }}
            >
              Screening flags ({screeningFlags.length})
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

      <div className="border-t border-[oklch(0.94_0.01_250)] pt-3.5">
        <p className="mb-1.5 text-[12px] font-semibold text-foreground">
          Move to interview? <span className="text-destructive">*</span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDecision('yes')}
            disabled={pending}
            className={cn(
              'flex-1 rounded-lg border px-3 py-2 text-[12.5px] font-bold transition-colors',
              decision === 'yes'
                ? 'border-[oklch(0.8_0.1_150)] bg-[oklch(0.93_0.07_155)] text-[oklch(0.36_0.14_150)]'
                : 'border-[oklch(0.9_0.01_250)] text-foreground hover:bg-muted',
            )}
            aria-pressed={decision === 'yes'}
          >
            <Check className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Yes — interview
          </button>
          <button
            type="button"
            onClick={() => setDecision('no')}
            disabled={pending}
            className={cn(
              'flex-1 rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition-colors',
              decision === 'no'
                ? 'border-[oklch(0.88_0.04_27)] bg-[oklch(0.97_0.03_27)] text-[oklch(0.5_0.19_27)]'
                : 'border-[oklch(0.9_0.01_250)] text-foreground hover:bg-muted',
            )}
            aria-pressed={decision === 'no'}
          >
            <X className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            No — reject
          </button>
        </div>

        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="One-line reason (required)"
          rows={2}
          maxLength={300}
          disabled={pending}
          className="mt-2.5 text-[12.5px]"
        />

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {decision === 'yes' && interviewStage ? (
            <Button
              size="sm"
              onClick={advance}
              disabled={pending || !reason.trim()}
              className="gap-1.5 bg-[oklch(0.55_0.18_250)] text-white hover:bg-[oklch(0.5_0.18_250)]"
            >
              Save &amp; advance to Interview →
            </Button>
          ) : decision === 'no' ? (
            <p className="text-[12px] text-muted-foreground">
              Use the right-rail <span className="font-semibold">Reject</span> button to record the rejection with full template + email.
            </p>
          ) : (
            <p className="text-[11.5px] text-muted-foreground">
              No 1–5 ratings yet — that&apos;s the interview&apos;s job.
            </p>
          )}
        </div>
      </div>
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
  stages,
  currentCode,
  upcomingInterview,
}: {
  applicationId: string
  stages: { code: ApplicationStatus['code']; name: string; id: string }[]
  currentCode: ApplicationStatus['code']
  upcomingInterview: StageContextualBlockProps['upcomingInterview']
}) {
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
        <Button asChild size="sm" className="gap-1.5 bg-[oklch(0.55_0.18_250)] text-white hover:bg-[oklch(0.5_0.18_250)]">
          <Link href={`/vacancies/${stages[0]?.id ? '' : ''}#evaluation-${applicationId}`}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Add full scorecard
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href={`/interviews/new?reschedule=${upcomingInterview?.id ?? ''}`}>
            <Calendar className="h-3.5 w-3.5" aria-hidden />
            Reschedule
          </Link>
        </Button>
      </div>

      <p className="text-[11.5px] text-muted-foreground">
        Full 1–5 scorecard goes here. Its average becomes the fit score on the kanban.
      </p>
    </article>
  )
}

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
  return (
    <article className="space-y-3 rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]">
      <StageTracker stages={stages} currentCode={currentCode} compact />

      <div className="rounded-[10px] border border-[oklch(0.91_0.04_210)] bg-[oklch(0.985_0.012_210)] p-3.5">
        <p className="text-[13px] font-bold text-foreground">
          Create offer · <span className="font-semibold text-muted-foreground">{vacancyTitle}</span>
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Compensation, start date, expiry — send accept/decline link to the candidate.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            asChild
            size="sm"
            className="gap-1.5 bg-[oklch(0.55_0.18_250)] text-white hover:bg-[oklch(0.5_0.18_250)]"
          >
            <Link href={`#offer-${applicationId}`}>
              Build offer →
            </Link>
          </Button>
          <span className="text-[11.5px] text-muted-foreground">
            Inline offer form is on the roadmap — for now the existing offer flow opens below.
          </span>
        </div>
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
