'use client'

import { useState } from 'react'
import { Briefcase, GraduationCap, Plus, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { ExperienceEntryInput, EducationEntryInput } from '@/lib/validations/candidate-background'

export interface BackgroundState {
  experience: ExperienceEntryInput[]
  education: EducationEntryInput[]
}

interface StepExperienceEducationProps {
  value: BackgroundState
  onChange: (next: BackgroundState) => void
  /** True when CV parse has prefilled the lists — used to show the
   * "(N parsed)" hint inline with each section header. */
  parsedFromCv: boolean
}

const BLANK_EXP: ExperienceEntryInput = {
  title: '',
  company: '',
  start_date: '',
  end_date: '',
  is_current: false,
  description: null,
}

const BLANK_EDU: EducationEntryInput = {
  institution: '',
  degree: '',
  field_of_study: '',
  start_year: null,
  end_year: null,
  is_ongoing: false,
}

/**
 * Wave 2.7 candidate wizard — Step 2 / Experience & education per
 * Create Candidate Steps.dc.html.
 *
 * Two card sections with inline list editors. Each list shows the
 * existing entries (CV-prefilled or empty) with a delete control, and
 * an "Add entry" affordance that expands a quick-add form.
 *
 * Validation is deferred to the bulk-create server actions — empty
 * rows are dropped server-side, so the wizard doesn't block the user
 * from advancing if a field is incomplete.
 */
export function StepExperienceEducation({
  value,
  onChange,
  parsedFromCv,
}: StepExperienceEducationProps) {
  return (
    <div className="flex flex-col gap-4">
      <ExperienceCard
        entries={value.experience}
        parsedFromCv={parsedFromCv}
        onChange={(experience) => onChange({ ...value, experience })}
      />
      <EducationCard
        entries={value.education}
        onChange={(education) => onChange({ ...value, education })}
      />
    </div>
  )
}

function ExperienceCard({
  entries,
  parsedFromCv,
  onChange,
}: {
  entries: ExperienceEntryInput[]
  parsedFromCv: boolean
  onChange: (next: ExperienceEntryInput[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<ExperienceEntryInput>(BLANK_EXP)

  const submit = () => {
    if (!draft.title.trim() && !draft.company.trim()) return
    onChange([draft, ...entries])
    setDraft(BLANK_EXP)
    setAdding(false)
  }

  return (
    <section className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]" aria-label="Experience">
      <header className="mb-3 flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-foreground/70" aria-hidden />
        <h3 className="text-[15px] font-bold text-foreground">Experience</h3>
        {parsedFromCv && entries.length > 0 && (
          <span className="text-[12px] text-muted-foreground">({entries.length} parsed)</span>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAdding((v) => !v)}
          className="ml-auto h-7 gap-1 text-[12px]"
        >
          {adding ? <X className="h-3 w-3" aria-hidden /> : <Plus className="h-3 w-3" aria-hidden />}
          {adding ? 'Cancel' : 'Add'}
        </Button>
      </header>

      <ul className="flex flex-col gap-2">
        {entries.map((entry, idx) => (
          <li
            key={`${entry.title}-${entry.company}-${idx}`}
            className="flex items-start gap-2.5 rounded-[9px] border border-[oklch(0.92_0.01_250)] px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-foreground">
                {entry.title || 'Untitled role'}
                {entry.company && (
                  <span className="text-foreground/70"> · {entry.company}</span>
                )}
              </p>
              {(entry.start_date || entry.end_date || entry.is_current) && (
                <p className="text-[11.5px] text-muted-foreground">
                  {entry.start_date || '?'} — {entry.is_current ? 'Present' : entry.end_date || '?'}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onChange(entries.filter((_, i) => i !== idx))}
              aria-label={`Remove ${entry.title || 'experience'}`}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </li>
        ))}
        {entries.length === 0 && !adding && (
          <p className="rounded-[9px] border border-dashed border-border bg-muted/30 px-3 py-2.5 text-[12.5px] text-muted-foreground">
            No experience entries yet. Use Add to enter manually, or upload a CV to prefill.
          </p>
        )}
      </ul>

      {adding && (
        <div className="mt-3 grid gap-2.5 rounded-[9px] border border-dashed border-[oklch(0.85_0.05_250)] bg-[oklch(0.985_0.012_250)] p-3 sm:grid-cols-2">
          <Field id="exp_title" label="Title">
            <Input
              id="exp_title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="e.g. Software Engineer"
              className="h-8 text-[12.5px]"
            />
          </Field>
          <Field id="exp_company" label="Company">
            <Input
              id="exp_company"
              value={draft.company}
              onChange={(e) => setDraft({ ...draft, company: e.target.value })}
              placeholder="e.g. Acme Corp"
              className="h-8 text-[12.5px]"
            />
          </Field>
          <Field id="exp_start" label="Start (YYYY-MM)">
            <Input
              id="exp_start"
              value={draft.start_date ?? ''}
              onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
              placeholder="2024-04"
              className="h-8 text-[12.5px]"
            />
          </Field>
          <Field id="exp_end" label="End (YYYY-MM)">
            <Input
              id="exp_end"
              value={draft.end_date ?? ''}
              onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
              placeholder="Present"
              className="h-8 text-[12.5px]"
            />
          </Field>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setDraft(BLANK_EXP) }}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={submit}
              disabled={!draft.title.trim() && !draft.company.trim()}
            >
              Save entry
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

function EducationCard({
  entries,
  onChange,
}: {
  entries: EducationEntryInput[]
  onChange: (next: EducationEntryInput[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<EducationEntryInput>(BLANK_EDU)

  const submit = () => {
    if (!draft.institution.trim()) return
    onChange([draft, ...entries])
    setDraft(BLANK_EDU)
    setAdding(false)
  }

  return (
    <section className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]" aria-label="Education">
      <header className="mb-3 flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-foreground/70" aria-hidden />
        <h3 className="text-[15px] font-bold text-foreground">Education</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAdding((v) => !v)}
          className="ml-auto h-7 gap-1 text-[12px]"
        >
          {adding ? <X className="h-3 w-3" aria-hidden /> : <Plus className="h-3 w-3" aria-hidden />}
          {adding ? 'Cancel' : 'Add'}
        </Button>
      </header>

      <ul className="flex flex-col gap-2">
        {entries.map((entry, idx) => (
          <li
            key={`${entry.institution}-${entry.degree}-${idx}`}
            className="flex items-start gap-2.5 rounded-[9px] border border-[oklch(0.92_0.01_250)] px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-foreground">
                {entry.institution || 'Untitled institution'}
              </p>
              {(entry.degree || entry.field_of_study) && (
                <p className="text-[11.5px] text-muted-foreground">
                  {[entry.degree, entry.field_of_study].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onChange(entries.filter((_, i) => i !== idx))}
              aria-label={`Remove ${entry.institution || 'education'}`}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </li>
        ))}
        {entries.length === 0 && !adding && (
          <p className="rounded-[9px] border border-dashed border-border bg-muted/30 px-3 py-2.5 text-[12.5px] text-muted-foreground">
            No education entries yet.
          </p>
        )}
      </ul>

      {adding && (
        <div className="mt-3 grid gap-2.5 rounded-[9px] border border-dashed border-[oklch(0.85_0.05_250)] bg-[oklch(0.985_0.012_250)] p-3 sm:grid-cols-2">
          <Field id="edu_institution" label="Institution">
            <Input
              id="edu_institution"
              value={draft.institution}
              onChange={(e) => setDraft({ ...draft, institution: e.target.value })}
              placeholder="e.g. State University"
              className="h-8 text-[12.5px]"
            />
          </Field>
          <Field id="edu_degree" label="Degree">
            <Input
              id="edu_degree"
              value={draft.degree ?? ''}
              onChange={(e) => setDraft({ ...draft, degree: e.target.value })}
              placeholder="e.g. MSc"
              className="h-8 text-[12.5px]"
            />
          </Field>
          <Field id="edu_field" label="Field of study">
            <Input
              id="edu_field"
              value={draft.field_of_study ?? ''}
              onChange={(e) => setDraft({ ...draft, field_of_study: e.target.value })}
              placeholder="e.g. Information Technology"
              className="h-8 text-[12.5px]"
            />
          </Field>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setDraft(BLANK_EDU) }}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={submit}
              disabled={!draft.institution.trim()}
            >
              Save entry
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

function Field({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[10.5px] font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}
