'use client'

import { useRef, useTransition } from 'react'
import { FileText, Loader2, Upload, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AiDraftTag } from '@/components/ui/ai-draft-tag'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ParsedCVInput } from '@/lib/validations/candidate-background'
import type { EntryMode } from './step-path-select'

export interface PersonalState {
  firstName: string
  lastName: string
  email: string
  phone: string
  location: string
  timezone: string
  salaryExpectation: string
  noticePeriod: string
  languages: string
  linkedinUrl: string
}

interface StepPersonalProps {
  value: PersonalState
  onChange: (next: PersonalState) => void
  entryMode: EntryMode
  /** Notification to parent when a CV upload completes (so the wizard
   * can stash parsed experience/education for Step 2 and the parsed-
   * file metadata for Step 4). */
  onCvParsed: (parsed: ParsedCVInput, file: File) => void
  /** Currently-uploaded CV reference (null when removed). Shown above
   * the personal fields as the AI-filled banner. */
  cvFile: File | null
  onCvCleared: () => void
}

/**
 * Wave 2.7 candidate wizard — Step 1 / Personal information per
 * Create Candidate Steps.dc.html.
 *
 * Header bar (CV mode): drop zone → parsing spinner → "AI-filled ·
 * review" banner once parse succeeds. Below: the standard personal
 * fields, prefilled when parse completed. (There is no General Status
 * field — status is derived from the application stage.)
 */
export function StepPersonal({
  value,
  onChange,
  entryMode,
  onCvParsed,
  cvFile,
  onCvCleared,
}: StepPersonalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()

  const set = <K extends keyof PersonalState>(key: K, v: PersonalState[K]) => {
    onChange({ ...value, [key]: v })
  }

  const handleFile = (file: File | null) => {
    if (!file) return
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!['.pdf', '.doc', '.docx'].includes(ext)) {
      toast.error('Upload a PDF or Word document (.pdf, .doc, .docx).')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('CV must be 10 MB or smaller.')
      return
    }

    startTransition(async () => {
      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/parse-cv', { method: 'POST', body: fd })
        const json = await res.json()
        if (!json.success || !json.data) {
          toast.error('Could not read this file — please enter details manually.')
          return
        }
        const data: ParsedCVInput = json.data
        onChange({
          firstName: data.first_name ?? value.firstName,
          lastName: data.last_name ?? value.lastName,
          email: data.email ?? value.email,
          phone: data.phone ?? value.phone,
          location: data.location ?? value.location,
          timezone: value.timezone,
          salaryExpectation: value.salaryExpectation,
          noticePeriod: value.noticePeriod,
          languages: value.languages,
          linkedinUrl: data.linkedin_profile_url ?? value.linkedinUrl,
        })
        onCvParsed(data, file)
        toast.success('CV parsed — review prefilled fields.')
      } catch (err) {
        console.error('[wizard] CV parse failed:', err)
        toast.error('Could not reach the server — please enter details manually.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {entryMode === 'cv' && !cvFile && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-[oklch(0.8_0.04_250)] bg-[oklch(0.985_0.012_250)] px-4 py-3.5 text-[13px] font-medium text-[oklch(0.45_0.16_250)] transition-colors hover:bg-[oklch(0.96_0.025_250)] disabled:opacity-50"
          aria-label="Upload CV"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Parsing CV…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" aria-hidden />
              Upload PDF or Word (max 10 MB)
            </>
          )}
        </button>
      )}

      {cvFile && (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-[oklch(0.88_0.05_250)] bg-[oklch(0.985_0.012_250)] px-3.5 py-2.5">
          <FileText className="h-4 w-4 text-[oklch(0.45_0.16_250)]" aria-hidden />
          <span className="flex-1 truncate text-[12.5px] text-foreground">
            <strong className="font-semibold">{cvFile.name}</strong> parsed — review fields below
          </span>
          <AiDraftTag label="AI-filled · review" />
          <button
            type="button"
            onClick={onCvCleared}
            aria-label="Remove uploaded CV"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="first_name" label="First name" required>
          <Input
            id="first_name"
            autoComplete="given-name"
            value={value.firstName}
            onChange={(e) => set('firstName', e.target.value)}
            maxLength={100}
          />
        </Field>
        <Field id="last_name" label="Last name" required>
          <Input
            id="last_name"
            autoComplete="family-name"
            value={value.lastName}
            onChange={(e) => set('lastName', e.target.value)}
            maxLength={100}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="email" label="Email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={value.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="alex@example.com"
            maxLength={254}
          />
        </Field>
        <Field id="phone" label="Phone">
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={value.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="+1 555 123 4567"
            maxLength={30}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="location" label="Location">
          <Input
            id="location"
            value={value.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="e.g. San Francisco, USA"
            maxLength={100}
          />
        </Field>
        <Field id="timezone" label="Timezone">
          <Input
            id="timezone"
            value={value.timezone}
            onChange={(e) => set('timezone', e.target.value)}
            placeholder="e.g. GMT+1"
            maxLength={50}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="salary_expectation" label="Salary expectation">
          <Input
            id="salary_expectation"
            value={value.salaryExpectation}
            onChange={(e) => set('salaryExpectation', e.target.value)}
            placeholder="e.g. USD 3,000 / mo"
            maxLength={50}
          />
        </Field>
        <Field id="notice_period" label="Notice period">
          <Input
            id="notice_period"
            value={value.noticePeriod}
            onChange={(e) => set('noticePeriod', e.target.value)}
            placeholder="e.g. 1 month"
            maxLength={50}
          />
        </Field>
      </div>

      <Field id="languages" label="Languages">
        <Input
          id="languages"
          value={value.languages}
          onChange={(e) => set('languages', e.target.value)}
          placeholder="e.g. English, Spanish, French"
          maxLength={200}
        />
      </Field>

      <Field id="linkedin" label="LinkedIn">
        <Input
          id="linkedin"
          type="url"
          autoComplete="url"
          inputMode="url"
          value={value.linkedinUrl}
          onChange={(e) => set('linkedinUrl', e.target.value)}
          placeholder="https://linkedin.com/in/…"
          maxLength={500}
        />
      </Field>
    </div>
  )
}

function Field({
  id,
  label,
  required,
  children,
}: {
  id: string
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn('space-y-1.5')}>
      <Label htmlFor={id} className="text-[11.5px] font-medium text-muted-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  )
}
