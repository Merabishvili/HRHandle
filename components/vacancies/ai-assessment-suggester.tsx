'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles,
  Loader2,
  Check,
  RefreshCw,
  Plus,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { addVacancyQuestion } from '@/lib/actions/evaluations'
import type { AssessmentSuggestions } from '@/lib/ai/assessment-suggester'

export interface AiAssessmentSuggesterProps {
  vacancyId: string
  /** Existing question labels by type — used to mark suggestions already added so
   * a recruiter who clicks "Generate" twice doesn't accidentally duplicate. */
  existingSkillLabels: string[]
  existingPromptLabels: string[]
  canEdit: boolean
}

type PanelState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; suggestions: AssessmentSuggestions }
  | { status: 'too_thin' }
  | { status: 'rate_limited' }
  | { status: 'no_key' }
  | { status: 'malformed' }
  | { status: 'not_found' }
  | { status: 'failed' }

/** A single suggestion row: the text plus which list it becomes when added.
 * Skills → the Scorecard (scored 1–5); prompts → the Interview guide. */
type SuggestionRow = { label: string; kind: 'skill' | 'prompt' }

export function AiAssessmentSuggester({
  vacancyId,
  existingSkillLabels,
  existingPromptLabels,
  canEdit,
}: AiAssessmentSuggesterProps) {
  const router = useRouter()
  const [contextText, setContextText] = useState('')
  const [panel, setPanel] = useState<PanelState>({ status: 'idle' })
  const [addError, setAddError] = useState<string | null>(null)
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set())
  const [isAdding, startAddTransition] = useTransition()

  // Case-insensitive lookup of items already on the vacancy. Combined with
  // addedKeys (this session's additions) so re-generations don't show "Add"
  // for things the recruiter just persisted.
  const existingSkillSet = useMemo(
    () => new Set(existingSkillLabels.map((l) => l.trim().toLowerCase())),
    [existingSkillLabels],
  )
  const existingPromptSet = useMemo(
    () => new Set(existingPromptLabels.map((l) => l.trim().toLowerCase())),
    [existingPromptLabels],
  )

  const isAlreadyAdded = (label: string, kind: 'skill' | 'prompt'): boolean => {
    const lower = label.trim().toLowerCase()
    if (kind === 'skill' && existingSkillSet.has(lower)) return true
    if (kind === 'prompt' && existingPromptSet.has(lower)) return true
    return addedKeys.has(`${kind}::${lower}`)
  }

  // Flatten both suggestion buckets into one list of rows, each carrying its
  // destination. Skills first, then prompts — mirrors the Scorecard /
  // Interview guide card order below the panel.
  const rows: SuggestionRow[] =
    panel.status === 'ok'
      ? [
          ...panel.suggestions.skills.map<SuggestionRow>((label) => ({ label, kind: 'skill' })),
          ...panel.suggestions.prompts.map<SuggestionRow>((label) => ({ label, kind: 'prompt' })),
        ]
      : []

  const generate = async () => {
    setPanel({ status: 'loading' })
    setAddError(null)
    try {
      const res = await fetch('/api/ai/assessment-suggester', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vacancyId,
          additional_context: contextText.trim() || null,
        }),
      })
      const body = await res.json()
      if (body.ok && body.suggestions) {
        setPanel({ status: 'ok', suggestions: body.suggestions })
        return
      }
      const reason = body?.reason
      if (reason === 'too_thin') return setPanel({ status: 'too_thin' })
      if (reason === 'rate_limited') return setPanel({ status: 'rate_limited' })
      if (reason === 'no_key') return setPanel({ status: 'no_key' })
      if (reason === 'malformed') return setPanel({ status: 'malformed' })
      if (reason === 'not_found') return setPanel({ status: 'not_found' })
      setPanel({ status: 'failed' })
    } catch (err) {
      console.error('[ai-assessment-suggester] request failed:', err)
      setPanel({ status: 'failed' })
    }
  }

  const addItem = (label: string, kind: 'skill' | 'prompt') => {
    setAddError(null)
    const type: 'text' | 'score' = kind === 'skill' ? 'score' : 'text'
    startAddTransition(async () => {
      const result = await addVacancyQuestion(vacancyId, label, type)
      if (!result.success) {
        setAddError(result.error)
        return
      }
      setAddedKeys((prev) => {
        const next = new Set(prev)
        next.add(`${kind}::${label.trim().toLowerCase()}`)
        return next
      })
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-5">
      <div className="mb-1 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-[15px] font-bold text-foreground">Suggest with AI</span>
        <span className="ml-auto text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          Advisory
        </span>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        One click drafts <strong>both</strong> scored attributes and open-ended prompts at
        once. Review each — nothing is added until you click <strong>Add</strong> on that
        specific item.
      </p>

      {canEdit && (
        <div className="space-y-2">
          <Label htmlFor="as-context" className="text-xs font-medium">
            Optional: tell it what to focus on
          </Label>
          <Textarea
            id="as-context"
            value={contextText}
            onChange={(e) => setContextText(e.target.value)}
            placeholder="e.g. system-design depth and stakeholder communication."
            rows={2}
            maxLength={1000}
            className="text-sm"
            disabled={panel.status === 'loading'}
          />
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button
          type="button"
          onClick={generate}
          size="sm"
          disabled={panel.status === 'loading' || !canEdit}
        >
          {panel.status === 'loading' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate
            </>
          )}
        </Button>
      </div>

      {panel.status === 'ok' && (
        <div className="mt-4 space-y-2">
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No suggestions were generated. Add more detail to the vacancy and try again.
            </p>
          ) : (
            rows.map((row, idx) => (
              <SuggestionRowItem
                key={`${row.kind}-${idx}`}
                row={row}
                added={isAlreadyAdded(row.label, row.kind)}
                canEdit={canEdit}
                isPending={isAdding}
                onAdd={addItem}
              />
            ))
          )}

          {canEdit && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={generate}
                disabled={panel.status !== 'ok'}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </button>
            </div>
          )}
        </div>
      )}

      {panel.status === 'too_thin' && (
        <Alert className="mt-3">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Not enough context yet. Add a description, responsibilities, or requirements
            to the vacancy and try again.
          </AlertDescription>
        </Alert>
      )}

      {panel.status === 'rate_limited' && (
        <Alert className="mt-3">
          <AlertDescription>
            You&apos;ve generated a lot recently. Try again in a few minutes.
          </AlertDescription>
        </Alert>
      )}

      {panel.status === 'no_key' && (
        <Alert className="mt-3">
          <AlertDescription>
            AI features are not configured on this deployment.
          </AlertDescription>
        </Alert>
      )}

      {panel.status === 'malformed' && (
        <Alert className="mt-3" variant="destructive">
          <AlertDescription>
            The AI returned an unexpected response. Try again.
          </AlertDescription>
        </Alert>
      )}

      {panel.status === 'not_found' && (
        <Alert className="mt-3" variant="destructive">
          <AlertDescription>Vacancy not found.</AlertDescription>
        </Alert>
      )}

      {panel.status === 'failed' && (
        <Alert className="mt-3" variant="destructive">
          <AlertDescription>Could not generate. Try again.</AlertDescription>
        </Alert>
      )}

      {addError && (
        <Alert className="mt-3" variant="destructive">
          <AlertDescription>{addError}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

interface SuggestionRowItemProps {
  row: SuggestionRow
  added: boolean
  canEdit: boolean
  isPending: boolean
  onAdd: (label: string, kind: 'skill' | 'prompt') => void
}

function SuggestionRowItem({ row, added, canEdit, isPending, onAdd }: SuggestionRowItemProps) {
  const isSkill = row.kind === 'skill'
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
      <span
        className={cn(
          'shrink-0 rounded px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide',
          isSkill
            ? 'bg-[oklch(0.94_0.01_250)] text-[oklch(0.4_0.02_250)]'
            : 'bg-[oklch(0.93_0.06_300)] text-[oklch(0.45_0.15_300)]',
        )}
      >
        {isSkill ? '→ Scorecard' : '→ Interview guide'}
      </span>
      <span className="flex-1 leading-relaxed text-foreground">{row.label}</span>
      {canEdit && (
        <button
          type="button"
          onClick={() => onAdd(row.label, row.kind)}
          disabled={isPending || added}
          className={cn(
            'inline-flex shrink-0 items-center gap-1 text-xs font-bold disabled:opacity-60',
            added ? 'text-muted-foreground' : 'text-[oklch(0.42_0.16_250)] hover:opacity-80',
          )}
        >
          {added ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Added
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              Add
            </>
          )}
        </button>
      )}
    </div>
  )
}
