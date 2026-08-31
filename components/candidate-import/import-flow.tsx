'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  validateDataset,
  type DraftRow,
  type ValidatedRow,
} from '@/lib/candidate-import/validation'
import type { ImportField } from '@/lib/candidate-import/parsing'
import { getImportDraft, saveImportDraft } from '@/lib/actions/candidate-import'
import { UploadStep } from './upload-step'
import { ReviewStep } from './review-step'
import { ConfirmStep } from './confirm-step'
import { RunningCard } from './running-card'
import { DoneCard, type DoneState } from './done-card'

export interface Dataset {
  importId: string
  filename: string
  columns: number
  size: number
  rows: ValidatedRow[]
  existingEmails: Set<string>
}

type View = 'upload' | 'review' | 'confirm' | 'running' | 'done'

/** Errored rows first, then ready rows, each in ascending CSV-row order. */
function computeOrder(rows: ValidatedRow[]): number[] {
  const errored = rows.filter((r) => r.status === 'error').map((r) => r.csvRow).sort((a, b) => a - b)
  const ready = rows.filter((r) => r.status === 'ready').map((r) => r.csvRow).sort((a, b) => a - b)
  return [...errored, ...ready]
}

export function ImportFlow({ userName }: { userName?: string | undefined }) {
  const t = useTranslations()
  const router = useRouter()
  const params = useSearchParams()

  const [view, setView] = useState<View>('upload')
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [order, setOrder] = useState<number[]>([])
  const [jobId, setJobId] = useState<string | null>(null)
  const [done, setDone] = useState<DoneState | null>(null)
  const [recovering, setRecovering] = useState(false)

  const rowById = useMemo(() => {
    const m = new Map<number, ValidatedRow>()
    for (const r of dataset?.rows ?? []) m.set(r.csvRow, r)
    return m
  }, [dataset])

  const orderedRows = useMemo(
    () => order.map((cr) => rowById.get(cr)).filter((r): r is ValidatedRow => !!r),
    [order, rowById],
  )

  // --- URL / refresh recovery -----------------------------------------
  const recoveredFor = useRef<string | null>(null)
  useEffect(() => {
    const urlJob = params.get('jobId')
    const urlImport = params.get('importId')
    if (urlJob && !jobId) {
      setJobId(urlJob)
      setView('running')
      return
    }
    if (urlImport && !dataset && recoveredFor.current !== urlImport) {
      recoveredFor.current = urlImport
      setRecovering(true)
      getImportDraft(urlImport).then((res) => {
        setRecovering(false)
        if (res.success) {
          const ds: Dataset = {
            importId: urlImport,
            filename: res.data.filename,
            columns: res.data.columns,
            size: res.data.size,
            rows: res.data.rows,
            existingEmails: new Set(res.data.existingEmails),
          }
          setDataset(ds)
          setOrder(computeOrder(ds.rows))
          setView('review')
        } else {
          toast.error(t('csvImport.draftExpired'))
          router.replace('/candidates/import')
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  // --- debounced autosave of edits/deletes ----------------------------
  const skipSave = useRef(true)
  useEffect(() => {
    if (!dataset) return
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    const id = dataset.importId
    const draft: DraftRow[] = dataset.rows.map((r) => ({ csvRow: r.csvRow, values: r.values }))
    const timer = setTimeout(() => {
      void saveImportDraft(id, draft)
    }, 1500)
    return () => clearTimeout(timer)
  }, [dataset])

  const revalidate = useCallback((rows: ValidatedRow[], existing: Set<string>): ValidatedRow[] => {
    const draft: DraftRow[] = rows.map((r) => ({ csvRow: r.csvRow, values: r.values }))
    return validateDataset(draft, existing)
  }, [])

  // --- handlers -------------------------------------------------------
  const onParsed = useCallback(
    (ds: Dataset) => {
      skipSave.current = true // parse already persisted the draft
      setDataset(ds)
      setOrder(computeOrder(ds.rows))
      setView('review')
      router.replace(`/candidates/import?step=review&importId=${ds.importId}`)
    },
    [router],
  )

  const updateCell = useCallback(
    (csvRow: number, field: ImportField, value: string) => {
      setDataset((ds) => {
        if (!ds) return ds
        const nextRows = ds.rows.map((r) =>
          r.csvRow === csvRow
            ? { ...r, values: { ...r.values, [field]: value.trim() || null } }
            : r,
        )
        return { ...ds, rows: revalidate(nextRows, ds.existingEmails) }
      })
    },
    [revalidate],
  )

  const deleteRows = useCallback(
    (csvRows: number[]) => {
      if (!dataset) return
      const removing = new Set(csvRows)
      const prev = { rows: dataset.rows, order }
      const nextRows = revalidate(
        dataset.rows.filter((r) => !removing.has(r.csvRow)),
        dataset.existingEmails,
      )
      setDataset({ ...dataset, rows: nextRows })
      setOrder(order.filter((cr) => !removing.has(cr)))
      toast(t('csvImport.rowDeleted', { n: csvRows.length }), {
        duration: 8000,
        action: {
          label: t('csvImport.undo'),
          onClick: () => {
            setDataset((ds) => (ds ? { ...ds, rows: prev.rows } : ds))
            setOrder(prev.order)
          },
        },
      })
    },
    [dataset, order, revalidate, t],
  )

  const counts = useMemo(() => {
    let ready = 0
    let error = 0
    for (const r of dataset?.rows ?? []) r.status === 'ready' ? ready++ : error++
    return { total: (dataset?.rows.length ?? 0), ready, error }
  }, [dataset])

  const restart = useCallback(() => {
    setDataset(null)
    setOrder([])
    setJobId(null)
    setDone(null)
    setView('upload')
    router.replace('/candidates/import')
  }, [router])

  if (recovering) {
    return <p className="py-16 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  if (view === 'upload') {
    return <UploadStep onParsed={onParsed} />
  }
  if (view === 'review' && dataset) {
    return (
      <ReviewStep
        dataset={dataset}
        orderedRows={orderedRows}
        counts={counts}
        onUpdateCell={updateCell}
        onDeleteRows={deleteRows}
        onRestart={restart}
        onNext={() => {
          setView('confirm')
          router.replace(`/candidates/import?step=confirm&importId=${dataset.importId}`)
        }}
      />
    )
  }
  if (view === 'confirm' && dataset) {
    return (
      <ConfirmStep
        dataset={dataset}
        readyRows={dataset.rows.filter((r) => r.status === 'ready')}
        importedCount={counts.ready}
        onBack={() => {
          setView('review')
          router.replace(`/candidates/import?step=review&importId=${dataset.importId}`)
        }}
        onStarted={(id) => {
          setJobId(id)
          setView('running')
          router.replace(`/candidates/import?jobId=${id}`)
        }}
      />
    )
  }
  if (view === 'running' && jobId) {
    return (
      <RunningCard
        jobId={jobId}
        onFinished={(state) => {
          setDone(state)
          setView('done')
        }}
      />
    )
  }
  if (view === 'done' && done) {
    return <DoneCard state={done} jobId={jobId} userName={userName} onRestart={restart} />
  }
  return null
}
