'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Calendar, XCircle, UserX, Loader2 } from 'lucide-react'
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
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
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
  const [isPending, startTransition] = useTransition()
  const [confirmAction, setConfirmAction] = useState<'cancel' | 'no_show' | null>(null)
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

  const handleStatusChange = (status: 'cancelled' | 'no_show') => {
    startTransition(async () => {
      await updateInterviewStatus(interviewId, status)
      setConfirmAction(null)
      router.refresh()
    })
  }

  const handleReschedule = () => {
    setRescheduleError(null)
    if (!newDate || !newTime) { setRescheduleError('Date and time are required.'); return }
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
    const label = confirmAction === 'cancel' ? 'Cancel' : 'No Show'
    const status = confirmAction === 'cancel' ? 'cancelled' : 'no_show'
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Mark as {label}?</span>
        <Button
          size="sm"
          variant="destructive"
          disabled={isPending}
          onClick={() => handleStatusChange(status)}
          className="h-7 px-2 text-xs"
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirm'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConfirmAction(null)}
          className="h-7 px-2 text-xs"
        >
          No
        </Button>
      </div>
    )
  }

  if (showReschedule) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowReschedule(false)}>
        <div
          className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="mb-4 text-base font-semibold text-foreground">Reschedule Interview</h3>

          {rescheduleError && (
            <p className="mb-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700">{rescheduleError}</p>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Date *</Label>
                <DatePicker
                  value={newDate}
                  onChange={(v) => setNewDate(v ?? '')}
                  disabled={isPending}
                  fromYear={new Date().getFullYear()}
                  toYear={new Date().getFullYear() + 3}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="reschedule-time">Time *</Label>
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
              <Label className="text-xs">Duration</Label>
              <Select
                value={newDuration.toString()}
                onValueChange={(v) => setNewDuration(parseInt(v, 10))}
                disabled={isPending}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {durationOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value.toString()}>{o.label}</SelectItem>
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
                Send updated invite to candidate
                {!candidateHasEmail && <span className="ml-1 text-xs text-muted-foreground">(no email)</span>}
              </label>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowReschedule(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleReschedule} disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Save changes
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
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Interview actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setShowReschedule(true)}>
          <Calendar className="mr-2 h-4 w-4" />
          Reschedule
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => setConfirmAction('cancel')}
        >
          <XCircle className="mr-2 h-4 w-4" />
          Cancel interview
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => setConfirmAction('no_show')}
        >
          <UserX className="mr-2 h-4 w-4" />
          Mark as no show
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
