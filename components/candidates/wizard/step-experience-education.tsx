'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<ExperienceEntryInput>(BLANK_EXP)

  const submit = () => {
    if (!draft.title.trim() && !draft.company.trim()) return
    onChange([draft, ...entries])
    setDraft(BLANK_EXP)
    setAdding(false)
  }

  return (
    <section className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]" aria-label={t('candWizard.background.experience')}>
      <header className="mb-3 flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-foreground/70" aria-hidden />
        <h3 className="text-[15px] font-bold text-foreground">{t('candWizard.background.experience')}</h3>
        {parsedFromCv && entries.length > 0 && (
          <span className="text-[12px] text-muted-foreground">{t('candWizard.background.parsedCount', { count: entries.length })}</span>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAdding((v) => !v)}
          className="ml-auto h-7 gap-1 text-[12px]"
        >
          {adding ? <X className="h-3 w-3" aria-hidden /> : <Plus className="h-3 w-3" aria-hidden />}
          {adding ? t('common.cancel') : t('wizard.add')}
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
                {entry.title || t('candWizard.background.untitledRole')}
                {entry.company && (
                  <span className="text-foreground/70"> · {entry.company}</span>
                )}
              </p>
              {(entry.start_date || entry.end_date || entry.is_current) && (
                <p className="text-[11.5px] text-muted-foreground">
                  {entry.start_date || '?'} — {entry.is_current ? t('candWizard.background.present') : entry.end_date || '?'}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onChange(entries.filter((_, i) => i !== idx))}
              aria-label={t('wizard.removeNamed', { label: entry.title || t('candWizard.background.expFallback') })}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </li>
        ))}
        {entries.length === 0 && !adding && (
          <p className="rounded-[9px] border border-dashed border-border bg-muted/30 px-3 py-2.5 text-[12.5px] text-muted-foreground">
            {t('candWizard.background.noExpYet')}
          </p>
        )}
      </ul>

      {adding && (
        <div className="mt-3 grid gap-2.5 rounded-[9px] border border-dashed border-[oklch(0.85_0.05_250)] bg-[oklch(0.985_0.012_250)] p-3 sm:grid-cols-2">
          <Field id="exp_title" label={t('candWizard.background.title')}>
            <Input
              id="exp_title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder={t('candWizard.background.phTitle')}
              className="h-8 text-[12.5px]"
            />
          </Field>
          <Field id="exp_company" label={t('candWizard.background.company')}>
            <Input
              id="exp_company"
              value={draft.company}
              onChange={(e) => setDraft({ ...draft, company: e.target.value })}
              placeholder={t('candWizard.background.phCompany')}
              className="h-8 text-[12.5px]"
            />
          </Field>
          <Field id="exp_start" label={t('candWizard.background.startYm')}>
            <Input
              id="exp_start"
              value={draft.start_date ?? ''}
              onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
              placeholder="2024-04"
              className="h-8 text-[12.5px]"
            />
          </Field>
          <Field id="exp_end" label={t('candWizard.background.endYm')}>
            <Input
              id="exp_end"
              value={draft.end_date ?? ''}
              onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
              placeholder={t('candWizard.background.present')}
              className="h-8 text-[12.5px]"
            />
          </Field>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setDraft(BLANK_EXP) }}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={submit}
              disabled={!draft.title.trim() && !draft.company.trim()}
            >
              {t('candWizard.background.saveEntry')}
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
  const t = useTranslations()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<EducationEntryInput>(BLANK_EDU)

  const submit = () => {
    if (!draft.institution.trim()) return
    onChange([draft, ...entries])
    setDraft(BLANK_EDU)
    setAdding(false)
  }

  return (
    <section className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]" aria-label={t('candWizard.background.education')}>
      <header className="mb-3 flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-foreground/70" aria-hidden />
        <h3 className="text-[15px] font-bold text-foreground">{t('candWizard.background.education')}</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAdding((v) => !v)}
          className="ml-auto h-7 gap-1 text-[12px]"
        >
          {adding ? <X className="h-3 w-3" aria-hidden /> : <Plus className="h-3 w-3" aria-hidden />}
          {adding ? t('common.cancel') : t('wizard.add')}
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
                {entry.institution || t('candWizard.background.untitledInstitution')}
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
              aria-label={t('wizard.removeNamed', { label: entry.institution || t('candWizard.background.eduFallback') })}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </li>
        ))}
        {entries.length === 0 && !adding && (
          <p className="rounded-[9px] border border-dashed border-border bg-muted/30 px-3 py-2.5 text-[12.5px] text-muted-foreground">
            {t('candWizard.background.noEduYet')}
          </p>
        )}
      </ul>

      {adding && (
        <div className="mt-3 grid gap-2.5 rounded-[9px] border border-dashed border-[oklch(0.85_0.05_250)] bg-[oklch(0.985_0.012_250)] p-3 sm:grid-cols-2">
          <Field id="edu_institution" label={t('candWizard.background.institution')}>
            <Input
              id="edu_institution"
              value={draft.institution}
              onChange={(e) => setDraft({ ...draft, institution: e.target.value })}
              placeholder={t('candWizard.background.phInstitution')}
              className="h-8 text-[12.5px]"
            />
          </Field>
          <Field id="edu_degree" label={t('candWizard.background.degree')}>
            <Input
              id="edu_degree"
              value={draft.degree ?? ''}
              onChange={(e) => setDraft({ ...draft, degree: e.target.value })}
              placeholder={t('candWizard.background.phDegree')}
              className="h-8 text-[12.5px]"
            />
          </Field>
          <Field id="edu_field" label={t('candWizard.background.fieldOfStudy')}>
            <Input
              id="edu_field"
              value={draft.field_of_study ?? ''}
              onChange={(e) => setDraft({ ...draft, field_of_study: e.target.value })}
              placeholder={t('candWizard.background.phField')}
              className="h-8 text-[12.5px]"
            />
          </Field>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setDraft(BLANK_EDU) }}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={submit}
              disabled={!draft.institution.trim()}
            >
              {t('candWizard.background.saveEntry')}
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
