'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getImportProgress, cancelImport } from '@/lib/actions/candidate-import'
import { ImportHeader } from './import-header'
import type { DoneState } from './done-card'

export function RunningCard({
  jobId,
  onFinished,
}: {
  jobId: string
  onFinished: (state: DoneState) => void
}) {
  const t = useTranslations()
  const [imported, setImported] = useState(0)
  const [failed, setFailed] = useState(0)
  const [total, setTotal] = useState(0)
  const [filename, setFilename] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const finishedRef = useRef(false)
  const onFinishedRef = useRef(onFinished)
  onFinishedRef.current = onFinished

  useEffect(() => {
    let active = true
    const tick = async () => {
      const res = await getImportProgress(jobId)
      if (!active || finishedRef.current) return
      if (!res.success) return
      const p = res.data
      setImported(p.imported)
      setFailed(p.failed)
      setTotal(p.total)
      setFilename(p.filename)
      if (p.status !== 'running') {
        finishedRef.current = true
        onFinishedRef.current({
          status: p.status,
          imported: p.imported,
          failed: p.failed,
          deleted_count: p.deleted_count,
          filename: p.filename,
          started_at: p.started_at,
          finished_at: p.finished_at,
          error_reason: p.error_reason,
        })
      }
    }
    void tick()
    const id = setInterval(tick, 1200)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [jobId])

  const done = imported + failed
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const onCancel = async () => {
    if (!window.confirm(t('csvImport.confirmCancel', { n: imported }))) return
    setCancelling(true)
    await cancelImport(jobId)
  }

  return (
    <div className="space-y-6">
      <ImportHeader subtitle={t('csvImport.runningSubtitle')} showBack={false} />
      <div className="flex justify-center pt-10">
        <div className="flex w-[520px] flex-col gap-5 rounded-lg border border-border bg-card p-8">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </span>
            <div>
              <div className="text-lg font-semibold text-foreground">{t('csvImport.importing')}</div>
              <div className="mt-0.5 text-sm text-muted-foreground">
                {t('csvImport.progressCount', { done, total })}
              </div>
            </div>
            <span className="ml-auto text-2xl font-bold text-foreground">{pct}%</span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t('csvImport.file')}</span>
              <span className="truncate text-foreground">{filename}</span>
            </div>
          </div>

          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {t('csvImport.runningHint')}
          </p>

          <Button variant="outline" onClick={onCancel} disabled={cancelling} className="gap-2 text-destructive">
            <XCircle className="h-4 w-4" />
            {t('csvImport.cancel')}
          </Button>
        </div>
      </div>
    </div>
  )
}
