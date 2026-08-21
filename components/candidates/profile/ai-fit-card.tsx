'use client'

import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Sparkles, Shield, ChevronDown, ChevronRight, Check, CircleAlert, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { runAiFitAnalysis, getAiFitAnalysis, submitFitAssessment } from '@/lib/actions/ai-fit'
import type { AiFitAnalysis, FitConfidence } from '@/lib/types/ai-fit'

const CONFIDENCE_STYLE: Record<FitConfidence, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-[oklch(0.95_0.05_95)] text-[oklch(0.45_0.11_80)]',
  high: 'bg-[oklch(0.93_0.07_155)] text-[oklch(0.36_0.14_150)]',
}

const CATEGORY_LABEL_KEY: Record<string, string> = {
  name: 'aiFit.catName',
  contact_details: 'aiFit.catContact',
}

const CONFIDENCE_LEVEL_KEY: Record<FitConfidence, string> = {
  low: 'aiFit.confLow',
  medium: 'aiFit.confMedium',
  high: 'aiFit.confHigh',
}

/**
 * AI Fit Analysis card (Wave 3.1). Collapsed by default (anti-anchoring).
 * Advisory-only, evidence-based, NO overall score — renders "meets N of M
 * must-haves" + per-criterion match. Enforces the mandatory Agree/Override
 * human-oversight step. Renders nothing when the org hasn't enabled the feature.
 */
