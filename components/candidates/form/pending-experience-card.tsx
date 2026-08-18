'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Briefcase, Plus, X, Check, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export type ExpLocal = {
  localId: string
  company: string
  title: string
  start_date: string | null
  end_date: string | null
  is_current: boolean
  description: string | null
}

const BLANK_EXP: Omit<ExpLocal, 'localId'> = {
  company: '',
  title: '',
  start_date: null,
  end_date: null,
  is_current: false,
  description: null,
}

interface PendingExperienceCardProps {
  entries: ExpLocal[]
  onAdd: (entry: ExpLocal) => void
  onRemove: (localId: string) => void
  disabled: boolean
}

/**
 * Create-only Experience editor. Owns its own "adding" draft state; commits an
 * entry to the parent via onAdd. Extracted from candidate-form.tsx (A-005).
 */
export function PendingExperienceCard({ entries, onAdd, onRemove, disabled }: PendingExperienceCardProps) {
  const t = useTranslations()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Omit<ExpLocal, 'localId'>>(BLANK_EXP)

  const reset = () => {
    setDraft(BLANK_EXP)
    setAdding(false)
  }

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            {t('candWizard.background.experience')}
          </CardTitle>
          <CardDescription>{t('candidateForm.expDesc')}</CardDescription>
        </div>
        {!adding && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { setAdding(true); setDraft(BLANK_EXP) }}
            disabled={disabled}
          >
            <Plus className="h-4 w-4 mr-1" />{t('wizard.add')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">{t('candWizard.background.company')} *</Label>
                <Input value={draft.company} onChange={(e) => setDraft((p) => ({ ...p, company: e.target.value }))} placeholder={t('candidateForm.phCompanyName')} maxLength={200} disabled={disabled} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('candWizard.background.title')} *</Label>
                <Input value={draft.title} onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))} placeholder={t('candidateForm.phJobTitle')} maxLength={200} disabled={disabled} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">{t('candidateForm.startDate')}</Label>
                <Input type="month" value={draft.start_date ?? ''} onChange={(e) => setDraft((p) => ({ ...p, start_date: e.target.value || null }))} disabled={disabled} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('candidateForm.endDate')}</Label>
                <Input type="month" value={draft.end_date ?? ''} onChange={(e) => setDraft((p) => ({ ...p, end_date: e.target.value || null }))} disabled={disabled || draft.is_current} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={draft.is_current} onChange={(e) => setDraft((p) => ({ ...p, is_current: e.target.checked, end_date: e.target.checked ? null : p.end_date }))} className="rounded" />
              {t('candidateForm.currentlyWorking')}
            </label>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                <X className="h-4 w-4 mr-1" />{t('common.cancel')}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!draft.company.trim() || !draft.title.trim()}
                onClick={() => { onAdd({ ...draft, localId: `exp-${Date.now()}` }); reset() }}
              >
                <Check className="h-4 w-4 mr-1" />{t('wizard.add')}
              </Button>
            </div>
          </div>
        )}
        {entries.length === 0 && !adding && (
          <p className="py-4 text-center text-sm text-muted-foreground">{t('candidateForm.noExpAdded')}</p>
        )}
        {entries.map((entry) => (
          <div key={entry.localId} className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/10 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{entry.title}</p>
              <p className="text-sm text-muted-foreground truncate">{entry.company}</p>
              {(entry.start_date || entry.is_current || entry.end_date) && (
                <p className="text-xs text-muted-foreground mt-0.5">{entry.start_date ?? '?'} – {entry.is_current ? t('candWizard.background.present') : (entry.end_date ?? '?')}</p>
              )}
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" aria-label={t('candidateForm.removeExpEntry')} onClick={() => onRemove(entry.localId)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
