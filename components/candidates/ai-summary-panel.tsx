'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Sparkles, Loader2, RefreshCw, Save, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AiDraftTag } from '@/components/ui/ai-draft-tag'
import { createNote } from '@/lib/actions/notes'

export interface AiSummaryPanelProps {
  candidateId: string
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; summary: string }
  | { status: 'too_thin' }
  | { status: 'rate_limited' }
  | { status: 'no_key' }
  | { status: 'failed' }

/**
 * AI candidate summary panel. Explicit, button-triggered, advisory only —
 * never auto-runs, never writes to the candidate record. If the recruiter
 * wants to keep the summary, "Save as note" persists it via the normal
 * candidate-note flow (clearly prefixed so it's traceable as AI output).
 */
export function AiSummaryPanel({ candidateId }: AiSummaryPanelProps) {
  const t = useTranslations()
  const [state, setState] = useState<State>({ status: 'idle' })
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, startSaveTransition] = useTransition()
  const router = useRouter()

  const generate = async () => {
    setSaved(false)
    setSaveError(null)
    setState({ status: 'loading' })
    try {
      const res = await fetch('/api/ai/candidate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId }),
      })
      const body = await res.json()
      if (body.ok && typeof body.summary === 'string') {
        setState({ status: 'ok', summary: body.summary })
        return
      }
      const reason = body?.reason
      if (reason === 'too_thin') return setState({ status: 'too_thin' })
      if (reason === 'rate_limited') return setState({ status: 'rate_limited' })
      if (reason === 'no_key') return setState({ status: 'no_key' })
      setState({ status: 'failed' })
    } catch (err) {
      console.error('[ai-summary-panel] request failed:', err)
      setState({ status: 'failed' })
    }
  }

  const saveAsNote = () => {
    if (state.status !== 'ok' || isSaving) return
    setSaveError(null)
    startSaveTransition(async () => {
      const noteText = `${t('aiSummary.savedHeader')}\n${state.summary}`
      const result = await createNote(candidateId, noteText)
      if (!result.success) {
        setSaveError(result.error)
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-[15px] font-bold text-foreground">{t('aiSummary.title')}</span>
        <span className="ml-auto text-[11px] uppercase tracking-wide text-muted-foreground">
          {t('aiJd.assistant')}
        </span>
      </div>

      {state.status === 'idle' && (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">
            {t('aiSummary.intro')}
          </p>
          <Button onClick={generate} size="sm" variant="outline">
            <Sparkles className="mr-2 h-4 w-4" />
            {t('aiSummary.generate')}
          </Button>
        </div>
      )}

      {state.status === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('aiAssess.generating')}
        </div>
      )}

      {state.status === 'ok' && (
        <div>
          <div className="mb-2">
            <AiDraftTag label={t('aiJd.aiDraft')} />
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {state.summary}
          </p>

          {saveError && (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          {saved && (
            <p className="mt-3 text-sm text-green-700 dark:text-green-500">
              {t('aiNotes.savedNote')}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={generate} size="sm" variant="ghost" disabled={isSaving}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('aiJd.regenerate')}
            </Button>
            {!saved && (
              <Button onClick={saveAsNote} size="sm" variant="outline" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.saving')}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {t('aiNotes.saveAsNote')}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {state.status === 'too_thin' && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {t('aiSummary.tooThin')}
          </AlertDescription>
        </Alert>
      )}

      {state.status === 'rate_limited' && (
        <Alert>
          <AlertDescription>
            {t('aiSummary.rateLimited')}
          </AlertDescription>
        </Alert>
      )}

      {state.status === 'no_key' && (
        <Alert>
          <AlertDescription>
            {t('wizard.aiNotConfigured')}
          </AlertDescription>
        </Alert>
      )}

      {state.status === 'failed' && (
        <div>
          <Alert variant="destructive">
            <AlertDescription>
              {t('aiSummary.failed')}
            </AlertDescription>
          </Alert>
          <Button onClick={generate} size="sm" variant="outline" className="mt-3">
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('aiSummary.tryAgain')}
          </Button>
        </div>
      )}
    </div>
  )
}