export function AiFitCard({ applicationId, enabled }: { applicationId: string; enabled: boolean }) {
  const tr = useTranslations()
  const [expanded, setExpanded] = useState(false)
  const [analysis, setAnalysis] = useState<AiFitAnalysis | null>(null)
  const [isPending, startTransition] = useTransition()
  const [overriding, setOverriding] = useState(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!enabled) return
    let alive = true
    getAiFitAnalysis(applicationId).then((r) => {
      if (alive && r.success) setAnalysis(r.data)
    })
    return () => {
      alive = false
    }
  }, [applicationId, enabled])

  if (!enabled) return null

  const run = () =>
    startTransition(async () => {
      const r = await runAiFitAnalysis(applicationId)
      if (!r.success) {
        toast.error(r.error)
        return
      }
      const g = await getAiFitAnalysis(applicationId)
      if (g.success) setAnalysis(g.data)
      setExpanded(true)
    })

  const assess = (choice: 'agree' | 'override') =>
    startTransition(async () => {
      if (!analysis) return
      const r = await submitFitAssessment(analysis.id, choice, choice === 'override' ? reason : null)
      if (!r.success) {
        toast.error(r.error)
        return
      }
      setAnalysis({
        ...analysis,
        assessment: choice,
        assessment_reason: choice === 'override' ? reason : null,
        assessed_at: new Date().toISOString(),
      })
      setOverriding(false)
      setReason('')
      toast.success(choice === 'agree' ? tr('aiFit.toastAgreed') : tr('aiFit.toastOverride'))
    })

  const a = analysis?.rendered_analysis

  return (
    <div className="rounded-[11px] border border-[oklch(0.88_0.05_250)] bg-white">
      {/* Header (always visible) */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <Sparkles className="h-4 w-4 text-[oklch(0.45_0.16_250)]" aria-hidden />
        <span className="text-sm font-semibold text-[oklch(0.2_0.14_250)]">{tr('aiFit.title')}</span>
        <span className="rounded-md border border-[oklch(0.88_0.05_250)] bg-[oklch(0.96_0.03_250)] px-1.5 py-0.5 text-[10px] font-semibold text-[oklch(0.45_0.16_250)]">
          {tr('aiFit.advisory')}
        </span>
        {analysis && (
          <span className="text-xs text-muted-foreground">
            {tr('aiFit.meetsShort', { n: analysis.meets_count, m: analysis.must_have_total })}
          </span>
        )}
        <span className="ml-auto text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[oklch(0.93_0.01_250)] px-4 py-3.5">
          {/* No analysis yet → run */}
          {!analysis && (
            <div className="flex flex-col items-start gap-2">
              <p className="text-xs text-muted-foreground">
                {tr('aiFit.intro')}
              </p>
              <Button size="sm" onClick={run} disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
                {tr('aiFit.runAnalysis')}
              </Button>
            </div>
          )}

          {analysis && a && (
            <div className="flex flex-col gap-3.5">
              {/* Sanitization + confidence banner */}
              <div className="flex items-start gap-2 rounded-lg border border-[oklch(0.93_0.01_250)] bg-[oklch(0.985_0.002_247)] px-3 py-2">
                <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                  {tr('aiFit.scoredOnly')}
                  {analysis.redacted_categories.length > 0 && (
                    <> {tr('aiFit.removed', { list: analysis.redacted_categories.map((c) => (CATEGORY_LABEL_KEY[c] ? tr(CATEGORY_LABEL_KEY[c]) : c)).join(', ') })}</>
                  )}{' '}
                  {tr('aiFit.neverSent')}
                </p>
                <span className={cn('ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase', CONFIDENCE_STYLE[a.confidence])}>
                  {tr('aiFit.confidence', { level: tr(CONFIDENCE_LEVEL_KEY[a.confidence]) })}
                </span>
              </div>

              {/* Meets N/M (factual, not a grade) */}
              <div className="text-sm font-semibold text-foreground">
                {tr('aiFit.meetsCriteria', { n: a.meets_count, m: a.must_have_total })}
              </div>

              {/* Per-criterion */}
              {a.criteria.length > 0 && (
                <div className="flex flex-col gap-2">
                  {a.criteria.map((c) => (
                    <div key={c.name} className="rounded-lg border border-[oklch(0.93_0.01_250)] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-foreground">{c.name}</span>
                        {c.must_have && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">{tr('aiFit.mustHaveTag')}</span>}
                        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{tr('aiFit.matchPct', { n: c.match_degree })}</span>
                      </div>
                      {c.evidence && <p className="mt-1 text-[12px] text-muted-foreground">{c.explanation} <span className="italic">({c.evidence})</span></p>}
                    </div>
                  ))}
                </div>
              )}

              {/* Strengths / to-verify / questions */}
              {a.strengths.length > 0 && (
                <Section title={tr('aiFit.strengths')} color="oklch(0.4 0.13 150)">
                  {a.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-foreground">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[oklch(0.42_0.14_150)]" aria-hidden />
                      <span>{s.text} {s.evidence && <span className="text-muted-foreground">({s.evidence})</span>}</span>
                    </li>
                  ))}
                </Section>
              )}
              {a.to_verify.length > 0 && (
                <Section title={tr('aiFit.toVerify')} color="oklch(0.5 0.1 65)">
                  {a.to_verify.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-foreground">
                      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[oklch(0.6_0.13_65)]" aria-hidden />
                      <span>{item.text}</span>
                    </li>
                  ))}
                </Section>
              )}
              {a.suggested_questions.length > 0 && (
                <Section title={tr('aiFit.suggestedQuestions')} color="oklch(0.45 0.16 250)">
                  {a.suggested_questions.map((q, i) => (
                    <li key={i} className="rounded-lg border border-[oklch(0.92_0.01_250)] px-3 py-2 text-[12.5px] text-foreground">{q}</li>
                  ))}
                </Section>
              )}

              {/* Mandatory assessment */}
              <div className="border-t border-[oklch(0.93_0.01_250)] pt-3">
                <div className="mb-2 text-[11.5px] font-bold text-foreground">
                  {tr('aiFit.yourAssessment')} <span className="font-normal text-muted-foreground">{tr('aiFit.personDecides')}</span>
                </div>
                {analysis.assessment ? (
                  <div className="rounded-lg bg-[oklch(0.985_0.002_247)] px-3 py-2 text-[12.5px] text-muted-foreground">
                    {tr.rich(analysis.assessment === 'agree' ? 'aiFit.youAgreed' : 'aiFit.youOverrode', { b: (c) => <strong className="text-foreground">{c}</strong> })}
                    {analysis.assessment_reason && <>{tr('aiFit.reasonSuffix', { reason: analysis.assessment_reason })}</>}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => assess('agree')} disabled={isPending} className="flex-1">{tr('aiFit.agreeWithAi')}</Button>
                      <Button size="sm" variant="outline" onClick={() => setOverriding((v) => !v)} disabled={isPending} className="flex-1">{tr('aiFit.override')}</Button>
                    </div>
                    {overriding && (
                      <div className="flex flex-col gap-2">
                        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tr('aiFit.overridePlaceholder')} rows={2} />
                        <Button size="sm" onClick={() => assess('override')} disabled={isPending || !reason.trim()}>{tr('aiFit.saveOverride')}</Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Audit rail — when it ran / was reviewed. The model + prompt
                  version stay recorded on the ai_fit_analyses row (append-only
                  provenance for the audit trail); they're just not surfaced in
                  the recruiter UI (#N10). */}
              <div className="rounded-lg border border-[oklch(0.93_0.01_250)] px-3 py-2 text-[10.5px] leading-relaxed text-muted-foreground">
                {tr('aiFit.generated')} {new Date(analysis.created_at).toLocaleString()}
                {analysis.assessed_at && <> · {tr('aiFit.reviewed')} {new Date(analysis.assessed_at).toLocaleString()}</>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide" style={{ color }}>{title}</div>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </div>
  )
}
