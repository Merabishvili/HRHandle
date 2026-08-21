'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { rescheduleInterview } from '@/lib/actions/interviews'

const DURATIONS: { value: number; labelKey: string }[] = [
  { value: 30, labelKey: 'interviews.dur30m' },
  { value: 45, labelKey: 'interviews.dur45m' },
  { value: 60, labelKey: 'interviews.dur1h' },
  { value: 90, labelKey: 'interviews.dur90m' },
  { value: 120, labelKey: 'interviews.dur2h' },
]

const pad = (n: number) => String(n).padStart(2, '0')
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const toHm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/**
 * Reschedule an existing interview — a small date/time/duration dialog that
 * updates the interview in place via rescheduleInterview (#N15). Replaces the
 * old "Reschedule" link that opened a blank new-interview page and ignored the
 * interview it was meant to move.
 */
export function RescheduleInterviewDialog({
  open,
  onOpenChange,
  interviewId,
  scheduledAt,
  durationMinutes,
  candidateHasEmail = false,
  onRescheduled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  interviewId: string
  scheduledAt: string
  durationMinutes: number
  candidateHasEmail?: boolean
  onRescheduled?: () => void
}) {
  const t = useTranslations()
  const router = useRouter()
  const initial = new Date(scheduledAt)
  const [date, setDate] = useState<string>(() => (Number.isNaN(initial.getTime()) ? '' : toYmd(initial)))
  const [time, setTime] = useState<string>(() => (Number.isNaN(initial.getTime()) ? '' : toHm(initial)))
  const [duration, setDuration] = useState(durationMinutes)
  const [notify, setNotify] = useState(false)
  const [pending, setPending] = useState(false)

  const save = async () => {
    if (!date || !time) {
      toast.error(t('interviews.form.errInvalidDateTime'))
      return
    }
    const scheduled = new Date(`${date}T${time}`)
    if (Number.isNaN(scheduled.getTime())) {
      toast.error(t('interviews.form.errInvalidDateTime'))
      return
    }
    if (scheduled <= new Date()) {
      toast.error(t('interviews.form.errFuture'))
      return
    }
    setPending(true)
    const result = await rescheduleInterview(
      interviewId,
      scheduled.toISOString(),
      duration,
      notify && candidateHasEmail,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    )
    setPending(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success(t('interviews.rescheduled'))
    onOpenChange(false)
    onRescheduled?.()
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('interviews.rescheduleTitle')}</DialogTitle>
          <DialogDescription>{t('interviews.rescheduleSubtitle')}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t('interviews.date')}</Label>
            <DatePicker
              value={date || null}
              onChange={(v) => setDate(v ?? '')}
              placeholder={t('interviews.form.pickDate')}
              disabled={pending}
              disablePast
              fromYear={new Date().getFullYear()}
              toYear={new Date().getFullYear() + 3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rs-time">{t('interviews.time')}</Label>
            <Input
              id="rs-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={pending}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rs-duration">{t('interviews.duration')}</Label>
          <Select value={String(duration)} onValueChange={(v) => setDuration(parseInt(v, 10))} disabled={pending}>
            <SelectTrigger id="rs-duration"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DURATIONS.map((d) => (
                <SelectItem key={d.value} value={String(d.value)}>{t(d.labelKey)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {candidateHasEmail && (
          <label className="flex items-center gap-2 text-[13px] text-foreground">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              disabled={pending}
              className="h-4 w-4"
            />
            {t('interviews.notifyCandidate')}
          </label>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={save} disabled={pending} className="gap-1.5">
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('interviews.rescheduleTitle')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
