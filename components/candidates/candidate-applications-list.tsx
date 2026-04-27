'use client'

import { useState } from 'react'
import { Briefcase } from 'lucide-react'
import { ApplicationEvaluation } from './application-evaluation'

interface AppStatus {
  id: string
  name: string
  code: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected' | 'withdrawn'
  sort_order: number
}

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
}

interface Props {
  candidateId: string
  initialApplications: ApplicationItem[]
  allStatuses: AppStatus[]
}

export function CandidateApplicationsList({ candidateId, initialApplications, allStatuses }: Props) {
  const [applications, setApplications] = useState(initialApplications)

  if (applications.length === 0) {
    return (
      <div className="py-8 text-center">
        <Briefcase className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">Not added to any vacancies yet</p>
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
          appliedAt={app.appliedAt}
          appStatus={app.appStatus}
          allStatuses={allStatuses}
          questions={app.questions}
          existingEvaluation={app.existingEvaluation}
          onRemoved={(id) => setApplications((prev) => prev.filter((a) => a.id !== id))}
        />
      ))}
    </div>
  )
}
