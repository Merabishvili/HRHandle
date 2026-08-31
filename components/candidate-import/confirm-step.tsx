'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Check, Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { startImport } from '@/lib/actions/candidate-import'
import type { ValidatedRow } from '@/lib/candidate-import/validation'
import { ImportHeader } from './import-header'
import { ImportStepper } from './import-stepper'
import { ImportDataTable } from './import-data-table'
import type { Dataset } from './import-flow'

export function ConfirmStep({
  dataset,
  readyRows,
  importedCount,
  onBack,
  onStarted,
}: {
  dataset: Dataset
  readyRows: ValidatedRow[]
  importedCount: number
  onBack: () => void
  onStarted: (jobId: string) => void
}) {
  const t = useTranslations()
  const [isPending, startTransition] = useTransition()
  const [deletedCount] = useState(dataset.rows.length - readyRows.length)

  const commit = () => {
    startTransition(async () => {
      const res = await startImport(dataset.importId)
      if (res.success) {
        onStarted(res.data.jobId)
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="space-y-6">
      <ImportHeader subtitle={t('csvImport.confirmSubtitle')} />
      <ImportStepper current="confirm" />

      {/* Success summary bar */}
      <div className="flex flex-wrap items-center gap-6 rounded-lg border border-border bg-card px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-success/10">
            <Check className="h-4 w-4 text-success" />
          </span>
          <div>
            <div className="text-[13px] text-muted-foreground">{t('csvImport.willImport')}</div>
            <div className="text-xl font-bold text-foreground">
              {t('csvImport.nCandidates', { n: importedCount })}
            </div>
          </div>
        </div>
        <span className="h-9 w-px bg-border" />
        <div>
          <div className="text-[13px] text-muted-foreground">{t('csvImport.deletedRows')}</div>
          <div className="text-xl font-bold text-muted-foreground">{deletedCount}</div>
        </div>
        <span className="h-9 w-px bg-border" />
        <div className="min-w-0">
          <div className="text-[13px] text-muted-foreground">{t('csvImport.file')}</div>
          <div className="truncate text-sm font-medium text-foreground">{dataset.filename}</div>
        </div>
      </div>

      <ImportDataTable rows={readyRows} mode="readonly" numbering="sequential" />

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={onBack} disabled={isPending}>
          {t('csvImport.back')}
        </Button>
        <Button className="ml-auto gap-2" onClick={commit} disabled={isPending || importedCount === 0}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {t('csvImport.commitN', { n: importedCount })}
        </Button>
      </div>
    </div>
  )
}
