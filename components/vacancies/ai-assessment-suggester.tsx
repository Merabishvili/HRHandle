'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Plus,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
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

export function AiAssessmentSuggester({
  vacancyId,
  existingSkillLabels,
  existingPromptLabels,
  canEdit,
}: AiAssessmentSuggesterProps) {
  const router = useRouter()
  const [contextText, setContextText] = useState('')
  const [panel, setPanel] = useState<PanelState>({ status: 'idle' })
  const [copied, setCopied] = useState<string | null>(null)
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

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500)
    } catch (err) {
      console.error('[ai-assessment-suggester] clipboard write failed:', err)
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
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-[15px] font-bold text-foreground">
          AI assessment suggestions
        </span>
        <span className="ml-auto text-[11px] uppercase tracking-wide text-muted-foreground">
          Assistant
        </span>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        Suggestions are advisory — review each one before adding it. Nothing is saved
        to this vacancy unless you click <strong>Add</strong> on a specific item.
        Skills become scored criteria (1–10); prompts become open-ended questions.
      </p>

      {canEdit && (
        <div className="space-y-2">
          <Label htmlFor="as-context" className="text-xs font-medium">
            Optional context for the AI
          </Label>
          <Textarea
            id="as-context"
            value={contextText}
            onChange={(e) => setContextText(e.target.value)}
            placeholder="e.g. Focus on data-modelling depth and stakeholder communication."
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
          variant="outline"
          disabled={panel.status === 'loading' || !canEdit}
        >
          {panel.status === 'loading' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating…
            </>
          ) : panel.status === 'ok' ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate suggestions
            </>
          )}
        </Button>
      </div>

      {panel.status === 'ok' && (
        <div className="mt-4 space-y-4">
          <p className="text-[11px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
            AI-generated — recruiter has not reviewed or edited
          </p>

          <SuggestionSection
            title="Evaluation criteria (scored 1–10)"
            hint="Add to Evaluation Criteria"
            items={panel.suggestions.skills}
            kind="skill"
            canEdit={canEdit}
            isPending={isAdding}
            isAlreadyAdded={isAlreadyAdded}
            onAdd={addItem}
            onCopy={copyText}
            copied={copied}
          />

          <SuggestionSection
            title="Open-ended prompts"
            hint="Add to Questionary"
            items={panel.suggestions.prompts}
            kind="prompt"
            canEdit={canEdit}
            isPending={isAdding}
            isAlreadyAdded={isAlreadyAdded}
            onAdd={addItem}
            onCopy={copyText}
            copied={copied}
          />
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

interface SuggestionSectionProps {
  title: string
  hint: string
  items: string[]
  kind: 'skill' | 'prompt'
  canEdit: boolean
  isPending: boolean
  isAlreadyAdded: (label: string, kind: 'skill' | 'prompt') => boolean
  onAdd: (label: string, kind: 'skill' | 'prompt') => void
  onCopy: (text: string, key: string) => void
  copied: string | null
}

function SuggestionSection({
  title,
  hint,
  items,
  kind,
  canEdit,
  isPending,
  isAlreadyAdded,
  onAdd,
  onCopy,
  copied,
}: SuggestionSectionProps) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No suggestions generated for this section.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((label, idx) => {
            const key = `${kind}-${idx}`
            const added = isAlreadyAdded(label, kind)
            return (
              <li
                key={key}
                className="flex items-start gap-2 text-sm leading-relaxed text-foreground"
              >
                <span className="mt-[2px] text-xs text-muted-foreground">
                  {idx + 1}.
                </span>
                <span className="flex-1">{label}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onCopy(label, key)}
                >
                  {copied === key ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </Button>
                {canEdit && (
                  <Button
                    type="button"
                    size="sm"
                    variant={added ? 'ghost' : 'default'}
                    onClick={() => onAdd(label, kind)}
                    disabled={isPending || added}
                  >
                    {added ? (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        Added
                      </>
                    ) : (
                      <>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Add
                      </>
                    )}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
