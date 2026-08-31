'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ImportHeader } from './import-header'

export interface DoneState {
  status: 'running' | 'completed' | 'cancelled' | 'failed'
  imported: number
  failed: number
  deleted_count: number
  filename: string
  started_at: string
  finished_at: string | null
  error_reason: string | null
}

function duration(t: ReturnType<typeof useTranslations>, start: string, end: string | null): string {
  if (!end) return '—'
  const secs = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000))
  return t('csvImport.durationValue', { m: Math.floor(secs / 60), s: secs % 60 })
}

export function DoneCard({
  state,
  jobId,
  userName,
  onRestart,
}: {
  state: DoneState
  jobId: string | null
  userName?: string | undefined
  onRestart: () => void
}) {
  const t = useTranslations()
  const failedVariant = state.status === 'failed'
  const when = state.finished_at ? format(new Date(state.finished_at), 'dd/MM/yyyy HH:mm') : ''

  return (
    <div className="space-y-6">
      <ImportHeader
        subtitle={failedVariant ? t('csvImport.failedSubtitle') : t('csvImport.doneSubtitle')}
        showBack={false}
      />
      <div className="flex justify-center pt-8">
        <div className="flex w-[560px] flex-col gap-5 rounded-lg border border-border bg-card p-8">
          <div className="flex items-center gap-3.5">
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-md ${
                failedVariant ? 'bg-destructive/10' : 'bg-success/10'
              }`}
            >
              {failedVariant ? (
                <XCircle className="h-5 w-5 text-destructive" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-success" />
              )}
            </span>
            <div>
              <div className="text-lg font-semibold text-foreground">
                {failedVariant
                  ? t('csvImport.importFailed')
                  : state.status === 'cancelled'
                    ? t('csvImport.importCancelled')
                    : t('csvImport.importComplete')}
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">
                {when} · {duration(t, state.started_at, state.finished_at)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat label={t('csvImport.imported')} value={state.imported} tone="success" />
            <Stat label={t('csvImport.deletedRows')} value={state.deleted_count} tone="muted" />
          </div>
          {state.failed > 0 && (
            <p className="text-[13px] text-destructive">{t('csvImport.nFailed', { n: state.failed })}</p>
          )}

          <div className="flex flex-col gap-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t('csvImport.file')}</span>
              <span className="truncate text-foreground">{state.filename}</span>
            </div>
            {userName && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{t('csvImport.author')}</span>
                <span className="text-foreground">{userName}</span>
              </div>
            )}
          </div>

          {failedVariant && state.error_reason && (
            <p className="text-[13px] text-muted-foreground">{state.error_reason}</p>
          )}

          <div className="flex flex-col gap-2">
            {!failedVariant && state.imported > 0 && (
              <Button asChild>
                <Link href={jobId ? `/candidates?import=${jobId}` : '/candidates'}>
                  {t('csvImport.viewNCandidates', { n: state.imported })}
                </Link>
              </Button>
            )}
            <Button variant="outline" onClick={onRestart}>
              {t('csvImport.newImport')}
            </Button>
            {failedVariant && (
              <Link href="/support" className="text-center text-[13px] font-medium text-primary hover:underline">
                {t('csvImport.contactSupport')}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'success' | 'muted' }) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-[26px] font-bold ${tone === 'success' ? 'text-success' : 'text-muted-foreground'}`}>
        {value}
      </div>
    </div>
  )
}
