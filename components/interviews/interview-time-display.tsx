'use client'

import { isToday, isTomorrow } from 'date-fns'

interface InterviewTimeDisplayProps {
  scheduledAt: string
  durationMinutes: number
}

export function InterviewTimeDisplay({ scheduledAt, durationMinutes }: InterviewTimeDisplayProps) {
  const date = new Date(scheduledAt)

  let dateLabel: string
  if (isToday(date)) {
    dateLabel = 'Today'
  } else if (isTomorrow(date)) {
    dateLabel = 'Tomorrow'
  } else {
    dateLabel = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="text-right">
      <p className="text-sm font-medium text-foreground">{dateLabel}</p>
      <p className="text-xs text-muted-foreground">{timeStr} ({durationMinutes} min)</p>
    </div>
  )
}
