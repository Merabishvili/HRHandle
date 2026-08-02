'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { MoreHorizontal, Calendar, XCircle, UserX, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { updateInterviewStatus, rescheduleInterview } from '@/lib/actions/interviews'

const durationOptions = [
  { value: 30, key: 'interviews.dur30m' },
  { value: 45, key: 'interviews.dur45m' },
  { value: 60, key: 'interviews.dur1h' },
  { value: 90, key: 'interviews.dur90m' },
  { value: 120, key: 'interviews.dur2h' },
]

interface InterviewActionsProps {
  interviewId: string
  currentStatus: string
  scheduledAt: string
  durationMinutes: number
  candidateHasEmail: boolean
}

export function InterviewActions({
  interviewId,
  currentStatus,
  scheduledAt,
  durationMinutes,
  candidateHasEmail,
}: InterviewActionsProps) {
  const router = useRouter()
  const t = useTranslations()
  const [isPending, startTransition] = useTransition()
  const [confirmAction, setConfirmAction] = useState<'cancel' | 'no_show' | 'complete' | null>(null)
  const [showReschedule, setShowReschedule] = useState(false)

  // Convert UTC ISO to local date/time for form fields
  const localScheduled = new Date(scheduledAt)
  const localDateStr = `${localScheduled.getFullYear()}-${String(localScheduled.getMonth() + 1).padStart(2, '0')}-${String(localScheduled.getDate()).padStart(2, '0')}`
  const localTimeStr = `${String(localScheduled.getHours()).padStart(2, '0')}:${String(localScheduled.getMinutes()).padStart(2, '0')}`

  // Reschedule form state
  const [newDate, setNewDate] = useState(localDateStr)
  const [newTime, setNewTime] = useState(localTimeStr)
  const [newDuration, setNewDuration] = useState(durationMinutes)
  const [sendEmail, setSendEmail] = useState(false)
  const [rescheduleError, setRescheduleError] = useState<string | null>(null)

  const isPast = currentStatus !== 'cancelled' && currentStatus !== 'no_show'

  const handleStatusChange = (status: 'cancelled' | 'no_show' | 'completed') => {
    startTransition(async () => {
      await updateInterviewStatus(interviewId, status)
      setConfirmAction(null)
      router.refresh()
    })
  }

  const handleReschedule = () => {
    setRescheduleError(null)
    if (!newDate || !newTime) { setRescheduleError(t('interviews.dateTimeRequired')); return }
    const iso = new Date(`${newDate}T${newTime}`).toISOString()
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    startTransition(async () => {
      const result = await rescheduleInterview(interviewId, iso, newDuration, sendEmail, tz)
      if (!result.success) { setRescheduleError(result.error); return }
      setShowReschedule(false)
      router.refresh()
    })
  }

  if (confirmAction) {
    const label =
      confirmAction === 'cancel'
        ? t('interviews.action.cancel')
        : confirmAction === 'no_show'
          ? t('interviews.action.noShow')
          : t('interviews.action.complete')
    const status: 'cancelled' | 'no_show' | 'completed' =
      confirmAction === 'cancel'
        ? 'cancelled'
        : confirmAction === 'no_show'
          ? 'no_show'
          : 'completed'
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{t('interviews.markAsConfirm', { action: label })}</span>
        <Button
          size="sm"
          variant={confirmAction === 'complete' ? 'default' : 'destructive'}
          disabled={isPending}
          onClick={() => handleStatusChange(status)}
          className="h-7 px-2 text-xs"
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t('common.confirm')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConfirmAction(null)}
          className="h-7 px-2 text-xs"
        >
          {t('common.no')}
        </Button>
      </div>
    )
  }

  if (showReschedule) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowReschedule(false)}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('interviews.reschedule')}
          className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="mb-4 text-base font-semibold text-foreground">{t('interviews.reschedule')}</h3>

          {rescheduleError && (
            <p className="mb-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700">{rescheduleError}</p>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('interviews.date')} *</Label>
                <DatePicker
                  value={newDate}
                  onChange={(v) => setNewDate(v ?? '')}
                  disabled={isPending}
                  fromYear={new Date().getFullYear()}
                  toYear={new Date().getFullYear() + 3}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="reschedule-time">{t('interviews.time')} *</Label>
                <Input
                  id="reschedule-time"
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t('interviews.duration')}</Label>
              <Select
                value={newDuration.toString()}
                onValueChange={(v) => setNewDuration(parseInt(v, 10))}
                disabled={isPending}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {durationOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value.toString()}>{t(o.key)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="reschedule-email"
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                disabled={isPending || !candidateHasEmail}
                className="h-4 w-4 rounded border-border"
              />
              <label
                htmlFor="reschedule-email"
                className={`text-sm ${candidateHasEmail ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
              >
                {t('interviews.sendInvite')}
                {!candidateHasEmail && <span className="ml-1 text-xs text-muted-foreground">{t('interviews.noEmail')}</span>}
              </label>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowReschedule(false)} disabled={isPending}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={handleReschedule} disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              {t('common.saveChanges')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!isPast) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('interviews.actionsAria')}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setShowReschedule(true)}>
          <Calendar className="mr-2 h-4 w-4" />
          {t('interviews.reschedule')}
        </DropdownMenuItem>
        {/* A-11c — Mark complete is available for any scheduled interview;
            the past-due card prompt also routes here. */}
        <DropdownMenuItem onClick={() => setConfirmAction('complete')}>
          <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
          {t('interviews.markComplete')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => setConfirmAction('cancel')}
        >
          <XCircle className="mr-2 h-4 w-4" />
          {t('interviews.cancelInterview')}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => setConfirmAction('no_show')}
        >
          <UserX className="mr-2 h-4 w-4" />
          {t('interviews.markNoShow')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
