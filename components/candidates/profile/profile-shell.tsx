'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { sourceLabel } from '@/lib/pipeline/source-i18n'
import { Pencil, MoreHorizontal, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  RejectionDialog,
  type RejectionReason,
  type RejectionTemplate,
} from '@/components/pipeline/rejection-dialog'
import { DeleteCandidateDialog } from '@/components/candidates/delete-candidate-dialog'
import { AddApplicationDialog } from '@/components/candidates/add-application-dialog'
import { MergeCandidatesDialog } from '@/components/candidates/merge-candidates-dialog'
import { RecentMergeBanner } from '@/components/candidates/profile/recent-merge-banner'
import type { RecentMergeInfo } from '@/lib/actions/candidate-merge'
import { ContactCard } from '@/components/candidates/contact-card'
import { PrevNextNav } from '@/components/ui/prev-next-nav'
import { CandidateDocuments } from '@/components/candidates/candidate-documents'
import { AiNotesExtractor } from '@/components/candidates/ai-notes-extractor'
import { ExperienceSection } from '@/components/candidates/experience-section'
import { EducationSection } from '@/components/candidates/education-section'
import { ActivityFeed, type ActivityItem } from '@/components/candidates/activity-feed'
import { CustomFieldsDisplay } from '@/components/custom-fields/custom-fields-display'
import type { CandidateExperience, CandidateEducation } from '@/lib/types/candidate'
import type { ApplicationStatus } from '@/lib/types/application'
import type { CustomFieldGroupWithFields, CustomFieldValue } from '@/lib/actions/custom-fields'
import type { OfferRow } from '@/components/offers/offer-panel'

import {
  ActiveApplicationSelector,
  type ActiveApplicationOption,
} from './active-application-selector'
import {
  RepeatApplicantBanner,
  type RepeatApplicantSummary,
} from './repeat-applicant-banner'
import { ApplicationHistory, type HistoryRow } from './application-history'
import {
  StageContextualBlock,
  type StageContextualBlockProps,
} from './stage-contextual-block'
import { AiFitCard } from './ai-fit-card'
import { RailActions, RailDetails } from './rail-sections'

interface ProfileShellProps {
  candidate: {
    id: string
    fullName: string
    initials: string
    headlineSubtitle: string | null
    location: string | null
    timezone: string | null
    languages: string[]
    yearsExperience: number | null
    salaryExpectation: string | null
    noticePeriod: string | null
    source: string | null
    addedAt: string
    email: string | null
    phone: string | null
    linkedinUrl: string | null
    currentCompany: string | null
    currentPosition: string | null
    createdAt: string
    updatedAt: string
  }
  organizationId: string
  currentUserId: string
  currentUserName: string | null
  /** Open/draft vacancies the candidate can be added to (excludes ones they
   * are already active on) — feeds the "Add to Vacancy" dialog. */
  availableVacancies: { id: string; title: string; department: string | null }[]
  /** All active (non-terminal) applications for this candidate — the
   * selector + contextual block read from this. */
  activeApplications: {
    id: string
    vacancyId: string
    vacancyTitle: string
    stage: { id: string; code: ApplicationStatus['code']; name: string } | null
  }[]
  /** Offers keyed by application id — the offer-stage block shows the sent
   * offer's summary + actions once one exists. */
  offersByApplication: Record<string, OfferRow[]>
  closedHistoryRows: HistoryRow[]
  repeatSummary: RepeatApplicantSummary
  /** Ordered list of non-terminal application stages — drives the stage
   * tracker and the "advance to next" action. */
  activeStages: { id: string; code: ApplicationStatus['code']; name: string }[]
  /** Map of applicationId → upcoming interview (if any) for the Interview
   * stage variant of the contextual block. */
  upcomingInterviewByApplication: Map<
    string,
    StageContextualBlockProps['upcomingInterview']
  >
  /** Map of applicationId → ALL apply-form screening answers (each marked
   * `isFlag` if it failed a knockout). Empty/missing entry means the candidate
   * has no apply-form data (added manually) → neutral Screening panel (#6). */
  screeningAnswersByApplication: Map<string, StageContextualBlockProps['screeningAnswers']>
  /** The current recruiter's own scorecard per application, shown on the
   * profile after they submit it (#N6). */
  myEvaluationByApplication: Map<string, NonNullable<StageContextualBlockProps['evaluation']>>
  /** Wave 3.1 — whether the org has enabled AI Fit Analysis. */
  aiFitEnabled: boolean
  /** Adjacent candidate ids for prev/next paging (#2), or null at a boundary. */
  prevCandidateId?: string | null
  nextCandidateId?: string | null
  rejectionReasons: RejectionReason[]
  rejectionTemplates: RejectionTemplate[]
  /** The 'rejected' status id from application_statuses — needed by the
   * RejectionDialog. Fetched server-side once and threaded through. */
  rejectedStatusId: string | null
  experienceEntries: CandidateExperience[]
  educationEntries: CandidateEducation[]
  activityItems: ActivityItem[]
  documents: {
    id: string
    file_name: string
    file_size: number
    mime_type: string
    document_type: string
    created_at: string
  }[]
  /** Candidate custom-field schema + values — shown in the rail "Custom fields"
   * card after Details, grouped with per-group counts (#5/6/7). */
  customFieldGroups: CustomFieldGroupWithFields[]
  customFieldValues: CustomFieldValue[]
  /** A-3b — set when this candidate is the surviving record of a merge
   * still inside the 30-day split-back window. */
  recentMerge: RecentMergeInfo | null
}

