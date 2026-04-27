'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createInterview } from '@/lib/actions/interviews'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DatePicker } from '@/components/ui/date-picker'
import { Loader2, Video, Mail } from 'lucide-react'
import type { InterviewType } from '@/lib/types'

interface InterviewCandidateOption {
  id: string
  first_name: string
  last_name: string
  email?: string | null
}

interface InterviewVacancyOption {
  id: string
  title: string
}

interface InterviewApplicationOption {
  id: string
  candidate_id: string
  vacancy_id: string
}

interface InterviewTeamMemberOption {
  id: string
  full_name: string
}

interface InterviewFormProps {
  candidates: InterviewCandidateOption[]
  vacancies: InterviewVacancyOption[]
  applications: InterviewApplicationOption[]
  teamMembers: InterviewTeamMemberOption[]
  defaultCandidateId?: string
  defaultVacancyId?: string
  defaultApplicationId?: string
  hasGoogleCalendar?: boolean
  hasZoom?: boolean
}

const interviewTypes: { value: InterviewType; label: string }[] = [
  { value: 'video', label: 'Video Call' },
  { value: 'phone', label: 'Phone Call' },
  { value: 'onsite', label: 'On-site' },
]

const durationOptions = [
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
]

function getCandidateFullName(candidate: InterviewCandidateOption): string {
  return `${candidate.first_name} ${candidate.last_name}`.trim()
}

