'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
import type { InterviewType, Candidate, Vacancy, Profile } from '@/lib/types'

interface InterviewFormProps {
  candidates: Pick<Candidate, 'id' | 'full_name' | 'vacancy_id'>[]
  vacancies: Pick<Vacancy, 'id' | 'title'>[]
  teamMembers: Pick<Profile, 'id' | 'full_name'>[]
  defaultCandidateId?: string
  defaultVacancyId?: string
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

export function InterviewForm({ 
  candidates, 
  vacancies, 
  teamMembers,
  defaultCandidateId,
  defaultVacancyId 
}: InterviewFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [candidateId, setCandidateId] = useState(defaultCandidateId || '')
  const [vacancyId, setVacancyId] = useState(defaultVacancyId || '')
  const [interviewerId, setInterviewerId] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [duration, setDuration] = useState(60)
  const [type, setType] = useState<InterviewType>('video')

  // When candidate changes, auto-select their vacancy
  const handleCandidateChange = (id: string) => {
    setCandidateId(id)
    const candidate = candidates.find(c => c.id === id)
    if (candidate?.vacancy_id && !vacancyId) {
      setVacancyId(candidate.vacancy_id)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    if (!candidateId || !vacancyId || !scheduledDate || !scheduledTime) {
      setError('Please fill in all required fields')
      setIsLoading(false)
      return
    }

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`)

    if (scheduledAt < new Date()) {
      setError('Interview must be scheduled in the future')
      setIsLoading(false)
      return
    }

    const supabase = createClient()

    const { error: insertError } = await supabase
      .from('interviews')
      .insert({
        candidate_id: candidateId,
        vacancy_id: vacancyId,
        interviewer_id: interviewerId || null,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: duration,
        type,
      })

    if (insertError) {
      setError(insertError.message)
      setIsLoading(false)
      return
    }

    router.push('/interviews')
    router.refresh()
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
          <CardDescription>Who is being interviewed and for what position?</CardDescription>
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
                {candidates.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vacancy">Position *</Label>
            <Select
              value={vacancyId}
              onValueChange={setVacancyId}
              disabled={isLoading}
            >
              <SelectTrigger id="vacancy">
                <SelectValue placeholder="Select a position" />
              </SelectTrigger>
              <SelectContent>
                {vacancies.map((vacancy) => (
                  <SelectItem key={vacancy.id} value={vacancy.id}>
                    {vacancy.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interviewer">Interviewer</Label>
            <Select
              value={interviewerId}
              onValueChange={setInterviewerId}
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
                onChange={(e) => setScheduledDate(e.target.value)}
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
                onChange={(e) => setScheduledTime(e.target.value)}
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
                onValueChange={(v) => setDuration(parseInt(v))}
                disabled={isLoading}
              >
                <SelectTrigger id="duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {durationOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Interview Type</Label>
              <Select
                value={type}
                onValueChange={(v: InterviewType) => setType(v)}
                disabled={isLoading}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {interviewTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
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
