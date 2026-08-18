'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Briefcase } from 'lucide-react'
import { ApplicationEvaluation } from './application-evaluation'
import type { RejectionReason, RejectionTemplate } from '@/components/pipeline/rejection-dialog'

import type { ApplicationStatusOption as AppStatus } from '@/lib/types/database'

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

interface ApplicationItem {
  id: string
  vacancyId: string
  vacancyTitle: string
  vacancyDepartment: string | null
  appliedAt: string
  appStatus: AppStatus | null
  questions: Question[]
  existingEvaluation: ExistingEvaluation | null
  /** G-016 candidate-facing status page token. Backfilled for historic rows
   * but kept nullable in the type so a missing migration doesn't crash. */
  publicToken: string | null
  /** G-018 offers attached to this application (newest first). */
  offers: OfferRow[]
  canManageOffers: boolean
}

import type { OfferRow } from '@/components/offers/offer-panel'

interface Props {
  candidateId: string
  candidateName: string
  initialApplications: ApplicationItem[]
  allStatuses: AppStatus[]
  rejectionReasons: RejectionReason[]
  rejectionTemplates: RejectionTemplate[]
}

export function CandidateApplicationsList({
  candidateId,
  candidateName,
  initialApplications,
  allStatuses,
  rejectionReasons,
  rejectionTemplates,
}: Props) {
  const t = useTranslations()
  const [applications, setApplications] = useState(initialApplications)

  // Re-sync local state when the server prop changes. Without this, a
  // `router.refresh()` from a child (offer create, etc) re-renders the
  // parent with fresh data, but our local copy keeps the stale snapshot
  // because `useState` only reads its initial value on first mount.
  useEffect(() => {
    setApplications(initialApplications)
  }, [initialApplications])

  if (applications.length === 0) {
    return (
      <div className="py-8 text-center">
        <Briefcase className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">{t('candAppsList.empty')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {applications.map((app) => (
        <ApplicationEvaluation
          key={app.id}
          applicationId={app.id}
          vacancyId={app.vacancyId}
          vacancyTitle={app.vacancyTitle}
          vacancyDepartment={app.vacancyDepartment}
          candidateId={candidateId}
          candidateName={candidateName}
          appliedAt={app.appliedAt}
          appStatus={app.appStatus}
          allStatuses={allStatuses}
          rejectionReasons={rejectionReasons}
          rejectionTemplates={rejectionTemplates}
          questions={app.questions}
          existingEvaluation={app.existingEvaluation}
          publicToken={app.publicToken}
          offers={app.offers}
          canManageOffers={app.canManageOffers}
          onRemoved={(id) => setApplications((prev) => prev.filter((a) => a.id !== id))}
        />
      ))}
    </div>
  )
}
