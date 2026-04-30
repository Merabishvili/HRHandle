'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { GripVertical, Building2, Briefcase } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface CandidateCardProps {
  applicationId: string
  candidateId: string
  firstName: string
  lastName: string
  currentPosition: string | null
  currentCompany: string | null
  lastStatusChangedAt: string | null
  appliedAt: string
}

export function CandidateCard({
  applicationId,
  candidateId,
  firstName,
  lastName,
  currentPosition,
  currentCompany,
  lastStatusChangedAt,
  appliedAt,
}: CandidateCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: applicationId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase()
  const sinceDate = lastStatusChangedAt || appliedAt
  const daysInStage = formatDistanceToNow(new Date(sinceDate), { addSuffix: false })

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="border-border bg-background shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <button
              {...attributes}
              {...listeners}
              className="mt-0.5 cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {initials}
                </div>
                <Link
                  href={`/candidates/${candidateId}`}
                  className="truncate text-sm font-medium text-foreground hover:underline"
                >
                  {firstName} {lastName}
                </Link>
              </div>

              {(currentPosition || currentCompany) && (
                <div className="mt-1.5 space-y-0.5">
                  {currentPosition && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Briefcase className="h-3 w-3 shrink-0" />
                      <span className="truncate">{currentPosition}</span>
                    </div>
                  )}
                  {currentCompany && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3 shrink-0" />
                      <span className="truncate">{currentCompany}</span>
                    </div>
                  )}
                </div>
              )}

              <p className="mt-2 text-[11px] text-muted-foreground/60">
                {daysInStage} in stage
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
