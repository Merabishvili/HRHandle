'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
      const noteText = `AI summary (not reviewed by recruiter):\n${state.summary}`
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
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-[15px] font-bold text-foreground">AI summary</span>
        <span className="ml-auto text-[11px] uppercase tracking-wide text-muted-foreground">
          Assistant
        </span>
      </div>

      {state.status === 'idle' && (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">
            Generate a brief, neutral summary of this candidate&apos;s background. The
            summary is informational only — no decision is taken from it, and nothing is
            saved unless you choose to save it as a note.
          </p>
          <Button onClick={generate} size="sm" variant="outline">
            <Sparkles className="mr-2 h-4 w-4" />
            Generate summary
          </Button>
        </div>
      )}

      {state.status === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating…
        </div>
      )}

      {state.status === 'ok' && (
        <div>
          <div className="mb-2">
            <AiDraftTag label="AI draft" />
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
              Saved as a candidate note.
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <Button onClick={generate} size="sm" variant="ghost" disabled={isSaving}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate
            </Button>
            {!saved && (
              <Button onClick={saveAsNote} size="sm" variant="outline" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save as note
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
            Not enough information yet — add experience, education, or a current role,
            then try again.
          </AlertDescription>
        </Alert>
      )}

      {state.status === 'rate_limited' && (
        <Alert>
          <AlertDescription>
            You&apos;ve generated a lot of summaries recently. Try again in a few minutes.
          </AlertDescription>
        </Alert>
      )}

      {state.status === 'no_key' && (
        <Alert>
          <AlertDescription>
            AI features are not configured on this deployment.
          </AlertDescription>
        </Alert>
      )}

      {state.status === 'failed' && (
        <div>
          <Alert variant="destructive">
            <AlertDescription>
              Could not generate the summary right now. You can try again.
            </AlertDescription>
          </Alert>
          <Button onClick={generate} size="sm" variant="outline" className="mt-3">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      )}
    </div>
  )
}
