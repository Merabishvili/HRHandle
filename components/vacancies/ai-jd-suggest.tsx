'use client'

import { useState, useTransition } from 'react'
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AiDraftTag } from '@/components/ui/ai-draft-tag'
import type { JdSection } from '@/lib/ai/jd-generator'

export interface AiJdSuggestProps {
  /** Form values read from the parent at click time. */
  getFormSnapshot: () => {
    title: string
    department: string | null
    location: string | null
    employment_type: 'full_time' | 'part_time' | 'contract' | 'internship' | null
    sector_name: string | null
  }
  /** Read existing form text so "Apply all" can warn before overwriting. */
  getExistingFieldText: (section: JdSection) => string
  /** Apply chosen sections to the form. Parent decides how to merge. */
  onApplyAll: (sections: Partial<Record<JdSection, string>>) => void
}

type SectionState =
  | { status: 'empty' }
  | { status: 'loading' }
  | { status: 'ok'; text: string }
  | { status: 'too_thin' }
  | { status: 'rate_limited' }
  | { status: 'no_key' }
  | { status: 'failed' }

const SECTION_LABELS: Record<JdSection, string> = {
  description: 'About the job',
  responsibilities: 'Responsibilities',
  requirements: 'Requirements',
}

const SECTION_ORDER: JdSection[] = ['description', 'responsibilities', 'requirements']

/**
 * AI JD-suggest panel. Each section has its own Generate / Regenerate / Copy
 * action. The form is NEVER modified by individual section clicks. The recruiter
 * may click "Apply all to form" to copy any generated sections into the parent
 * form, with a confirm dialog when non-empty fields would be overwritten.
 */
export function AiJdSuggest({
  getFormSnapshot,
  getExistingFieldText,
  onApplyAll,
}: AiJdSuggestProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [contextText, setContextText] = useState('')
  const [sections, setSections] = useState<Record<JdSection, SectionState>>({
    description: { status: 'empty' },
    responsibilities: { status: 'empty' },
    requirements: { status: 'empty' },
  })
  const [copiedSection, setCopiedSection] = useState<JdSection | null>(null)
  const [isPending, startTransition] = useTransition()
  const [titleMissing, setTitleMissing] = useState(false)

  const generate = (section: JdSection) => {
    const snapshot = getFormSnapshot()
    if (!snapshot.title.trim()) {
      setTitleMissing(true)
      setIsOpen(true)
      return
    }
    setTitleMissing(false)
    setIsOpen(true)
    setSections((prev) => ({ ...prev, [section]: { status: 'loading' } }))

    startTransition(async () => {
      try {
        const res = await fetch('/api/ai/jd-generator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section,
            title: snapshot.title,
            department: snapshot.department,
            location: snapshot.location,
            employment_type: snapshot.employment_type,
            sector_name: snapshot.sector_name,
            additional_context: contextText.trim() || null,
          }),
        })
        const body = await res.json()

        if (body.ok && typeof body.text === 'string') {
          setSections((prev) => ({
            ...prev,
            [section]: { status: 'ok', text: body.text },
          }))
          return
        }

        const reason = body?.reason
        if (reason === 'too_thin') {
          setSections((prev) => ({ ...prev, [section]: { status: 'too_thin' } }))
        } else if (reason === 'rate_limited') {
          setSections((prev) => ({ ...prev, [section]: { status: 'rate_limited' } }))
        } else if (reason === 'no_key') {
          setSections((prev) => ({ ...prev, [section]: { status: 'no_key' } }))
        } else {
          setSections((prev) => ({ ...prev, [section]: { status: 'failed' } }))
        }
      } catch (err) {
        console.error('[ai-jd-suggest] request failed:', err)
        setSections((prev) => ({ ...prev, [section]: { status: 'failed' } }))
      }
    })
  }

  const copySection = async (section: JdSection) => {
    const state = sections[section]
    if (state.status !== 'ok') return
    try {
      await navigator.clipboard.writeText(state.text)
      setCopiedSection(section)
      setTimeout(
        () =>
          setCopiedSection((c) => (c === section ? null : c)),
        1500,
      )
    } catch (err) {
      console.error('[ai-jd-suggest] clipboard write failed:', err)
    }
  }

  const applyAll = () => {
    const payload: Partial<Record<JdSection, string>> = {}
    let overwritesExisting = false
    for (const section of SECTION_ORDER) {
      const state = sections[section]
      if (state.status === 'ok') {
        payload[section] = state.text
        if (getExistingFieldText(section).trim().length > 0) {
          overwritesExisting = true
        }
      }
    }
    if (Object.keys(payload).length === 0) return

    if (
      overwritesExisting &&
      !window.confirm(
        'Replace your current text in one or more sections with the AI-generated content?',
      )
    ) {
      return
    }
    onApplyAll(payload)
  }

  const anyGenerated = SECTION_ORDER.some((s) => sections[s].status === 'ok')

  return (
    <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5">
      {/* Header bar — collapsed by default to keep the form clean */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-foreground"
        aria-expanded={isOpen}
      >
        <Sparkles className="h-4 w-4 text-primary" />
        <span>AI assist — suggest job description sections</span>
        <span className="ml-auto text-[11px] uppercase tracking-wide text-muted-foreground">
          Assistant
        </span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="space-y-4 border-t border-primary/20 px-4 py-4">
          <p className="text-xs text-muted-foreground">
            The AI produces suggestions for each section. Suggestions are advisory —
            they are not added to the form unless you click <strong>Apply all</strong>{' '}
            or copy a section manually.
          </p>

          {titleMissing && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Add a job title above before generating suggestions.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="ai-jd-context" className="text-xs font-medium">
              Optional context for the AI
            </Label>
            <Textarea
              id="ai-jd-context"
              value={contextText}
              onChange={(e) => setContextText(e.target.value)}
              placeholder="e.g. Senior role on the platform team. Must know Kubernetes and PostgreSQL."
              rows={2}
              maxLength={1000}
              className="text-sm"
            />
          </div>

          {SECTION_ORDER.map((section) => {
            const state = sections[section]
            return (
              <div
                key={section}
                className="rounded-md border border-border bg-background p-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {SECTION_LABELS[section]}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    {state.status === 'ok' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => copySection(section)}
                      >
                        {copiedSection === section ? (
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
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => generate(section)}
                      disabled={isPending && state.status === 'loading'}
                    >
                      {state.status === 'loading' ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Generating
                        </>
                      ) : state.status === 'ok' ? (
                        <>
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                          Regenerate
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                          Generate
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {state.status === 'ok' && (
                  <div>
                    <div className="mb-1">
                      <AiDraftTag label="AI draft" />
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {state.text}
                    </p>
                  </div>
                )}

                {state.status === 'too_thin' && (
                  <p className="text-xs text-muted-foreground">
                    Not enough context yet. Try adding a department, location, or a hint
                    in the optional context field above.
                  </p>
                )}

                {state.status === 'rate_limited' && (
                  <p className="text-xs text-muted-foreground">
                    You&apos;ve generated a lot recently. Try again in a few minutes.
                  </p>
                )}

                {state.status === 'no_key' && (
                  <p className="text-xs text-muted-foreground">
                    AI features are not configured on this deployment.
                  </p>
                )}

                {state.status === 'failed' && (
                  <p className="text-xs text-destructive">
                    Could not generate. Try again.
                  </p>
                )}
              </div>
            )
          })}

          {anyGenerated && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={applyAll}
              >
                Apply all to form
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
