'use client'

import { useState } from 'react'
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { BiasCategory, BiasField, BiasFinding } from '@/lib/ai/bias-check'

export interface AiBiasCheckProps {
  /** Form values read from the parent at click time. */
  getFormSnapshot: () => {
    description: string
    responsibilities: string
    requirements: string
  }
}

type PanelState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; findings: BiasFinding[] }
  | { status: 'too_thin' }
  | { status: 'rate_limited' }
  | { status: 'no_key' }
  | { status: 'malformed' }
  | { status: 'failed' }

const FIELD_LABELS: Record<BiasField, string> = {
  description: 'Description',
  responsibilities: 'Responsibilities',
  requirements: 'Requirements',
}

const CATEGORY_LABELS: Record<BiasCategory, string> = {
  gender_coded: 'gender-coded',
  age_coded: 'age-coded',
  culture_coded: 'culture-coded',
  pronoun_bias: 'pronoun bias',
  discriminatory: 'potentially discriminatory',
  cultural_fit_code: 'vague cultural fit',
  other: 'other concern',
}

const FIELD_ORDER: BiasField[] = ['description', 'responsibilities', 'requirements']

export function AiBiasCheck({ getFormSnapshot }: AiBiasCheckProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [panel, setPanel] = useState<PanelState>({ status: 'idle' })
  const [copied, setCopied] = useState<string | null>(null)

  const run = async () => {
    const snap = getFormSnapshot()
    setIsOpen(true)
    setPanel({ status: 'loading' })
    try {
      const res = await fetch('/api/ai/bias-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: snap.description || null,
          responsibilities: snap.responsibilities || null,
          requirements: snap.requirements || null,
        }),
      })
      const body = await res.json()
      if (body.ok && Array.isArray(body.findings)) {
        setPanel({ status: 'ok', findings: body.findings })
        return
      }
      const reason = body?.reason
      if (reason === 'too_thin') return setPanel({ status: 'too_thin' })
      if (reason === 'rate_limited') return setPanel({ status: 'rate_limited' })
      if (reason === 'no_key') return setPanel({ status: 'no_key' })
      if (reason === 'malformed') return setPanel({ status: 'malformed' })
      setPanel({ status: 'failed' })
    } catch (err) {
      console.error('[ai-bias-check] request failed:', err)
      setPanel({ status: 'failed' })
    }
  }

  const copySuggestion = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500)
    } catch (err) {
      console.error('[ai-bias-check] clipboard write failed:', err)
    }
  }

  // Group findings by field for rendering.
  const byField: Record<BiasField, BiasFinding[]> = {
    description: [],
    responsibilities: [],
    requirements: [],
  }
  if (panel.status === 'ok') {
    for (const f of panel.findings) byField[f.field].push(f)
  }

  const totalFindings = panel.status === 'ok' ? panel.findings.length : 0

  return (
    <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-foreground"
        aria-expanded={isOpen}
      >
        <Sparkles className="h-4 w-4 text-primary" />
        <span>AI assist — check inclusive language</span>
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
            Scans the description, responsibilities, and requirements for phrases that
            may deter underrepresented candidates. Advisory only — nothing in your form
            is changed.
          </p>

          <Button
            type="button"
            onClick={run}
            size="sm"
            variant="outline"
            disabled={panel.status === 'loading'}
          >
            {panel.status === 'loading' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking…
              </>
            ) : panel.status === 'ok' ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Re-check
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Run check
              </>
            )}
          </Button>

          {/* ── Results ─────────────────────────────────────────────────────── */}
          {panel.status === 'ok' && totalFindings === 0 && (
            <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-green-800 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-sm">
                No inclusive-language issues found across all three fields.
              </p>
            </div>
          )}

          {panel.status === 'ok' && totalFindings > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
                AI-flagged — recruiter has not reviewed
              </p>

              {FIELD_ORDER.map((field) => {
                const items = byField[field]
                if (items.length === 0) return null
                return (
                  <div
                    key={field}
                    className="rounded-md border border-border bg-background p-3"
                  >
                    <p className="mb-2 text-xs font-semibold text-foreground">
                      {FIELD_LABELS[field]}{' '}
                      <span className="font-normal text-muted-foreground">
                        ({items.length} {items.length === 1 ? 'finding' : 'findings'})
                      </span>
                    </p>
                    <ul className="space-y-3">
                      {items.map((finding, idx) => {
                        const key = `${field}-${idx}`
                        return (
                          <li
                            key={key}
                            className="border-l-2 border-amber-300 pl-3 text-sm dark:border-amber-700"
                          >
                            <div className="flex flex-wrap items-baseline gap-2">
                              <span className="font-medium text-foreground">
                                &ldquo;{finding.phrase}&rdquo;
                              </span>
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                {CATEGORY_LABELS[finding.category]}
                              </span>
                            </div>
                            <p className="mt-1 text-[13px] text-muted-foreground">
                              {finding.reason}
                            </p>
                            <div className="mt-1 flex items-start gap-2">
                              <span className="text-[13px] text-foreground">
                                <span className="text-muted-foreground">→</span>{' '}
                                &ldquo;{finding.suggestion}&rdquo;
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => copySuggestion(finding.suggestion, key)}
                                className="h-6 px-2 text-[11px]"
                              >
                                {copied === key ? (
                                  <>
                                    <Check className="mr-1 h-3 w-3" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="mr-1 h-3 w-3" />
                                    Copy
                                  </>
                                )}
                              </Button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}

              {/* "no issues" hint per field that came back clean */}
              {FIELD_ORDER.filter((f) => byField[f].length === 0).length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  No issues found in:{' '}
                  {FIELD_ORDER.filter((f) => byField[f].length === 0)
                    .map((f) => FIELD_LABELS[f])
                    .join(', ')}
                  .
                </p>
              )}
            </div>
          )}

          {/* ── Failure states ──────────────────────────────────────────────── */}
          {panel.status === 'too_thin' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Add some text to the description, responsibilities, or requirements first,
                then run the check.
              </AlertDescription>
            </Alert>
          )}

          {panel.status === 'rate_limited' && (
            <Alert>
              <AlertDescription>
                You&apos;ve run a lot of checks recently. Try again in a few minutes.
              </AlertDescription>
            </Alert>
          )}

          {panel.status === 'no_key' && (
            <Alert>
              <AlertDescription>
                AI features are not configured on this deployment.
              </AlertDescription>
            </Alert>
          )}

          {panel.status === 'malformed' && (
            <Alert variant="destructive">
              <AlertDescription>
                The AI returned an unexpected response. Try again.
              </AlertDescription>
            </Alert>
          )}

          {panel.status === 'failed' && (
            <Alert variant="destructive">
              <AlertDescription>Could not run the check. Try again.</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  )
}
