'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type SubmitHandler, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { createCandidate, updateCandidate } from '@/lib/actions/candidates'
import { toDisplayName } from '@/lib/format-name'
import { uploadDocument } from '@/lib/actions/documents'
import { createNote } from '@/lib/actions/notes'
import { saveCustomFieldValues } from '@/lib/actions/custom-fields'
import { Button } from '@/components/ui/button'
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
import { Loader2, Paperclip, X, Upload, FileText, Wand2, PenLine, CheckCircle2, AlertCircle } from 'lucide-react'
import { bulkCreateExperienceEntries, bulkCreateEducationEntries } from '@/lib/actions/candidate-background'
import type { ParsedCVInput } from '@/lib/validations/candidate-background'
import { CustomFieldsForm, valuesToMap, mapToValueUpserts } from '@/components/custom-fields/custom-fields-form'
import { PersonalInfoSection } from '@/components/candidates/form/personal-info-section'
import { RecruitmentDetailsSection } from '@/components/candidates/form/recruitment-details-section'
import { PendingExperienceCard, type ExpLocal } from '@/components/candidates/form/pending-experience-card'
import { PendingEducationCard, type EduLocal } from '@/components/candidates/form/pending-education-card'
import { CandidateFormSchema, type CandidateFormValues } from '@/lib/validations/candidate'
import type { Candidate, Vacancy } from '@/lib/types'
import type { CustomFieldGroupWithFields, CustomFieldValue } from '@/lib/actions/custom-fields'

const DOCUMENT_TYPE_OPTIONS = [
  { value: 'cv', label: 'CV / Resume' },
  { value: 'cover_letter', label: 'Cover letter' },
  { value: 'other', label: 'Other' },
]

interface PendingFile {
  id: string
  file: File
  documentType: string
}

interface CandidateFormProps {
  candidate?: Candidate
  vacancies: Pick<Vacancy, 'id' | 'title'>[]
  defaultVacancyId?: string
  defaultApplicationStatusId?: string | null
  initialApplicationStatuses?: unknown
  customFieldGroups?: CustomFieldGroupWithFields[]
  customFieldValues?: CustomFieldValue[]
  /**
   * Extra sections rendered between the personal-info card and the
   * Custom Fields card. Used on the edit page to inject live
   * ExperienceSection / EducationSection editors in the same vertical
   * position as the inline Experience/Education on the create page.
   */
  extraSections?: React.ReactNode
}

type EntryMode = null | 'cv' | 'manual'
type CvParseState = 'idle' | 'parsing' | 'done' | 'failed'

// Priority mirrors the field order; on invalid submit we land the user on the
// first offending field (the required name fields, then the format-checked ones).
const ERROR_PRIORITY: (keyof CandidateFormValues)[] = [
  'first_name',
  'last_name',
  'email',
  'linkedin_profile_url',
]

