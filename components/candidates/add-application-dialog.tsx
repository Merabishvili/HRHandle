'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Label } from '@/components/ui/label'
import { createApplication } from '@/lib/actions/applications'
import { MAX_ACTIVE_APPLICATIONS_PER_CANDIDATE } from '@/lib/types/constants'
import { createApplicationErrorMessage } from '@/lib/i18n/create-application-error'

interface Vacancy {
  id: string
  title: string
  department: string | null
}

interface AddApplicationDialogProps {
  candidateId: string
  availableVacancies: Vacancy[]
  activeApplicationCount: number
}

export function AddApplicationDialog({
  candidateId,
  availableVacancies,
  activeApplicationCount,
}: AddApplicationDialogProps) {
  const t = useTranslations()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [vacancyId, setVacancyId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const atLimit = activeApplicationCount >= MAX_ACTIVE_APPLICATIONS_PER_CANDIDATE

  const handleSubmit = () => {
    if (!vacancyId) { setError(t('addApp.selectVacancy')); return }
    setError(null)
    startTransition(async () => {
      const result = await createApplication({ candidateId, vacancyId })
      if (result.success) {
        setOpen(false)
        setVacancyId('')
        router.refresh()
      } else {
        setError(createApplicationErrorMessage(t, result))
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setVacancyId(''); setError(null) } }}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          disabled={atLimit}
          title={
            atLimit
              ? t('addApp.tooltipLimit', { max: MAX_ACTIVE_APPLICATIONS_PER_CANDIDATE })
              : undefined
          }
        >
          <Plus className="mr-1 h-4 w-4" />
          {t('addApp.title')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('addApp.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {atLimit && (
            <p className="text-sm text-destructive">
              {t('addApp.atLimit', { max: MAX_ACTIVE_APPLICATIONS_PER_CANDIDATE })}
            </p>
          )}
          <div className="space-y-2">
            <Label>{t('candWizard.review.vacancy')}</Label>
            {availableVacancies.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('addApp.noOpenVacancies')}</p>
            ) : (
              <SearchableSelect
                value={vacancyId}
                onValueChange={setVacancyId}
                disabled={isPending}
                placeholder={t('addApp.selectPlaceholder')}
                searchPlaceholder={t('interviews.form.searchVacancies')}
                emptyText={t('interviews.form.noVacancies')}
                options={availableVacancies.map((v) => ({
                  value: v.id,
                  label: v.title,
                  searchText: `${v.title} ${v.department ?? ''}`,
                  description: v.department ?? undefined,
                }))}
              />
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isPending || !vacancyId || availableVacancies.length === 0}
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('addApp.apply')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
