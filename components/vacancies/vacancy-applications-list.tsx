'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { VacancyApplicationRow } from './vacancy-application-row'

interface AppStatus {
  id: string
  name: string
  code: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected' | 'withdrawn'
}

interface GeneralStatus {
  id: string
  name: string
  code: 'active' | 'hired' | 'archived'
}

interface ApplicationItem {
  id: string
  candidateId: string
  candidateName: string
  initials: string
  appliedAt: string
  statusId: string | null
  generalStatus: GeneralStatus | null
}

interface Props {
  applications: ApplicationItem[]
  allStatuses: AppStatus[]
}

export function VacancyApplicationsList({ applications: initial, allStatuses }: Props) {
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
              onRemoved={(id) => setApplications((prev) => prev.filter((a) => a.id !== id))}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
