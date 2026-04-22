'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCandidate, updateCandidate } from '@/lib/actions/candidates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Linkedin } from 'lucide-react'
import type {
  Candidate,
  CandidateFormData,
  Vacancy,
  CandidateGeneralStatus,
  ApplicationStatus,
} from '@/lib/types'

interface CandidateFormProps {
  candidate?: Candidate
  vacancies: Vacancy[]
  defaultVacancyId?: string
  candidateStatuses: CandidateGeneralStatus[]
  defaultApplicationStatusId?: string | null
  initialApplicationStatuses?: ApplicationStatus[]
}

export function CandidateForm({
  candidate,
  vacancies,
  defaultVacancyId,
  candidateStatuses,
}: CandidateFormProps) {
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedVacancyId, setSelectedVacancyId] = useState<string>(
    defaultVacancyId || ''
  )

  const [formData, setFormData] = useState<CandidateFormData>({
    first_name: candidate?.first_name || '',
    last_name: candidate?.last_name || '',
    date_of_birth: candidate?.date_of_birth ?? null,
    email: candidate?.email || '',
    phone: candidate?.phone || '',
    current_company: candidate?.current_company || '',
    current_position: candidate?.current_position || '',
    years_of_experience: candidate?.years_of_experience ?? null,
    linkedin_profile_url: candidate?.linkedin_profile_url || '',
    source: candidate?.source || '',
    general_status_id: candidate?.general_status_id || null,
    linked_vacancy_ids: [],
  })

  const canLinkVacancyOnEdit = useMemo(() => !candidate, [candidate])

  const handleChange = <K extends keyof CandidateFormData>(key: K, value: CandidateFormData[K]) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const payload = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      date_of_birth: formData.date_of_birth || null,
      email: formData.email || null,
      phone: formData.phone || null,
      current_company: formData.current_company || null,
      current_position: formData.current_position || null,
      years_of_experience: formData.years_of_experience ?? null,
      linkedin_profile_url: formData.linkedin_profile_url || null,
      source: formData.source || null,
      general_status_id: formData.general_status_id || null,
    }

    const result = candidate
      ? await updateCandidate(candidate.id, payload)
      : await createCandidate(payload, selectedVacancyId || null)

    if (!result.success) {
      setError(result.error)
      setIsLoading(false)
      return
    }

    router.push('/candidates')
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
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Basic candidate profile information.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                placeholder="e.g. John"
                value={formData.first_name}
                onChange={(e) => handleChange('first_name', e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <Input
                id="last_name"
                placeholder="e.g. Smith"
                value={formData.last_name}
                onChange={(e) => handleChange('last_name', e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth ?? ''}
                onChange={(e) =>
                  handleChange('date_of_birth', e.target.value || null)
                }
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="general_status_id">General Status</Label>
              <Select
                value={formData.general_status_id || 'none'}
                onValueChange={(value) =>
                  handleChange('general_status_id', value === 'none' ? null : value)
                }
                disabled={isLoading}
              >
                <SelectTrigger id="general_status_id">
                  <SelectValue placeholder="Select candidate status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {candidateStatuses.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email ?? ''}
                onChange={(e) => handleChange('email', e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={formData.phone ?? ''}
                onChange={(e) => handleChange('phone', e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="current_company">Current Company</Label>
              <Input
                id="current_company"
                placeholder="e.g. ABC Tech"
                value={formData.current_company ?? ''}
                onChange={(e) => handleChange('current_company', e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="current_position">Current Position</Label>
              <Input
                id="current_position"
                placeholder="e.g. Senior Backend Engineer"
                value={formData.current_position ?? ''}
                onChange={(e) => handleChange('current_position', e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="years_of_experience">Years of Experience</Label>
              <Input
                id="years_of_experience"
                type="number"
                min={0}
                step="0.5"
                placeholder="e.g. 5"
                value={formData.years_of_experience ?? ''}
                onChange={(e) =>
                  handleChange(
                    'years_of_experience',
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkedin_profile_url">LinkedIn Profile</Label>
              <div className="flex gap-2">
                <Input
                  id="linkedin_profile_url"
                  type="url"
                  placeholder="https://linkedin.com/in/johnsmith"
                  value={formData.linkedin_profile_url ?? ''}
                  onChange={(e) => handleChange('linkedin_profile_url', e.target.value)}
                  disabled={isLoading}
                />
                {formData.linkedin_profile_url && (
                  <a
                    href={formData.linkedin_profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button type="button" variant="outline" size="icon" title="Open LinkedIn profile">
                      <Linkedin className="h-4 w-4 text-[#0A66C2]" />
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Recruitment Details</CardTitle>
          <CardDescription>
            Optional source and initial vacancy link. In v2, vacancy linking creates an application.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select
                value={formData.source || 'none'}
                onValueChange={(value) => handleChange('source', value === 'none' ? '' : value)}
                disabled={isLoading}
              >
                <SelectTrigger id="source">
                  <SelectValue placeholder="How did they enter the pipeline?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                  <SelectItem value="Indeed">Indeed</SelectItem>
                  <SelectItem value="Referral">Referral</SelectItem>
                  <SelectItem value="Company Website">Company Website</SelectItem>
                  <SelectItem value="Job Board">Job Board</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="initial_vacancy_id">
                {candidate ? 'Vacancy Linking' : 'Initial Vacancy'}
              </Label>
              <Select
                value={selectedVacancyId || 'none'}
                onValueChange={(value) => setSelectedVacancyId(value === 'none' ? '' : value)}
                disabled={isLoading || !canLinkVacancyOnEdit}
              >
                <SelectTrigger id="initial_vacancy_id">
                  <SelectValue
                    placeholder={
                      candidate
                        ? 'Link applications from candidate details page'
                        : 'Select a vacancy'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {candidate ? 'No vacancy changes here' : 'No vacancy assigned'}
                  </SelectItem>
                  {vacancies.map((vacancy) => (
                    <SelectItem key={vacancy.id} value={vacancy.id}>
                      {vacancy.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {candidate ? (
                <p className="text-sm text-muted-foreground">
                  Existing candidate-vacancy links should be managed through applications on the candidate details page.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  If selected, the system will create the candidate first and then create an application linked to this vacancy.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="initial_note">Initial Note (optional)</Label>
            <Textarea
              id="initial_note"
              placeholder="For v2 architecture, recruiter notes should be saved separately on the candidate details page."
              disabled
              rows={4}
            />
            <p className="text-sm text-muted-foreground">
              This field is intentionally disabled here because notes belong in the separate candidate notes flow in schema v2.
            </p>
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
              {candidate ? 'Updating...' : 'Adding...'}
            </>
          ) : candidate ? (
            'Update Candidate'
          ) : (
            'Add Candidate'
          )}
        </Button>
      </div>
    </form>
  )
}