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
import { Loader2 } from 'lucide-react'
import type { InterviewType } from '@/lib/types'

interface InterviewCandidateOption {
  id: string
  first_name: string
  last_name: string
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

  const candidateApplications = useMemo(() => {
    if (!candidateId) return []
    return applications.filter((application) => application.candidate_id === candidateId)
  }, [applications, candidateId])

  const availableVacancies = useMemo(() => {
    if (!candidateId) return vacancies

    const vacancyIds = new Set(candidateApplications.map((application) => application.vacancy_id))
    return vacancies.filter((vacancy) => vacancyIds.has(vacancy.id))
  }, [candidateApplications, candidateId, vacancies])

  const handleCandidateChange = (id: string) => {
    setCandidateId(id)

    const relatedApplications = applications.filter((application) => application.candidate_id === id)

    if (relatedApplications.length === 1) {
      setApplicationId(relatedApplications[0].id)
      setVacancyId(relatedApplications[0].vacancy_id)
      return
    }

    if (relatedApplications.length > 1) {
      setApplicationId('')
      setVacancyId('')
      return
    }

    setApplicationId('')
    setVacancyId('')
  }

  const handleVacancyChange = (id: string) => {
    setVacancyId(id)

    if (!candidateId) {
      setApplicationId('')
      return
    }

    const matchedApplication = applications.find(
      (application) => application.candidate_id === candidateId && application.vacancy_id === id
    )

    setApplicationId(matchedApplication?.id || '')
  }

  const handleInterviewerChange = (value: string) => {
    setInterviewerId(value === 'none' ? '' : value)
  }

  const validateForm = (): string | null => {
    if (!candidateId) return 'Please select a candidate.'
    if (!vacancyId) return 'Please select a vacancy.'
    if (!scheduledDate) return 'Please select a date.'
    if (!scheduledTime) return 'Please select a time.'

    const matchedApplication = applications.find(
      (application) => application.candidate_id === candidateId && application.vacancy_id === vacancyId
    )

    if (!matchedApplication) {
      return 'The selected candidate is not linked to the selected vacancy through an application.'
    }

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`)
    if (Number.isNaN(scheduledAt.getTime())) {
      return 'Scheduled date/time is invalid.'
    }

    if (scheduledAt < new Date()) {
      return 'Interview must be scheduled in the future.'
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsLoading(true)

    const matchedApplication = applications.find(
      (a) => a.candidate_id === candidateId && a.vacancy_id === vacancyId
    )
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`)

    const result = await createInterview({
      candidate_id: candidateId,
      vacancy_id: vacancyId,
      application_id: applicationId || matchedApplication?.id || null,
      interviewer_id: interviewerId || null,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: duration,
      type,
    })

    if (!result.success) {
      setError(result.error)
      setIsLoading(false)
      return
    }

    router.push('/interviews')
    router.refresh()
    setIsLoading(false)
  }

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
              onValueChange={(value: string) => handleCandidateChange(value)}
              disabled={isLoading}
            >
              <SelectTrigger id="candidate">
                <SelectValue placeholder="Select a candidate" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {getCandidateFullName(candidate)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vacancy">Vacancy *</Label>
            <Select
              value={vacancyId}
              onValueChange={(value: string) => handleVacancyChange(value)}
              disabled={isLoading || !candidateId}
            >
              <SelectTrigger id="vacancy">
                <SelectValue placeholder={candidateId ? 'Select a vacancy' : 'Select candidate first'} />
              </SelectTrigger>
              <SelectContent>
                {availableVacancies.map((vacancy) => (
                  <SelectItem key={vacancy.id} value={vacancy.id}>
                    {vacancy.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Only vacancies linked to the selected candidate through applications are shown.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interviewer">Interviewer</Label>
            <Select
              value={interviewerId || 'none'}
              onValueChange={(value: string) => handleInterviewerChange(value)}
              disabled={isLoading}
            >
              <SelectTrigger id="interviewer">
                <SelectValue placeholder="Select an interviewer (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not assigned</SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name}
                  </SelectItem>
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
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={scheduledDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
                disabled={isLoading}
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
                onValueChange={(value: string) => setDuration(parseInt(value, 10))}
                disabled={isLoading}
              >
                <SelectTrigger id="duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {durationOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Interview Type</Label>
              <Select
                value={type}
                onValueChange={(value: string) => setType(value as InterviewType)}
                disabled={isLoading}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {interviewTypes.map((interviewType) => (
                    <SelectItem key={interviewType.value} value={interviewType.value}>
                      {interviewType.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
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