export function CandidateForm({
  candidate,
  vacancies,
  defaultVacancyId,
  customFieldGroups = [],
  customFieldValues = [],
  extraSections,
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
  const [, setParsedCV] = useState<ParsedCVInput | null>(null)
  const [cvFileName, setCvFileName] = useState<string | null>(null)

  // Pending experience/education for create form (local state, saved on submit)
  const [pendingExp, setPendingExp] = useState<ExpLocal[]>([])
  const [pendingEdu, setPendingEdu] = useState<EduLocal[]>([])

  const [selectedVacancyId, setSelectedVacancyId] = useState<string>(defaultVacancyId || '')
  const [pendingNote, setPendingNote] = useState('')

  const isEditing = !!candidate

  const form = useForm<CandidateFormValues>({
    resolver: zodResolver(CandidateFormSchema),
    defaultValues: {
      // Normalize ALL-CAPS names (CV imports / caps-lock applies) to natural case
      // so Edit shows "Aleksandre" not "ALEKSANDRE" — and saving persists the
      // fixed casing. toDisplayName leaves mixed-case + non-Latin names untouched.
      first_name: toDisplayName(candidate?.first_name),
      last_name: toDisplayName(candidate?.last_name),
      email: candidate?.email ?? '',
      phone: candidate?.phone ?? '',
      linkedin_profile_url: candidate?.linkedin_profile_url ?? '',
      location: (candidate as { location?: string | null })?.location ?? '',
      timezone: (candidate as { timezone?: string | null })?.timezone ?? '',
      languages: (candidate as { languages?: string[] })?.languages ?? [],
      salary_expectation: (candidate as { salary_expectation?: string | null })?.salary_expectation ?? '',
      notice_period: (candidate as { notice_period?: string | null })?.notice_period ?? '',
      source: candidate?.source ?? '',
    },
  })

  const handleCVUploadForParsing = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (cvUploadRef.current) cvUploadRef.current.value = ''

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'doc', 'docx'].includes(ext ?? '')) {
      setError('CV must be a PDF or Word document.')
      toast.error('CV must be a PDF or Word document.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('CV file must be 10 MB or smaller.')
      toast.error('CV file must be 10 MB or smaller.')
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
        // Fill only the fields the CV provided; keep whatever the user already typed.
        const cur = form.getValues()
        form.setValue('first_name', toDisplayName(data.first_name) || cur.first_name)
        form.setValue('last_name', toDisplayName(data.last_name) || cur.last_name)
        form.setValue('email', data.email || cur.email)
        form.setValue('phone', data.phone || cur.phone)
        form.setValue('linkedin_profile_url', data.linkedin_profile_url || cur.linkedin_profile_url)
        form.setValue('location', data.location || cur.location)
        form.setValue('timezone', data.timezone || cur.timezone)
        form.setValue('languages', data.languages?.length ? data.languages : cur.languages)
        form.setValue('salary_expectation', data.salary_expectation || cur.salary_expectation)
        form.setValue('notice_period', data.notice_period || cur.notice_period)
        if (data.experience.length > 0) {
          setPendingExp(data.experience
            .filter((x) => x.company && x.title)
            .map((x, i) => ({ localId: `cv-exp-${i}`, company: x.company ?? '', title: x.title ?? '', start_date: x.start_date ?? null, end_date: x.end_date ?? null, is_current: x.is_current, description: x.description ?? null }))
          )
        }
        if (data.education.length > 0) {
          setPendingEdu(data.education
            .filter((x) => x.institution)
            .map((x, i) => ({ localId: `cv-edu-${i}`, institution: x.institution ?? '', degree: x.degree ?? null, field_of_study: x.field_of_study ?? null, start_year: x.start_year ?? null, end_year: x.end_year ?? null, is_ongoing: x.is_ongoing }))
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

  const reportValidationError = (message: string, fieldId: string) => {
    setError(message)
    toast.error(message)
    if (typeof window === 'undefined') return
    const el = document.getElementById(fieldId)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => el.focus({ preventScroll: true }), 350)
  }

  const onInvalid = (errors: FieldErrors<CandidateFormValues>) => {
    for (const key of ERROR_PRIORITY) {
      const fieldError = errors[key]
      if (fieldError?.message) {
        reportValidationError(String(fieldError.message), key)
        return
      }
    }
  }

  const onValid: SubmitHandler<CandidateFormValues> = async (values) => {
    setError(null)
    setIsLoading(true)

    const payload = {
      first_name: values.first_name, // schema trims
      last_name: values.last_name,
      email: values.email || null,
      phone: values.phone || null,
      linkedin_profile_url: values.linkedin_profile_url || null,
      location: values.location || null,
      timezone: values.timezone || null,
      languages: values.languages ?? [],
      salary_expectation: values.salary_expectation || null,
      notice_period: values.notice_period || null,
      source: values.source || null,
    }

    const result = isEditing
      ? await updateCandidate(candidate.id, payload)
      : await createCandidate(payload, selectedVacancyId || null)

    if (!result.success) {
      setError(result.error)
      toast.error(result.error)
      setIsLoading(false)
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
          toast.error(`Document upload failed: ${uploadResult.error}`)
          setIsLoading(false)
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
    <form onSubmit={form.handleSubmit(onValid, onInvalid)} className="space-y-6">
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
              <Button type="button" variant="outline" onClick={() => cvUploadRef.current?.click()}>
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

      <PersonalInfoSection form={form} disabled={isLoading} />

      {/* Live Experience / Education editors (edit mode only) — kept in the
          same vertical position as the inline create-mode sections below. */}
      {isEditing && extraSections}

      {/* Experience + Education (create only) */}
      {!isEditing && (
        <PendingExperienceCard
          entries={pendingExp}
          onAdd={(entry) => setPendingExp((p) => [...p, entry])}
          onRemove={(localId) => setPendingExp((p) => p.filter((e) => e.localId !== localId))}
          disabled={isLoading}
        />
      )}
      {!isEditing && (
        <PendingEducationCard
          entries={pendingEdu}
          onAdd={(entry) => setPendingEdu((p) => [...p, entry])}
          onRemove={(localId) => setPendingEdu((p) => p.filter((e) => e.localId !== localId))}
          disabled={isLoading}
        />
      )}

      <RecruitmentDetailsSection
        form={form}
        disabled={isLoading}
        isEditing={isEditing}
        vacancies={vacancies}
        selectedVacancyId={selectedVacancyId}
        onSelectedVacancyChange={setSelectedVacancyId}
      />

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
                      aria-label="Remove file"
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
              placeholder="e.g. Strong referral from a teammate. Background in fintech. Prefer afternoon interviews."
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
            <CardTitle>Additional information</CardTitle>
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
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(isEditing ? `/candidates/${candidate.id}` : '/candidates')}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEditing ? 'Updating…' : 'Adding…'}
            </>
          ) : isEditing ? (
            'Update Candidate'
          ) : (
            'Add candidate'
          )}
        </Button>
      </div>
    </form>
  )
}
