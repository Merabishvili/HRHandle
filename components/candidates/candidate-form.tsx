'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCandidate, updateCandidate } from '@/lib/actions/candidates'
import { uploadDocument } from '@/lib/actions/documents'
import { createNote } from '@/lib/actions/notes'
import { saveCustomFieldValues } from '@/lib/actions/custom-fields'
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
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Linkedin, Paperclip, X, Upload, FileText, Wand2, PenLine, CheckCircle2, AlertCircle, Plus, Trash2, Check, Briefcase, GraduationCap } from 'lucide-react'
import { bulkCreateExperienceEntries, bulkCreateEducationEntries } from '@/lib/actions/candidate-background'
import type { ParsedCVInput } from '@/lib/validations/candidate-background'

type ExpLocal = { localId: string; company: string; title: string; start_date: string | null; end_date: string | null; is_current: boolean; description: string | null }
type EduLocal = { localId: string; institution: string; degree: string | null; field_of_study: string | null; start_year: number | null; end_year: number | null; is_ongoing: boolean }
const BLANK_EXP: Omit<ExpLocal, 'localId'> = { company: '', title: '', start_date: null, end_date: null, is_current: false, description: null }
const BLANK_EDU: Omit<EduLocal, 'localId'> = { institution: '', degree: null, field_of_study: null, start_year: null, end_year: null, is_ongoing: false }
import { CustomFieldsForm, valuesToMap, mapToValueUpserts } from '@/components/custom-fields/custom-fields-form'
import type {
  Candidate,
  CandidateFormData,
  Vacancy,
  CandidateGeneralStatus,
  ApplicationStatus,
} from '@/lib/types'
import type { CustomFieldGroupWithFields, CustomFieldValue } from '@/lib/actions/custom-fields'

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
  customFieldGroups?: CustomFieldGroupWithFields[]
  customFieldValues?: CustomFieldValue[]
}

type EntryMode = null | 'cv' | 'manual'
type CvParseState = 'idle' | 'parsing' | 'done' | 'failed'