/**
 * Wave 2.3 candidate profile shell per Candidate Profile A Refined.dc.html.
 *
 * Single client component owning the interactive state (selected active
 * application, history-panel open/close). The server `page.tsx` fetches
 * everything and passes it in flat — this component composes the layout
 * and the seven new sub-components introduced in Wave 2.3.
 *
 * Layout (mirrors the design):
 *   [Outer card]
 *     - Header bar (avatar + name + active-badge + subtitle + Edit / Add / ⋯)
 *     - RepeatApplicantBanner (if any closed apps)
 *     - ApplicationHistory (collapsible)
 *     - ActiveApplicationSelector
 *     - 2-column grid
 *         LEFT:
 *           - StageContextualBlock (changes by current stage)
 *           - ExperienceSection
 *           - EducationSection + ActivityFeed (side-by-side on wide)
 *           - CustomFieldsDisplay (if groups present)
 *         RIGHT RAIL:
 *           - RailActions
 *           - CandidateDocuments
 *           - RailDetails (salary / notice / location / timezone / source / added)
 *           - ContactCard
 *           - RailCustomFields
 *           - AiNotesExtractor
 */
export function CandidateProfileShell({
  candidate,
  prevCandidateId = null,
  nextCandidateId = null,
  organizationId: _organizationId,
  currentUserId,
  currentUserName,
  availableVacancies,
  activeApplications,
  offersByApplication,
  closedHistoryRows,
  repeatSummary,
  activeStages,
  upcomingInterviewByApplication,
  screeningAnswersByApplication,
  myEvaluationByApplication,
  aiFitEnabled,
  rejectionReasons,
  rejectionTemplates,
  rejectedStatusId,
  experienceEntries,
  educationEntries,
  activityItems,
  documents,
  customFieldGroups,
  customFieldValues,
  recentMerge,
}: ProfileShellProps) {
  const t = useTranslations()
  // Default-select the active application closest to a decision (Offer >
  // Interview > Screening > Applied). When tied, take the most recently
  // updated. Empty when there are no live applications.
  const stageOrderIdx = useMemo(() => {
    const map = new Map<string, number>()
    for (let i = 0; i < activeStages.length; i++) map.set(activeStages[i]!.code, i)
    return map
  }, [activeStages])

  const sortedActive = useMemo(() => {
    return [...activeApplications].sort((a, b) => {
      const aIdx = a.stage ? stageOrderIdx.get(a.stage.code) ?? -1 : -1
      const bIdx = b.stage ? stageOrderIdx.get(b.stage.code) ?? -1 : -1
      return bIdx - aIdx
    })
  }, [activeApplications, stageOrderIdx])

  const [selectedAppId, setSelectedAppId] = useState<string | null>(
    sortedActive[0]?.id ?? null,
  )
  const [historyOpen, setHistoryOpen] = useState(false)
  const [pendingRejection, setPendingRejection] = useState<
    { applicationId: string; candidateName: string } | null
  >(null)
  const router = useRouter()
  const [mergeOpen, setMergeOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const selectedApp = useMemo(
    () => activeApplications.find((a) => a.id === selectedAppId) ?? sortedActive[0] ?? null,
    [activeApplications, selectedAppId, sortedActive],
  )

  const nextStage = useMemo(() => {
    if (!selectedApp?.stage) return null
    const currentIdx = activeStages.findIndex((s) => s.code === selectedApp.stage!.code)
    if (currentIdx === -1 || currentIdx >= activeStages.length - 1) return null
    return activeStages[currentIdx + 1] ?? null
  }, [selectedApp, activeStages])

  const selectorOptions: ActiveApplicationOption[] = sortedActive.map((a) => ({
    applicationId: a.id,
    vacancyTitle: a.vacancyTitle,
    stage: a.stage ? { code: a.stage.code, name: a.stage.name } : null,
  }))

  const triggerReject = () => {
    if (!selectedApp) return
    if (!rejectedStatusId) {
      // No 'rejected' status configured on the org — defensive fallback
      // (shouldn't happen on any healthy install).
      return
    }
    setPendingRejection({
      applicationId: selectedApp.id,
      candidateName: candidate.fullName,
    })
  }

  return (
    <main className="mx-auto max-w-[1360px] p-4 lg:p-6">
      {recentMerge && (
        <div className="mb-3">
          <RecentMergeBanner info={recentMerge} />
        </div>
      )}
      <PrevNextNav
        prevHref={prevCandidateId ? `/candidates/${prevCandidateId}` : null}
        nextHref={nextCandidateId ? `/candidates/${nextCandidateId}` : null}
        prevLabel={t('nav.prevCandidate')}
        nextLabel={t('nav.nextCandidate')}
      />
      <article className="overflow-hidden rounded-xl border border-[oklch(0.88_0.01_250)] bg-white shadow-[0_1px_3px_0_oklch(0_0_0_/_0.08)]">
        {/* Header bar */}
        <header className="flex flex-wrap items-center gap-3.5 border-b border-[oklch(0.93_0.01_250)] px-5 py-4 sm:px-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[oklch(0.93_0.04_250)] text-[16px] font-bold text-[oklch(0.45_0.16_250)]">
            {candidate.initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="truncate text-[20px] font-bold text-foreground">
                {candidate.fullName}
              </h1>
              {activeApplications.length > 0 && (
                <span className="rounded-md bg-[oklch(0.95_0.01_250)] px-2 py-0.5 text-[11.5px] font-medium text-foreground/80">
                  {t('profileShell.activeLive', { count: activeApplications.length })}
                </span>
              )}
              {activeApplications.length === 0 && (
                <span className="rounded-md bg-muted px-2 py-0.5 text-[11.5px] font-medium text-muted-foreground">
                  {t('profileShell.noLive')}
                </span>
              )}
            </div>
            {candidate.headlineSubtitle && (
              <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                {candidate.headlineSubtitle}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <AddApplicationDialog
              candidateId={candidate.id}
              availableVacancies={availableVacancies}
              activeApplicationCount={activeApplications.length}
            />
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
              <Link href={`/candidates/${candidate.id}/edit`}>
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                {t('common.edit')}
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  aria-label={t('profileShell.moreActions')}
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => setMergeOpen(true)}>
                  {t('merge.title')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {/* Delete opens a shell-level dialog (not a button nested in the
                    menu) — otherwise closing the menu unmounts the dialog and it
                    flickers away after a moment. */}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                  {t('profileShell.deleteCandidate')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Repeat-applicant banner */}
        {repeatSummary.totalClosed > 0 && (
          <div className="px-5 pt-3.5 sm:px-6">
            <RepeatApplicantBanner
              summary={repeatSummary}
              onToggleHistory={() => setHistoryOpen((v) => !v)}
              historyOpen={historyOpen}
            />
          </div>
        )}

        {/* History — collapsible */}
        {historyOpen && (
          <div className="px-5 pt-3 sm:px-6">
            <ApplicationHistory rows={closedHistoryRows} open={historyOpen} />
          </div>
        )}

        {/* Active application selector */}
        {sortedActive.length > 0 && (
          <div className="px-5 py-3 sm:px-6">
            <ActiveApplicationSelector
              options={selectorOptions}
              selectedId={selectedApp?.id ?? null}
              onSelect={setSelectedAppId}
            />
          </div>
        )}

        {/* Body — flex row (left content + right rail), matching the vacancy
            detail tabs: one gray region, white cards, a gap instead of a
            divider line (#5/6/7). */}
        <div className="flex flex-col gap-5 bg-[oklch(0.985_0.002_247)] p-5 lg:flex-row lg:gap-6 lg:p-6">
          {/* LEFT */}
          <div className="flex min-w-0 flex-1 flex-col gap-3.5">
            {selectedApp && selectedApp.stage && (
              <StageContextualBlock
                applicationId={selectedApp.id}
                vacancyTitle={selectedApp.vacancyTitle}
                offers={offersByApplication[selectedApp.id] ?? []}
                stages={activeStages}
                currentStage={selectedApp.stage}
                candidate={{
                  salaryExpectation: candidate.salaryExpectation,
                  noticePeriod: candidate.noticePeriod,
                  location: candidate.location,
                }}
                upcomingInterview={
                  upcomingInterviewByApplication.get(selectedApp.id) ?? null
                }
                screeningAnswers={screeningAnswersByApplication.get(selectedApp.id) ?? []}
                evaluation={myEvaluationByApplication.get(selectedApp.id) ?? null}
              />
            )}

            {selectedApp && <AiFitCard applicationId={selectedApp.id} enabled={aiFitEnabled} />}

            {!selectedApp && (
              <div className="rounded-xl border border-dashed border-border bg-white p-6 text-center text-[13px] text-muted-foreground">
                {t.rich('profileShell.noLiveHint', { b: (c) => <span className="font-semibold text-foreground">{c}</span> })}
              </div>
            )}

            {/* A-12 — Mobile primary action surface. The desktop right
                rail's RailActions is buried at the bottom of the page on
                mobile (rail stacks after the left column). Render an
                identical RailActions inline here at the top of the
                content on lg- so "Advance to next stage" / Schedule /
                Email / Reject are in thumb-reach. The rail copy below is
                still rendered on lg+ for desktop. */}
            {selectedApp && (
              <div className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-3.5 lg:hidden">
                <RailActions
                  applicationId={selectedApp.id}
                  candidateId={candidate.id}
                  candidateEmail={candidate.email}
                  nextStage={nextStage}
                  onReject={triggerReject}
                />
              </div>
            )}

            <ExperienceSection
              candidateId={candidate.id}
              initialEntries={experienceEntries}
            />

            <EducationSection
              candidateId={candidate.id}
              initialEntries={educationEntries}
            />

            {/* A-12b — On mobile the right rail stacks all the way at the
                bottom, which buries Documents and Contact below the
                Activity feed. Per the design's mobile order
                (`docs/redesign/mobile/candidate-profile.md`), Documents
                and Contact belong near Experience/Education. Render
                them inline here on lg-; the rail copies are
                `hidden lg:block` so desktop still has one of each. */}
            <div className="lg:hidden">
              <CandidateDocuments
                candidateId={candidate.id}
                initialDocuments={documents}
              />
            </div>
            <div className="lg:hidden">
              <ContactCard
                email={candidate.email}
                phone={candidate.phone}
                linkedinUrl={candidate.linkedinUrl}
              />
            </div>

            {/* Custom fields (incl. long text) live in the right rail after
                Details (#6). The rail stacks below the left column on mobile,
                so they surface there — no separate mobile copy needed. */}

            <ActivityFeed
              candidateId={candidate.id}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              initialItems={activityItems}
            />
          </div>

          {/* RIGHT RAIL — white cards on the shared gray region, no divider,
              matching the vacancy detail tabs (#5/6/7). */}
          <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[360px]">
            {/* A-12 — RailActions also renders inline at the top of the
                content on mobile (see lg:hidden block above). Hide this
                duplicate on lg- so the user doesn't see two identical
                Action sections. */}
            {selectedApp && (
              <div className="hidden rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 lg:block">
                <RailActions
                  applicationId={selectedApp.id}
                  candidateId={candidate.id}
                  candidateEmail={candidate.email}
                  nextStage={nextStage}
                  onReject={triggerReject}
                />
              </div>
            )}

            {/* A-12b — Hidden on lg- because a mobile copy renders inline
                between EducationSection and CustomFieldsDisplay. */}
            <div className="hidden lg:block">
              <CandidateDocuments
                candidateId={candidate.id}
                initialDocuments={documents}
              />
            </div>

            {/* #6 — Contact sits ABOVE Details. Hidden on lg- because a mobile
                copy renders inline between Education and the stacked rail. */}
            <div className="hidden lg:block">
              <ContactCard
                email={candidate.email}
                phone={candidate.phone}
                linkedinUrl={candidate.linkedinUrl}
              />
            </div>

            {/* #5/6/7 — Details framed as a card like every other rail section. */}
            <div className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]">
              <RailDetails
                items={[
                  { label: t('candWizard.personal.salaryExpectation'), value: candidate.salaryExpectation ?? '—' },
                  { label: t('candWizard.personal.noticePeriod'), value: candidate.noticePeriod ?? '—' },
                  { label: t('candWizard.personal.location'), value: candidate.location ?? '—' },
                  { label: t('candWizard.personal.timezone'), value: candidate.timezone ?? '—' },
                  { label: t('candWizard.personal.languages'), value: candidate.languages.join(', ') || '—' },
                  { label: t('candWizard.application.sourceLabel'), value: sourceLabel(t, candidate.source) || '—' },
                  { label: t('profileShell.added'), value: new Date(candidate.addedAt).toLocaleDateString() },
                ]}
              />
            </div>

            {/* Custom fields after Details (#6) — each group is its own card,
                short values as rows, long values stacked (#5/6/7). */}
            <CustomFieldsDisplay groups={customFieldGroups} values={customFieldValues} />

            <AiNotesExtractor candidateId={candidate.id} />
          </aside>
        </div>
      </article>

      {pendingRejection && rejectedStatusId && (
        <RejectionDialog
          open={!!pendingRejection}
          applicationId={pendingRejection.applicationId}
          statusId={rejectedStatusId}
          candidateName={pendingRejection.candidateName}
          reasons={rejectionReasons}
          templates={rejectionTemplates}
          onSuccess={() => setPendingRejection(null)}
          onCancel={() => setPendingRejection(null)}
        />
      )}

      <DeleteCandidateDialog
        candidateId={candidate.id}
        candidateName={candidate.fullName}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push('/candidates')}
      />

      <MergeCandidatesDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        winner={{
          id: candidate.id,
          full_name: candidate.fullName,
          email: candidate.email,
          phone: candidate.phone,
          current_company: candidate.currentCompany,
          current_position: candidate.currentPosition,
          linkedin_profile_url: candidate.linkedinUrl,
          source: candidate.source,
          location: candidate.location,
          applications_count: activeApplications.length,
          created_at: candidate.createdAt,
        }}
      />
    </main>
  )
}
