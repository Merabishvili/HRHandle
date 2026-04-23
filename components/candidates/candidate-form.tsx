'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCandidate, updateCandidate } from '@/lib/actions/candidates'
import { uploadDocument } from '@/lib/actions/documents'
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
import { Loader2, Linkedin, Paperclip, X, Upload } from 'lucide-react'
import type {
  Candidate,
  CandidateFormData,
  Vacancy,
  CandidateGeneralStatus,
  ApplicationStatus,
} from '@/lib/types'

const DOCUMENT_TYPE_OPTIONS = [
  { value: 'cv', label: 'CV / Resume' },
  { value: 'cover_letter', label: 'Cover Letter' },
  { value: 'other', label: 'Other' },
]

interface PendingFile {
  id: string
  file: File
  documentType: string
}

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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])

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

  const isEditing = !!candidate

  const handleChange = <K extends keyof CandidateFormData>(key: K, value: CandidateFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newEntries: PendingFile[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      documentType: 'cv',
    }))
    setPendingFiles((prev) => [...prev, ...newEntries])
    if (fileInputRef.current) fileInputRef.current.value = ''
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

    const result = isEditing
      ? await updateCandidate(candidate.id, payload)
      : await createCandidate(payload, selectedVacancyId || null)

    if (!result.success) {
      setError(result.error)
      setIsLoading(false)
      return
    }

    // Upload queued documents after candidate is created
    if (!isEditing && result.data?.id && pendingFiles.length > 0) {
      for (const entry of pendingFiles) {
        const fd = new FormData()
        fd.append('file', entry.file)
        fd.append('document_type', entry.documentType)
        await uploadDocument(result.data.id, fd)
      }
    }

    router.push(isEditing ? `/candidates/${candidate.id}` : '/candidates')
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

      {/* Personal Information */}
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
              <Label>Date of Birth</Label>
              <DatePicker
                value={formData.date_of_birth ?? null}
                onChange={(v) => handleChange('date_of_birth', v)}
                placeholder="Select date of birth"
                disabled={isLoading}
                fromYear={1940}
                toYear={new Date().getFullYear()}
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
                  <a href={formData.linkedin_profile_url} target="_blank" rel="noopener noreferrer">
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

      {/* Recruitment Details */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Recruitment Details</CardTitle>
          <CardDescription>Source and initial vacancy assignment.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className={`grid gap-4 ${isEditing ? '' : 'sm:grid-cols-2'}`}>
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

            {!isEditing && (
              <div className="space-y-2">
                <Label htmlFor="initial_vacancy_id">Initial Vacancy</Label>
                <Select
                  value={selectedVacancyId || 'none'}
                  onValueChange={(value) => setSelectedVacancyId(value === 'none' ? '' : value)}
                  disabled={isLoading}
                >
                  <SelectTrigger id="initial_vacancy_id">
                    <SelectValue placeholder="Select a vacancy (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No vacancy assigned</SelectItem>
                    {vacancies.map((vacancy) => (
                      <SelectItem key={vacancy.id} value={vacancy.id}>
                        {vacancy.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Documents — only on create */}
      {!isEditing && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>Upload CV, cover letter or other files. PDF and Word only, max 10 MB each.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {pendingFiles.length > 0 && (
              <div className="space-y-2">
                {pendingFiles.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{entry.file.name}</span>
                    <Select
                      value={entry.documentType}
                      onValueChange={(v) =>
                        setPendingFiles((prev) =>
                          prev.map((f) => f.id === entry.id ? { ...f, documentType: v } : f)
                        )
                      }
                      disabled={isLoading}
                    >
                      <SelectTrigger className="h-7 w-[130px] shrink-0 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setPendingFiles((prev) => prev.filter((f) => f.id !== entry.id))}
                      disabled={isLoading}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              disabled={isLoading}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <Upload className="mr-2 h-4 w-4" />
              Add File
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEditing ? 'Updating...' : 'Adding...'}
            </>
          ) : isEditing ? (
            'Update Candidate'
          ) : (
            'Add Candidate'
          )}
        </Button>
      </div>
    </form>
  )
}
