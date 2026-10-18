'use client'

import { useTranslations } from 'next-intl'
import { ArrowRight, Loader2, Users } from 'lucide-react'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { RemainingSummary } from '@/lib/actions/applications'
import { pipelineStageLabel } from '@/lib/pipeline/status-i18n'

export interface CloseVacancyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: 'close' | 'archive'
  summary: RemainingSummary
  pending: boolean
  /** Close (or archive); with `thenReject`, open "Reject remaining candidates" next. */
  onConfirm: (thenReject: boolean) => void
}

/**
 * Asked when an owner/admin closes or archives a vacancy that still has
 * candidates in progress: close only, or close and go on to reject them.
 * Without anyone in progress the vacancy just closes — this never shows.
 */
export function CloseVacancyDialog({ open, onOpenChange, action, summary, pending, onConfirm }: CloseVacancyDialogProps) {
  const t = useTranslations()
  const archive = action === 'archive'
  const stageName = (name: string) => (name ? pipelineStageLabel(t, name) : t('reports.stage.applied'))

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl">{t(archive ? 'closeVacancy.archiveTitle' : 'closeVacancy.closeTitle')}</DialogTitle>
          <DialogDescription>
            {t(archive ? 'closeVacancy.archiveSubtitle' : 'closeVacancy.closeSubtitle', { title: summary.vacancyTitle })}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          <div
            role="group"
            aria-label={t('closeVacancy.inProgress', { count: summary.total })}
            className="flex gap-3 rounded-xl border border-[oklch(0.9_0.05_75)] bg-[oklch(0.985_0.012_75)] p-4"
          >
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-[oklch(0.6_0.13_65)]" aria-hidden />
            <div className="min-w-0 space-y-1.5">
              <p className="font-semibold text-foreground">{t('closeVacancy.inProgress', { count: summary.total })}</p>
              <p className="text-sm text-muted-foreground">{t(archive ? 'closeVacancy.archiveHint' : 'closeVacancy.closeHint')}</p>
              <ul className="flex flex-wrap gap-2 pt-1.5">
                {summary.stages.map((s) => (
                  <li key={s.key} className="rounded-lg border border-border bg-white px-3 py-1 text-sm text-foreground">
                    {stageName(s.name)} {s.count}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending} className="sm:-ml-3">
            {t('common.cancel')}
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => onConfirm(false)} disabled={pending}>
              {t(archive ? 'closeVacancy.archiveOnly' : 'closeVacancy.closeOnly')}
            </Button>
            <Button
              onClick={() => onConfirm(true)}
              disabled={pending}
              className="gap-2 bg-[oklch(0.55_0.18_250)] text-white hover:bg-[oklch(0.5_0.18_250)]"
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t(archive ? 'closeVacancy.archiveAndReject' : 'closeVacancy.closeAndReject')}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
