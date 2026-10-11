'use client'

import { isToday, isTomorrow } from 'date-fns'
import { useLocale, useTranslations } from 'next-intl'
import { formatInterviewDate, formatInterviewTime } from '@/lib/interviews/format'

interface InterviewTimeDisplayProps {
  scheduledAt: string
  durationMinutes: number
}

export function InterviewTimeDisplay({ scheduledAt, durationMinutes }: InterviewTimeDisplayProps) {
  const t = useTranslations()
  const locale = useLocale()
  const date = new Date(scheduledAt)

  const dateLabel = isToday(date)
    ? t('interviews.group.today')
    : isTomorrow(date)
      ? t('interviews.group.tomorrow')
      : formatInterviewDate(date, locale)

  return (
    <div className="text-left sm:text-right">
      <p className="text-sm font-medium text-foreground">{dateLabel}</p>
      <p className="text-xs text-muted-foreground">
        {formatInterviewTime(date, locale)} ({t('interviews.form.minutes', { count: durationMinutes })})
      </p>
    </div>
  )
}
