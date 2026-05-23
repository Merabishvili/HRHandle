'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { VacancyApplicationRow } from './vacancy-application-row'
import type { RejectionReason, RejectionTemplate } from '@/components/pipeline/rejection-dialog'

import type {
  ApplicationStatusOption as AppStatus,
  CandidateStatusOption as GeneralStatus,
} from '@/lib/types/database'

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

interface ApplicationItem {
  id: string
  candidateId: string
  candidateName: string
  initials: string
  appliedAt: string
  statusId: string | null
  generalStatus: GeneralStatus | null
  existingEvaluation: ExistingEvaluation | null
}

interface Props {
  applications: ApplicationItem[]
  allStatuses: AppStatus[]
  rejectionReasons: RejectionReason[]
  rejectionTemplates: RejectionTemplate[]
  vacancyId: string
  questions: Question[]
}

export function VacancyApplicationsList({
  applications: initial,
  allStatuses,
  rejectionReasons,
  rejectionTemplates,
  vacancyId,
  questions,
}: Props) {
  const [applications, setApplications] = useState(initial)

  if (applications.length === 0) return null

  return (
    <Card className="border-border">
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {applications.map((app) => (
            <VacancyApplicationRow
              key={app.id}
              applicationId={app.id}
              candidateId={app.candidateId}
              candidateName={app.candidateName}
              initials={app.initials}
              appliedAt={app.appliedAt}
              currentStatusId={app.statusId}
              generalStatus={app.generalStatus}
              allStatuses={allStatuses}
              rejectionReasons={rejectionReasons}
              rejectionTemplates={rejectionTemplates}
              vacancyId={vacancyId}
              questions={questions}
              existingEvaluation={app.existingEvaluation}
              onRemoved={(id) => setApplications((prev) => prev.filter((a) => a.id !== id))}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
