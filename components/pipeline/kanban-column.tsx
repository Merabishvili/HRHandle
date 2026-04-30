'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CandidateCard } from './candidate-card'
import type { ApplicationStatus } from '@/lib/types/application'
import { APPLICATION_STATUS_COLORS } from '@/lib/types/application'
import { cn } from '@/lib/utils'

interface PipelineApplication {
  id: string
  candidate_id: string
  first_name: string
  last_name: string
  current_position: string | null
  current_company: string | null
  last_status_changed_at: string | null
  applied_at: string
}

interface KanbanColumnProps {
  status: ApplicationStatus
  applications: PipelineApplication[]
  isOver: boolean
}

export function KanbanColumn({ status, applications, isOver }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: status.id })

  return (
    <div className="flex w-64 shrink-0 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-medium',
              APPLICATION_STATUS_COLORS[status.code]
            )}
          >
            {status.name}
          </span>
          <span className="text-xs text-muted-foreground">{applications.length}</span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[120px] flex-col gap-2 rounded-xl border-2 border-dashed p-2 transition-colors',
          isOver
            ? 'border-primary/50 bg-primary/5'
            : 'border-border/50 bg-muted/30'
        )}
      >
        <SortableContext
          items={applications.map((a) => a.id)}
          strategy={verticalListSortingStrategy}
        >
          {applications.map((app) => (
            <CandidateCard
              key={app.id}
              applicationId={app.id}
              candidateId={app.candidate_id}
              firstName={app.first_name}
              lastName={app.last_name}
              currentPosition={app.current_position}
              currentCompany={app.current_company}
              lastStatusChangedAt={app.last_status_changed_at}
              appliedAt={app.applied_at}
            />
          ))}
        </SortableContext>

        {applications.length === 0 && (
          <p className="flex flex-1 items-center justify-center text-xs text-muted-foreground/50">
            Drop here
          </p>
        )}
      </div>
    </div>
  )
}