export function CandidateForm({
  candidate,
  vacancies,
  defaultVacancyId,
  candidateStatuses,
  customFieldGroups = [],
  customFieldValues = [],
}: CandidateFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cvUploadRef = useRef<HTMLInputElement>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [cfValues, setCfValues] = useState<Record<string, string>>(
    () => valuesToMap(customFieldValues)
  )

  // Two-path entry state (create-only)
  const [entryMode, setEntryMode] = useState<EntryMode>(candidate ? 'manual' : null)
  const [cvParseState, setCvParseState] = useState<CvParseState>('idle')
  const [parsedCV, setParsedCV] = useState<ParsedCVInput | null>(null)
  const [cvFileName, setCvFileName] = useState<string | null>(null)

  // Pending experience/education for create form (local state, saved on submit)
  const [pendingExp, setPendingExp] = useState<ExpLocal[]>([])
  const [pendingEdu, setPendingEdu] = useState<EduLocal[]>([])
  const [addingExp, setAddingExp] = useState(false)
  const [addExpForm, setAddExpForm] = useState<Omit<ExpLocal, 'localId'>>(BLANK_EXP)
  const [addingEdu, setAddingEdu] = useState(false)
  const [addEduForm, setAddEduForm] = useState<Omit<EduLocal, 'localId'>>(BLANK_EDU)

  const [selectedVacancyId, setSelectedVacancyId] = useState<string>(
    defaultVacancyId || ''
  )

  const [formData, setFormData] = useState<CandidateFormData>({
    first_name: candidate?.first_name || '',
    last_name: candidate?.last_name || '',
    email: candidate?.email || '',
    phone: candidate?.phone || '',
    linkedin_profile_url: candidate?.linkedin_profile_url || '',
    location: (candidate as {location?: string | null})?.location ?? null,
    timezone: (candidate as {timezone?: string | null})?.timezone ?? null,
    languages: (candidate as {languages?: string[]})?.languages ?? [],
    salary_expectation: (candidate as {salary_expectation?: string | null})?.salary_expectation ?? null,
    notice_period: (candidate as {notice_period?: string | null})?.notice_period ?? null,
    source: candidate?.source || '',
    general_status_id: candidate?.general_status_id ||
      candidateStatuses.find((s) => s.code === 'active')?.id || null,
    linked_vacancy_ids: [],
  })

  const isEditing = !!candidate
  const [pendingNote, setPendingNote] = useState('')
  const submittingRef = useRef(false)

  const handleChange = <K extends keyof CandidateFormData>(key: K, value: CandidateFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const handleCVUploadForParsing = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (cvUploadRef.current) cvUploadRef.current.value = ''

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'doc', 'docx'].includes(ext ?? '')) {
      setError('CV must be a PDF or Word document.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('CV file must be 10 MB or smaller.')
      return
    }

    setError(null)
    setCvFileName(file.name)
    setCvParseState('parsing')
    setParsedCV(null)
    // Add to pending documents so CV is uploaded on save
    setPendingFiles([{ id: `cv-${Date.now()}`, file, documentType: 'cv' }])

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/parse-cv', { method: 'POST', body: fd })
      const json = await res.json()

      if (json.success && json.data) {
        const data: ParsedCVInput = json.data
        setParsedCV(data)
        setCvParseState('done')
        setFormData((prev) => ({
          ...prev,
          first_name: data.first_name || prev.first_name,
          last_name: data.last_name || prev.last_name,
          email: data.email || prev.email,
          phone: data.phone || prev.phone,
          linkedin_profile_url: data.linkedin_profile_url || prev.linkedin_profile_url,
          location: data.location || (prev as {location?: string | null}).location,
          timezone: data.timezone || (prev as {timezone?: string | null}).timezone,
          languages: (data.languages?.length ? data.languages : null) ?? (prev as {languages?: string[]}).languages ?? [],
          salary_expectation: data.salary_expectation || (prev as {salary_expectation?: string | null}).salary_expectation,
          notice_period: data.notice_period || (prev as {notice_period?: string | null}).notice_period,
        }))
        if (data.experience.length > 0) {
          setPendingExp(data.experience
            .filter((e) => e.company && e.title)
            .map((e, i) => ({ localId: `cv-exp-${i}`, company: e.company ?? '', title: e.title ?? '', start_date: e.start_date ?? null, end_date: e.end_date ?? null, is_current: e.is_current, description: e.description ?? null }))
          )
        }
        if (data.education.length > 0) {
          setPendingEdu(data.education
            .filter((e) => e.institution)
            .map((e, i) => ({ localId: `cv-edu-${i}`, institution: e.institution ?? '', degree: e.degree ?? null, field_of_study: e.field_of_study ?? null, start_year: e.start_year ?? null, end_year: e.end_year ?? null, is_ongoing: e.is_ongoing }))
          )
        }
      } else {
        setCvParseState('failed')
      }
    } catch {
      setCvParseState('failed')
    }
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
    if (submittingRef.current) return
    submittingRef.current = true
    setError(null)
    setIsLoading(true)

    const payload = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email || null,
      phone: formData.phone || null,
      linkedin_profile_url: formData.linkedin_profile_url || null,
      location: (formData as {location?: string | null}).location || null,
      timezone: (formData as {timezone?: string | null}).timezone || null,
      languages: (formData as {languages?: string[]}).languages ?? [],
      salary_expectation: (formData as {salary_expectation?: string | null}).salary_expectation || null,
      notice_period: (formData as {notice_period?: string | null}).notice_period || null,
      source: formData.source || null,
      general_status_id: formData.general_status_id || null,
    }

    const result = isEditing
      ? await updateCandidate(candidate.id, payload)
      : await createCandidate(payload, selectedVacancyId || null)

    if (!result.success) {
      setError(result.error)
      setIsLoading(false)
      submittingRef.current = false
      return
    }

    const entityId = isEditing ? candidate.id : result.data?.id
    if (entityId && customFieldGroups.length > 0) {
      const upserts = mapToValueUpserts(cfValues, customFieldGroups)
      if (upserts.length > 0) {
        await saveCustomFieldValues(entityId, upserts)
      }
    }

    if (!isEditing && result.data?.id) {
      const expEntries = pendingExp.filter((e) => e.company.trim() && e.title.trim()).map(({ localId: _id, ...e }) => e)
      if (expEntries.length > 0) await bulkCreateExperienceEntries(result.data.id, expEntries)
      const eduEntries = pendingEdu.filter((e) => e.institution.trim()).map(({ localId: _id, ...e }) => e)
      if (eduEntries.length > 0) await bulkCreateEducationEntries(result.data.id, eduEntries)
    }

    if (!isEditing && result.data?.id) {
      // Upload queued documents
      for (const entry of pendingFiles) {
        const fd = new FormData()
        fd.append('file', entry.file)
        fd.append('document_type', entry.documentType)
        const uploadResult = await uploadDocument(result.data.id, fd)
        if (!uploadResult.success) {
          setError(`Document upload failed: ${uploadResult.error}`)
          setIsLoading(false)
          submittingRef.current = false
          return
        }
      }
      // Save initial note
      if (pendingNote.trim()) {
        await createNote(result.data.id, pendingNote.trim())
      }
    }

    router.push(isEditing ? `/candidates/${candidate.id}` : `/candidates/${result.data?.id}`)
    setIsLoading(false)
  }

  // Path selection screen (create-only)
  if (!candidate && entryMode === null) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">How would you like to add this candidate?</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setEntryMode('cv')}
            className="group flex flex-col items-start gap-3 rounded-xl border-2 border-border bg-card px-6 py-5 text-left hover:border-primary/60 hover:bg-muted/30 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Wand2 className="h-5 w-5 text-primary" />
              </div>
              <p className="font-semibold text-foreground">Upload CV first</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Upload a PDF or Word CV and we&apos;ll fill in the candidate details automatically using AI.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setEntryMode('manual')}
            className="group flex flex-col items-start gap-3 rounded-xl border-2 border-border bg-card px-6 py-5 text-left hover:border-primary/60 hover:bg-muted/30 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <PenLine className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground">Fill manually</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Enter candidate details by hand. You can still attach a CV as a document.
            </p>
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* CV Upload + Parse Banner (create, cv mode only) */}
      {!candidate && entryMode === 'cv' && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wand2 className="h-4 w-4" />
              Upload CV to auto-fill
            </CardTitle>
            <CardDescription>Fields will be filled automatically from the CV.</CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={cvUploadRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={handleCVUploadForParsing}
            />
            {cvParseState === 'idle' ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => cvUploadRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Select CV file
              </Button>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">{cvFileName}</span>
                {cvParseState === 'parsing' && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Parsing…
                  </span>
                )}
                {cvParseState === 'done' && (
                  <span className="flex items-center gap-1.5 text-xs text-green-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Fields filled
                  </span>
                )}
                {cvParseState === 'failed' && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-600">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Could not parse — fill manually
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="general_status_id">General Status</Label>
              <Select
                value={formData.general_status_id || ''}
                onValueChange={(value) => handleChange('general_status_id', value || null)}
                disabled={isLoading}
              >
                <SelectTrigger id="general_status_id">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
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
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g. Tbilisi, Georgia"
                value={(formData as {location?: string | null}).location ?? ''}
                onChange={(e) => handleChange('location' as keyof typeof formData, e.target.value || null)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                placeholder="e.g. GMT+4"
                value={(formData as {timezone?: string | null}).timezone ?? ''}
                onChange={(e) => handleChange('timezone' as keyof typeof formData, e.target.value || null)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="salary_expectation">Salary Expectation</Label>
              <Input
                id="salary_expectation"
                placeholder="e.g. $80,000 – $100,000"
                value={(formData as {salary_expectation?: string | null}).salary_expectation ?? ''}
                onChange={(e) => handleChange('salary_expectation' as keyof typeof formData, e.target.value || null)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notice_period">Notice Period</Label>
              <Input
                id="notice_period"
                placeholder="e.g. 1 month"
                value={(formData as {notice_period?: string | null}).notice_period ?? ''}
                onChange={(e) => handleChange('notice_period' as keyof typeof formData, e.target.value || null)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="languages">Languages</Label>
            <Input
              id="languages"
              placeholder="e.g. English, Georgian, Russian"
              value={((formData as {languages?: string[]}).languages ?? []).join(', ')}
              onChange={(e) => handleChange('languages' as keyof typeof formData, e.target.value ? e.target.value.split(',').map((l) => l.trim()).filter(Boolean) : [])}
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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

      {/* Experience (create only) */}
      {!isEditing && (
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Experience
              </CardTitle>
              <CardDescription>Work history entries.</CardDescription>
            </div>
            {!addingExp && (
              <Button type="button" variant="outline" size="sm" onClick={() => { setAddingExp(true); setAddExpForm(BLANK_EXP) }} disabled={isLoading}>
                <Plus className="h-4 w-4 mr-1" />Add
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {addingExp && (
              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Company *</Label>
                    <Input value={addExpForm.company} onChange={(e) => setAddExpForm((p) => ({ ...p, company: e.target.value }))} placeholder="Company name" maxLength={200} disabled={isLoading} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Title *</Label>
                    <Input value={addExpForm.title} onChange={(e) => setAddExpForm((p) => ({ ...p, title: e.target.value }))} placeholder="Job title" maxLength={200} disabled={isLoading} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Start date</Label>
                    <Input type="month" value={addExpForm.start_date ?? ''} onChange={(e) => setAddExpForm((p) => ({ ...p, start_date: e.target.value || null }))} disabled={isLoading} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End date</Label>
                    <Input type="month" value={addExpForm.end_date ?? ''} onChange={(e) => setAddExpForm((p) => ({ ...p, end_date: e.target.value || null }))} disabled={isLoading || addExpForm.is_current} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={addExpForm.is_current} onChange={(e) => setAddExpForm((p) => ({ ...p, is_current: e.target.checked, end_date: e.target.checked ? null : p.end_date }))} className="rounded" />
                  Currently working here
                </label>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setAddingExp(false); setAddExpForm(BLANK_EXP) }}>
                    <X className="h-4 w-4 mr-1" />Cancel
                  </Button>
                  <Button type="button" size="sm" disabled={!addExpForm.company.trim() || !addExpForm.title.trim()} onClick={() => { setPendingExp((p) => [...p, { ...addExpForm, localId: `exp-${Date.now()}` }]); setAddExpForm(BLANK_EXP); setAddingExp(false) }}>
                    <Check className="h-4 w-4 mr-1" />Add
                  </Button>
                </div>
              </div>
            )}
            {pendingExp.length === 0 && !addingExp && (
              <p className="py-4 text-center text-sm text-muted-foreground">No experience added yet.</p>
            )}
            {pendingExp.map((entry) => (
              <div key={entry.localId} className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/10 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{entry.title}</p>
                  <p className="text-sm text-muted-foreground truncate">{entry.company}</p>
                  {(entry.start_date || entry.is_current || entry.end_date) && (
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.start_date ?? '?'} – {entry.is_current ? 'Present' : (entry.end_date ?? '?')}</p>
                  )}
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setPendingExp((p) => p.filter((e) => e.localId !== entry.localId))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Education (create only) */}
      {!isEditing && (
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Education
              </CardTitle>
              <CardDescription>Academic background.</CardDescription>
            </div>
            {!addingEdu && (
              <Button type="button" variant="outline" size="sm" onClick={() => { setAddingEdu(true); setAddEduForm(BLANK_EDU) }} disabled={isLoading}>
                <Plus className="h-4 w-4 mr-1" />Add
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {addingEdu && (
              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Institution *</Label>
                  <Input value={addEduForm.institution} onChange={(e) => setAddEduForm((p) => ({ ...p, institution: e.target.value }))} placeholder="University or school name" maxLength={200} disabled={isLoading} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Degree</Label>
                    <Input value={addEduForm.degree ?? ''} onChange={(e) => setAddEduForm((p) => ({ ...p, degree: e.target.value || null }))} placeholder="e.g. Bachelor's" maxLength={100} disabled={isLoading} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Field of study</Label>
                    <Input value={addEduForm.field_of_study ?? ''} onChange={(e) => setAddEduForm((p) => ({ ...p, field_of_study: e.target.value || null }))} placeholder="e.g. Computer Science" maxLength={200} disabled={isLoading} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Start year</Label>
                    <Input type="number" min={1950} max={new Date().getFullYear()} value={addEduForm.start_year ?? ''} onChange={(e) => setAddEduForm((p) => ({ ...p, start_year: e.target.value ? Number(e.target.value) : null }))} placeholder="e.g. 2018" disabled={isLoading} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End year</Label>
                    <Input type="number" min={1950} max={new Date().getFullYear() + 10} value={addEduForm.end_year ?? ''} onChange={(e) => setAddEduForm((p) => ({ ...p, end_year: e.target.value ? Number(e.target.value) : null }))} placeholder="e.g. 2022" disabled={isLoading || addEduForm.is_ongoing} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={addEduForm.is_ongoing} onChange={(e) => setAddEduForm((p) => ({ ...p, is_ongoing: e.target.checked, end_year: e.target.checked ? null : p.end_year }))} className="rounded" />
                  Currently studying
                </label>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setAddingEdu(false); setAddEduForm(BLANK_EDU) }}>
                    <X className="h-4 w-4 mr-1" />Cancel
                  </Button>
                  <Button type="button" size="sm" disabled={!addEduForm.institution.trim()} onClick={() => { setPendingEdu((p) => [...p, { ...addEduForm, localId: `edu-${Date.now()}` }]); setAddEduForm(BLANK_EDU); setAddingEdu(false) }}>
                    <Check className="h-4 w-4 mr-1" />Add
                  </Button>
                </div>
              </div>
            )}
            {pendingEdu.length === 0 && !addingEdu && (
              <p className="py-4 text-center text-sm text-muted-foreground">No education added yet.</p>
            )}
            {pendingEdu.map((entry) => (
              <div key={entry.localId} className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/10 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{entry.institution}</p>
                  {(entry.degree || entry.field_of_study) && (
                    <p className="text-sm text-muted-foreground truncate">{[entry.degree, entry.field_of_study].filter(Boolean).join(', ')}</p>
                  )}
                  {(entry.start_year || entry.end_year || entry.is_ongoing) && (
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.start_year ?? '?'} – {entry.is_ongoing ? 'Present' : (entry.end_year ?? '?')}</p>
                  )}
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setPendingEdu((p) => p.filter((e) => e.localId !== entry.localId))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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

      {/* Documents — only on create, and only in manual mode (cv mode auto-queues the parsed file) */}
      {!isEditing && entryMode !== 'cv' && (
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

      {/* Notes — only on create */}
      {!isEditing && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>Add an initial note about this candidate (optional).</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="e.g. Strong referral from Nino. Background in fintech. Prefer afternoon interviews."
              value={pendingNote}
              onChange={(e) => setPendingNote(e.target.value)}
              rows={4}
              disabled={isLoading}
            />
          </CardContent>
        </Card>
      )}

      {/* Custom Fields */}
      {customFieldGroups.length > 0 && customFieldGroups.some((g) => g.fields.length > 0) && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
            <CardDescription>Custom fields defined for candidates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <CustomFieldsForm
              groups={customFieldGroups}
              values={cfValues}
              onChange={(fieldId, value) =>
                setCfValues((prev) => ({ ...prev, [fieldId]: value }))
              }
            />
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
