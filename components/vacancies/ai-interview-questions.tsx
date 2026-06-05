'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Save,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { setInterviewQuestions } from '@/lib/actions/interview-questions'
import {
  INTERVIEW_QUESTION_CATEGORIES,
  type InterviewQuestionCategory,
  type InterviewQuestionsSet,
} from '@/lib/ai/interview-questions'

export interface AiInterviewQuestionsProps {
  vacancyId: string
  savedQuestions: InterviewQuestionsSet | null
}

type PanelState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; questions: InterviewQuestionsSet }
  | { status: 'too_thin' }
  | { status: 'rate_limited' }
  | { status: 'no_key' }
  | { status: 'malformed' }
  | { status: 'failed' }

const CATEGORY_LABELS: Record<InterviewQuestionCategory, string> = {
  behavioural: 'Behavioural',
  technical: 'Technical',
  situational: 'Situational',
  closing: 'Closing',
}

const CATEGORY_HINTS: Record<InterviewQuestionCategory, string> = {
  behavioural: 'Past behaviour — "Tell me about a time when…"',
  technical: 'Role-specific skills, knowledge, and trade-offs',
  situational: 'Hypothetical scenarios — "How would you handle…"',
  closing: "Candidate's questions and motivation",
}

const EMPTY_SET: InterviewQuestionsSet = {
  behavioural: [],
  technical: [],
  situational: [],
  closing: [],
}

function isEmpty(set: InterviewQuestionsSet | null): boolean {
  if (!set) return true
  return INTERVIEW_QUESTION_CATEGORIES.every((c) => set[c].length === 0)
}

