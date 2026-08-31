'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ImportField } from '@/lib/candidate-import/parsing'
import type { ValidatedRow } from '@/lib/candidate-import/validation'
import { ImportHeader } from './import-header'
import { ImportStepper } from './import-stepper'
import { ImportDataTable } from './import-data-table'
import type { Dataset } from './import-flow'

type Filter = 'error' | 'ready' | 'all'

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ReviewStep({
  dataset,
  orderedRows,
  counts,
  onUpdateCell,
  onDeleteRows,
  onRestart,
  onNext,
}: {
  dataset: Dataset
  orderedRows: ValidatedRow[]
  counts: { total: number; ready: number; error: number }
  onUpdateCell: (csvRow: number, field: ImportField, value: string) => void
  onDeleteRows: (csvRows: number[]) => void
  onRestart: () => void
  onNext: () => void
}) {
  const t = useTranslations()
  const [filter, setFilter] = useState<Filter>(counts.error > 0 ? 'error' : 'all')

  const filtered = useMemo(() => {
    if (filter === 'all') return orderedRows
    return orderedRows.filter((r) => (filter === 'error' ? r.status === 'error' : r.status === 'ready'))
  }, [orderedRows, filter])

  const confirmRestart = () => {
    if (window.confirm(t('csvImport.confirmRestart'))) onRestart()
  }
  const bulkDeleteErrored = () => {
    const errored = orderedRows.filter((r) => r.status === 'error').map((r) => r.csvRow)
    if (errored.length === 0) return
    if (window.confirm(t('csvImport.confirmBulkDelete', { n: errored.length }))) onDeleteRows(errored)
  }

  const canProceed = counts.error === 0 && counts.ready > 0

  return (
    <div className="space-y-6">
      <ImportHeader subtitle={t('csvImport.reviewSubtitle')} />
      <ImportStepper current="review" />

      {/* File summary bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-4 py-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <FileText className="h-[17px] w-[17px] text-primary" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{dataset.filename}</div>
          <div className="text-[13px] text-muted-foreground">
            {t('csvImport.fileMeta', { rows: counts.total, cols: dataset.columns, size: fmtSize(dataset.size) })}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-5">
          <Counter label={t('csvImport.ready')} value={counts.ready} tone="success" />
          <Counter label={t('csvImport.errors')} value={counts.error} tone="destructive" />
          <Button variant="outline" size="sm" onClick={confirmRestart}>
            {t('csvImport.changeFile')}
          </Button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={filter === 'error'} tone="destructive" onClick={() => setFilter('error')}>
          {t('csvImport.chipErrors', { n: counts.error })}
        </Chip>
        <Chip active={filter === 'ready'} onClick={() => setFilter('ready')}>
          {t('csvImport.chipReady', { n: counts.ready })}
        </Chip>
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          {t('csvImport.chipAll', { n: counts.total })}
        </Chip>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[13px] text-muted-foreground">
            {t('csvImport.shownOf', { shown: filtered.length, total: counts.total })}
          </span>
          {counts.error > 0 && (
            <Button variant="outline" size="sm" onClick={bulkDeleteErrored}>
              {t('csvImport.deleteAllErrored')}
            </Button>
          )}
        </div>
      </div>

      <ImportDataTable
        rows={filtered}
        mode="edit"
        numbering="csv"
        onCommitCell={onUpdateCell}
        onDeleteRow={(csvRow) => onDeleteRows([csvRow])}
      />

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={confirmRestart}>
          {t('csvImport.back')}
        </Button>
        {counts.error > 0 && (
          <span className="text-[13px] text-muted-foreground">
            {t('csvImport.errorsRemain', { n: counts.error })}
          </span>
        )}
        {counts.ready === 0 && counts.error === 0 && (
          <span className="text-[13px] text-muted-foreground">{t('csvImport.noRowsLeft')}</span>
        )}
        <Button className="ml-auto" onClick={onNext} disabled={!canProceed}>
          {t('csvImport.nextConfirm')}
        </Button>
      </div>
    </div>
  )
}

function Counter({ label, value, tone }: { label: string; value: number; tone: 'success' | 'destructive' }) {
  return (
    <div className="text-right">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('text-xl font-bold', tone === 'success' ? 'text-success' : 'text-destructive')}>
        {value}
      </div>
    </div>
  )
}

function Chip({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean
  tone?: 'destructive'
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors',
        active && tone === 'destructive' && 'border-destructive bg-destructive text-destructive-foreground',
        active && !tone && 'border-primary bg-primary text-primary-foreground',
        !active && 'border-border text-muted-foreground hover:bg-accent',
      )}
    >
      {children}
    </button>
  )
}