export function InterviewForm({
  candidates,
  vacancies,
  applications,
  teamMembers,
  defaultCandidateId,
  defaultVacancyId,
  defaultApplicationId,
  hasGoogleCalendar = false,
  hasZoom = false,
}: InterviewFormProps) {
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [candidateId, setCandidateId] = useState(defaultCandidateId || '')
  const [vacancyId, setVacancyId] = useState(defaultVacancyId || '')
  const [applicationId, setApplicationId] = useState(defaultApplicationId || '')
  const [interviewerId, setInterviewerId] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [duration, setDuration] = useState(60)
  const [type, setType] = useState<InterviewType>('video')

  // Meeting options: 'manual' | 'google_meet' | 'zoom'
  const [meetingOption, setMeetingOption] = useState<'manual' | 'google_meet' | 'zoom'>('manual')
  const [manualMeetingLink, setManualMeetingLink] = useState('')
  const [sendInvitation, setSendInvitation] = useState(false)

  const candidateApplications = useMemo(() => {
    if (!candidateId) return []
    return applications.filter((a) => a.candidate_id === candidateId)
  }, [applications, candidateId])

  const availableVacancies = useMemo(() => {
    if (!candidateId) return vacancies
    const vacancyIds = new Set(candidateApplications.map((a) => a.vacancy_id))
    return vacancies.filter((v) => vacancyIds.has(v.id))
  }, [candidateApplications, candidateId, vacancies])

  const selectedCandidate = useMemo(
    () => candidates.find((c) => c.id === candidateId) ?? null,
    [candidates, candidateId]
  )

  const candidateHasEmail = !!selectedCandidate?.email

  const handleCandidateChange = (id: string) => {
    setCandidateId(id)
    const related = applications.filter((a) => a.candidate_id === id)
    if (related.length === 1) {
      setApplicationId(related[0].id)
      setVacancyId(related[0].vacancy_id)
    } else {
      setApplicationId('')
      setVacancyId('')
    }
  }

  const handleVacancyChange = (id: string) => {
    setVacancyId(id)
    if (!candidateId) { setApplicationId(''); return }
    const matched = applications.find((a) => a.candidate_id === candidateId && a.vacancy_id === id)
    setApplicationId(matched?.id || '')
  }

  const handleInterviewerChange = (value: string) => {
    setInterviewerId(value === 'none' ? '' : value)
  }

  const handleTypeChange = (value: string) => {
    setType(value as InterviewType)
    if (value !== 'video') setMeetingOption('manual')
  }

  const validateForm = (): string | null => {
    if (!candidateId) return 'Please select a candidate.'
    if (!vacancyId) return 'Please select a vacancy.'
    if (!scheduledDate) return 'Please select a date.'
    if (!scheduledTime) return 'Please select a time.'

    const matched = applications.find(
      (a) => a.candidate_id === candidateId && a.vacancy_id === vacancyId
    )
    if (!matched) return 'This candidate has not been added to this vacancy.'

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`)
    if (Number.isNaN(scheduledAt.getTime())) return 'Scheduled date/time is invalid.'
    if (scheduledAt < new Date()) return 'Interview must be scheduled in the future.'

    return null
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const validationError = validateForm()
    if (validationError) { setError(validationError); return }

    setIsLoading(true)

    const matched = applications.find(
      (a) => a.candidate_id === candidateId && a.vacancy_id === vacancyId
    )
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`)

    const result = await createInterview(
      {
        candidate_id: candidateId,
        vacancy_id: vacancyId,
        application_id: applicationId || matched?.id || null,
        interviewer_id: interviewerId || null,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: duration,
        type,
      },
      {
        createMeet: meetingOption === 'google_meet',
        createZoom: meetingOption === 'zoom',
        meetingLink: meetingOption === 'manual' ? manualMeetingLink || null : null,
        sendInvitation,
      }
    )

    if (!result.success) {
      setError(result.error)
      setIsLoading(false)
      return
    }

    router.push('/interviews')
    router.refresh()
    setIsLoading(false)
  }

  const showAutoMeetOptions = type === 'video' && (hasGoogleCalendar || hasZoom)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Interview Details</CardTitle>
          <CardDescription>Who is being interviewed and for which vacancy?</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="candidate">Candidate *</Label>
            <Select
              value={candidateId}
              onValueChange={handleCandidateChange}
              disabled={isLoading}
            >
              <SelectTrigger id="candidate">
                <SelectValue placeholder="Select a candidate" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {getCandidateFullName(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vacancy">Vacancy *</Label>
            <Select
              value={vacancyId}
              onValueChange={handleVacancyChange}
              disabled={isLoading || !candidateId}
            >
              <SelectTrigger id="vacancy">
                <SelectValue placeholder={candidateId ? 'Select a vacancy' : 'Select candidate first'} />
              </SelectTrigger>
              <SelectContent>
                {availableVacancies.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Only vacancies this candidate is being considered for are shown.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interviewer">Interviewer</Label>
            <Select
              value={interviewerId || 'none'}
              onValueChange={handleInterviewerChange}
              disabled={isLoading}
            >
              <SelectTrigger id="interviewer">
                <SelectValue placeholder="Select an interviewer (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not assigned</SelectItem>
                {teamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
          <CardDescription>When and how will the interview take place?</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Date *</Label>
              <DatePicker
                value={scheduledDate || null}
                onChange={(v) => setScheduledDate(v ?? '')}
                placeholder="Select interview date"
                disabled={isLoading}
                fromYear={new Date().getFullYear()}
                toYear={new Date().getFullYear() + 3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Time *</Label>
              <Input
                id="time"
                type="time"
                value={scheduledTime}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScheduledTime(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Select
                value={duration.toString()}
                onValueChange={(v) => setDuration(parseInt(v, 10))}
                disabled={isLoading}
              >
                <SelectTrigger id="duration"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {durationOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value.toString()}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Interview Type</Label>
              <Select value={type} onValueChange={handleTypeChange} disabled={isLoading}>
                <SelectTrigger id="type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {interviewTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Meeting Link</CardTitle>
          <CardDescription>Add a video call link or auto-generate one.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {showAutoMeetOptions && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setMeetingOption('manual')}
                  disabled={isLoading}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                    meetingOption === 'manual'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  Enter manually
                </button>
                {hasGoogleCalendar && (
                  <button
                    type="button"
                    onClick={() => setMeetingOption('google_meet')}
                    disabled={isLoading}
                    className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      meetingOption === 'google_meet'
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:bg-muted'
                    }`}
                  >
                    <Video className="h-3.5 w-3.5" />
                    Auto Google Meet
                  </button>
                )}
                {hasZoom && (
                  <button
                    type="button"
                    onClick={() => setMeetingOption('zoom')}
                    disabled={isLoading}
                    className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      meetingOption === 'zoom'
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:bg-muted'
                    }`}
                  >
                    <Video className="h-3.5 w-3.5" />
                    Auto Zoom
                  </button>
                )}
              </div>
            </div>
          )}

          {meetingOption === 'manual' ? (
            <div className="space-y-2">
              <Label htmlFor="meeting-link">Meeting URL</Label>
              <Input
                id="meeting-link"
                type="url"
                placeholder="https://zoom.us/j/... or any meeting link"
                value={manualMeetingLink}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualMeetingLink(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">Optional. Paste any Zoom, Teams, or other meeting link.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {meetingOption === 'google_meet'
                ? 'A Google Meet link will be created automatically and added to your Google Calendar.'
                : 'A Zoom meeting will be created automatically.'}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <input
          id="send-invitation"
          type="checkbox"
          checked={sendInvitation}
          onChange={(e) => setSendInvitation(e.target.checked)}
          disabled={isLoading || !candidateHasEmail}
          className="h-4 w-4 rounded border-border"
        />
        <label
          htmlFor="send-invitation"
          className={`flex items-center gap-2 text-sm font-medium ${candidateHasEmail ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
        >
          <Mail className="h-4 w-4 text-primary" />
          Send email invitation to candidate
          {!candidateHasEmail && candidateId && (
            <span className="text-xs font-normal text-muted-foreground">(candidate has no email)</span>
          )}
        </label>
      </div>

      <div className="flex items-center justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scheduling...
            </>
          ) : (
            'Schedule Interview'
          )}
        </Button>
      </div>
    </form>
  )
}