export function AiInterviewQuestions({
  vacancyId,
  savedQuestions,
}: AiInterviewQuestionsProps) {
  const router = useRouter()
  const [contextText, setContextText] = useState('')
  const [panel, setPanel] = useState<PanelState>({ status: 'idle' })
  const [copied, setCopied] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, startSaveTransition] = useTransition()

  // Local mirror of the saved set so per-question Delete can update the UI
  // immediately without waiting for revalidatePath.
  const [savedLocal, setSavedLocal] = useState<InterviewQuestionsSet | null>(
    savedQuestions,
  )

  const generate = async () => {
    setPanel({ status: 'loading' })
    try {
      const res = await fetch('/api/ai/interview-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vacancyId,
          additional_context: contextText.trim() || null,
        }),
      })
      const body = await res.json()
      if (body.ok && body.questions) {
        setPanel({ status: 'ok', questions: body.questions })
        return
      }
      const reason = body?.reason
      if (reason === 'too_thin') return setPanel({ status: 'too_thin' })
      if (reason === 'rate_limited') return setPanel({ status: 'rate_limited' })
      if (reason === 'no_key') return setPanel({ status: 'no_key' })
      if (reason === 'malformed') return setPanel({ status: 'malformed' })
      setPanel({ status: 'failed' })
    } catch (err) {
      console.error('[ai-interview-questions] request failed:', err)
      setPanel({ status: 'failed' })
    }
  }

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500)
    } catch (err) {
      console.error('[ai-interview-questions] clipboard write failed:', err)
    }
  }

  const persist = (next: InterviewQuestionsSet | null) => {
    setSaveError(null)
    startSaveTransition(async () => {
      const result = await setInterviewQuestions(vacancyId, next)
      if (!result.success) {
        setSaveError(result.error)
        return
      }
      setSavedLocal(next)
      router.refresh()
    })
  }

  const saveSuggestions = () => {
    if (panel.status !== 'ok') return
    const next = panel.questions
    if (
      !isEmpty(savedLocal) &&
      !window.confirm(
        'Replace your saved questions for this vacancy with the AI suggestions?',
      )
    ) {
      return
    }
    persist(next)
  }

  const deleteSaved = (category: InterviewQuestionCategory, index: number) => {
    const base = savedLocal ?? EMPTY_SET
    const next: InterviewQuestionsSet = {
      ...EMPTY_SET,
      ...base,
      [category]: base[category].filter((_, i) => i !== index),
    }
    persist(isEmpty(next) ? null : next)
  }

  const clearSaved = () => {
    if (!window.confirm('Remove all saved interview questions for this vacancy?')) {
      return
    }
    persist(null)
  }

  const hasSaved = !isEmpty(savedLocal)

  return (
    <div className="space-y-6">
      {/* ──────────── Saved questions ──────────── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[15px] font-bold text-foreground">Saved questions</span>
          {hasSaved && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={clearSaved}
              disabled={isSaving}
              className="ml-auto text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Clear all
            </Button>
          )}
        </div>

        {hasSaved ? (
          <div className="space-y-4">
            {INTERVIEW_QUESTION_CATEGORIES.map((category) => {
              const list = savedLocal![category]
              if (list.length === 0) return null
              return (
                <div key={category}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABELS[category]}
                  </p>
                  <ul className="space-y-2">
                    {list.map((question, idx) => {
                      const key = `saved-${category}-${idx}`
                      return (
                        <li
                          key={key}
                          className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm"
                        >
                          <span className="flex-1 text-foreground">{question}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => copyText(question, key)}
                            disabled={isSaving}
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
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteSaved(category, idx)}
                            disabled={isSaving}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Delete ${CATEGORY_LABELS[category]} question ${idx + 1}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No interview questions saved for this vacancy yet. Generate suggestions below
            and save the ones you want to use.
          </p>
        )}

        {saveError && (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* ──────────── AI suggestions panel ──────────── */}
      <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-[15px] font-bold text-foreground">AI suggestions</span>
          <span className="ml-auto text-[11px] uppercase tracking-wide text-muted-foreground">
            Assistant
          </span>
        </div>

        <p className="mb-3 text-xs text-muted-foreground">
          Suggestions are advisory — review every question before using it. Nothing is
          added to the vacancy unless you click <strong>Save to vacancy</strong>.
        </p>

        <div className="space-y-2">
          <Label htmlFor="iq-context" className="text-xs font-medium">
            Optional context for the AI
          </Label>
          <Textarea
            id="iq-context"
            value={contextText}
            onChange={(e) => setContextText(e.target.value)}
            placeholder="e.g. Focus on system-design depth and incident response."
            rows={2}
            maxLength={1000}
            className="text-sm"
            disabled={panel.status === 'loading'}
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button
            type="button"
            onClick={generate}
            size="sm"
            variant="outline"
            disabled={panel.status === 'loading'}
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
                Generate questions
              </>
            )}
          </Button>

          {panel.status === 'ok' && (
            <Button
              type="button"
              onClick={saveSuggestions}
              size="sm"
              variant="default"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save to vacancy
                </>
              )}
            </Button>
          )}
        </div>

        {panel.status === 'ok' && (
          <div className="mt-4 space-y-4">
            <p className="text-[11px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
              AI-generated — recruiter has not reviewed or edited
            </p>

            {INTERVIEW_QUESTION_CATEGORIES.map((category) => {
              const list = panel.questions[category]
              return (
                <div key={category} className="rounded-md border border-border bg-background p-3">
                  <div className="mb-2 flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {CATEGORY_LABELS[category]}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {CATEGORY_HINTS[category]}
                    </span>
                    {list.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="ml-auto"
                        onClick={() =>
                          copyText(list.map((q, i) => `${i + 1}. ${q}`).join('\n'), `cat-${category}`)
                        }
                      >
                        {copied === `cat-${category}` ? (
                          <>
                            <Check className="mr-1.5 h-3.5 w-3.5" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                            Copy all
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {list.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No questions generated for this category.
                    </p>
                  ) : (
                    <ol className="space-y-2">
                      {list.map((question, idx) => {
                        const key = `sug-${category}-${idx}`
                        return (
                          <li
                            key={key}
                            className="flex items-start gap-2 text-sm leading-relaxed text-foreground"
                          >
                            <span className="mt-[2px] text-xs text-muted-foreground">
                              {idx + 1}.
                            </span>
                            <span className="flex-1">{question}</span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => copyText(question, key)}
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
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </div>
              )
            })}
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

        {panel.status === 'failed' && (
          <Alert className="mt-3" variant="destructive">
            <AlertDescription>Could not generate. Try again.</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}
