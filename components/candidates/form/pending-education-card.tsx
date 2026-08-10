'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { GraduationCap, Plus, X, Check, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export type EduLocal = {
  localId: string
  institution: string
  degree: string | null
  field_of_study: string | null
  start_year: number | null
  end_year: number | null
  is_ongoing: boolean
}

const BLANK_EDU: Omit<EduLocal, 'localId'> = {
  institution: '',
  degree: null,
  field_of_study: null,
  start_year: null,
  end_year: null,
  is_ongoing: false,
}

interface PendingEducationCardProps {
  entries: EduLocal[]
  onAdd: (entry: EduLocal) => void
  onRemove: (localId: string) => void
  disabled: boolean
}

/**
 * Create-only Education editor. Owns its own "adding" draft state; commits an
 * entry to the parent via onAdd. Extracted from candidate-form.tsx (A-005).
 */
export function PendingEducationCard({ entries, onAdd, onRemove, disabled }: PendingEducationCardProps) {
  const t = useTranslations()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Omit<EduLocal, 'localId'>>(BLANK_EDU)

  const reset = () => {
    setDraft(BLANK_EDU)
    setAdding(false)
  }

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            {t('candWizard.background.education')}
          </CardTitle>
          <CardDescription>{t('candidateForm.eduDesc')}</CardDescription>
        </div>
        {!adding && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { setAdding(true); setDraft(BLANK_EDU) }}
            disabled={disabled}
          >
            <Plus className="h-4 w-4 mr-1" />{t('wizard.add')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">{t('candWizard.background.institution')} *</Label>
              <Input value={draft.institution} onChange={(e) => setDraft((p) => ({ ...p, institution: e.target.value }))} placeholder={t('candidateForm.phInstitutionName')} maxLength={200} disabled={disabled} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">{t('candWizard.background.degree')}</Label>
                <Input value={draft.degree ?? ''} onChange={(e) => setDraft((p) => ({ ...p, degree: e.target.value || null }))} placeholder={t('candidateForm.phDegree2')} maxLength={100} disabled={disabled} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('candWizard.background.fieldOfStudy')}</Label>
                <Input value={draft.field_of_study ?? ''} onChange={(e) => setDraft((p) => ({ ...p, field_of_study: e.target.value || null }))} placeholder={t('candidateForm.phField2')} maxLength={200} disabled={disabled} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">{t('candidateForm.startYear')}</Label>
                <Input type="number" min={1950} max={new Date().getFullYear()} value={draft.start_year ?? ''} onChange={(e) => setDraft((p) => ({ ...p, start_year: e.target.value ? Number(e.target.value) : null }))} placeholder={t('candidateForm.phStartYear')} disabled={disabled} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('candidateForm.endYear')}</Label>
                <Input type="number" min={1950} max={new Date().getFullYear() + 10} value={draft.end_year ?? ''} onChange={(e) => setDraft((p) => ({ ...p, end_year: e.target.value ? Number(e.target.value) : null }))} placeholder={t('candidateForm.phEndYear')} disabled={disabled || draft.is_ongoing} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={draft.is_ongoing} onChange={(e) => setDraft((p) => ({ ...p, is_ongoing: e.target.checked, end_year: e.target.checked ? null : p.end_year }))} className="rounded" />
              {t('candidateForm.currentlyStudying')}
            </label>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                <X className="h-4 w-4 mr-1" />{t('common.cancel')}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!draft.institution.trim()}
                onClick={() => { onAdd({ ...draft, localId: `edu-${Date.now()}` }); reset() }}
              >
                <Check className="h-4 w-4 mr-1" />{t('wizard.add')}
              </Button>
            </div>
          </div>
        )}
        {entries.length === 0 && !adding && (
          <p className="py-4 text-center text-sm text-muted-foreground">{t('candidateForm.noEduAdded')}</p>
        )}
        {entries.map((entry) => (
          <div key={entry.localId} className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/10 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{entry.institution}</p>
              {(entry.degree || entry.field_of_study) && (
                <p className="text-sm text-muted-foreground truncate">{[entry.degree, entry.field_of_study].filter(Boolean).join(', ')}</p>
              )}
              {(entry.start_year || entry.end_year || entry.is_ongoing) && (
                <p className="text-xs text-muted-foreground mt-0.5">{entry.start_year ?? '?'} – {entry.is_ongoing ? t('candWizard.background.present') : (entry.end_year ?? '?')}</p>
              )}
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" aria-label={t('candidateForm.removeEduEntry')} onClick={() => onRemove(entry.localId)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
