'use client'

import { useState } from 'react'
import { Plus, X, Star, Sparkles, Loader2 } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ScorecardAttribute {
  label: string
  mustHave: boolean
}

export type ScreeningAnswerType = 'yes_no' | 'short_text' | 'number' | 'select'

export interface ScorecardScreeningQuestion {
  label: string
  answerType: ScreeningAnswerType
  /** Knockout questions auto-flag the application at screening. Only
   * meaningful for `yes_no` (must = Yes) and `select` (must = first
   * option). `short_text` and `number` are always informational. */
  knockout: boolean
  /** Required when `answerType === 'select'`; ignored otherwise. */
  options?: string[]
}

export interface ScorecardState {
  attributes: ScorecardAttribute[]
  screeningQuestions: ScorecardScreeningQuestion[]
}

/** Role context the "Suggest from JD" assist sends at click time. */
export interface ScorecardJdContext {
  title: string
  department: string | null
  location: string | null
  employment_type: 'full_time' | 'part_time' | 'contract' | 'internship' | null
  sector_name: string | null
  description: string | null
  responsibilities: string | null
  requirements: string | null
}

interface StepScorecardProps {
  value: ScorecardState
  onChange: (next: ScorecardState) => void
  jdContext: ScorecardJdContext
}

type SuggestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; skills: string[] }
  | { status: 'too_thin' }
  | { status: 'rate_limited' }
  | { status: 'no_key' }
  | { status: 'failed' }

const TYPE_LABELS: Record<ScreeningAnswerType, string> = {
  yes_no: 'Yes / No',
  short_text: 'Short text',
  number: 'Number',
  select: 'Select',
}

/**
 * Wave 2.7 wizard — Step 4 / Scorecard & questions (NEW · optional) per
 * Create Vacancy Steps.dc.html.
 *
 * Two side-by-side cards:
 *   - Interview scorecard: 1–5 attributes interviewers rate, with a
 *     must-have ★ flag on each.
 *   - Screening questions: asked on the apply form; knockout answers
 *     auto-flag.
 *
 * Wave 2.5 Slices 1, 2a, 2b shipped the schema, recruiter persistence,
 * apply-form rendering, and knockout-flag surface. This step (Wave 2.5
 * cleanup) extends the wizard to capture all four answer types —
 * yes_no / short_text / number / select — that the schema and apply
 * form already support. For `select` we also capture the option list as
 * a comma-separated input.
 */
export function StepScorecard({ value, onChange, jdContext }: StepScorecardProps) {
  const [newAttribute, setNewAttribute] = useState('')
  const [newQuestion, setNewQuestion] = useState('')
  const [newAnswerType, setNewAnswerType] = useState<ScreeningAnswerType>('yes_no')
  const [newKnockout, setNewKnockout] = useState(false)
  const [newOptions, setNewOptions] = useState('')
  const [suggest, setSuggest] = useState<SuggestState>({ status: 'idle' })

  const addAttribute = () => {
    const label = newAttribute.trim()
    if (!label) return
    onChange({
      ...value,
      attributes: [...value.attributes, { label, mustHave: false }],
    })
    setNewAttribute('')
  }

  const hasAttribute = (label: string) =>
    value.attributes.some((a) => a.label.trim().toLowerCase() === label.trim().toLowerCase())

  const addSuggested = (label: string) => {
    if (hasAttribute(label)) return
    onChange({ ...value, attributes: [...value.attributes, { label, mustHave: false }] })
  }

  // "Suggest from JD" — live during creation. Sends the role context entered
  // so far to the assessment-suggester (raw-text mode, nothing persisted) and
  // offers the returned skill labels to add as scorecard attributes.
  const runSuggest = async () => {
    if (!jdContext.title.trim()) {
      setSuggest({ status: 'too_thin' })
      return
    }
    setSuggest({ status: 'loading' })
    try {
      const res = await fetch('/api/ai/assessment-suggester', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: jdContext.title,
          description: jdContext.description,
          responsibilities: jdContext.responsibilities,
          requirements: jdContext.requirements,
          department: jdContext.department,
          location: jdContext.location,
          employment_type: jdContext.employment_type,
          sector_name: jdContext.sector_name,
        }),
      })
      const body = await res.json()
      if (body.ok && Array.isArray(body.suggestions?.skills)) {
        setSuggest({ status: 'ok', skills: body.suggestions.skills as string[] })
        return
      }
      const reason = body?.reason
      setSuggest({
        status:
          reason === 'too_thin'
            ? 'too_thin'
            : reason === 'rate_limited'
              ? 'rate_limited'
              : reason === 'no_key'
                ? 'no_key'
                : 'failed',
      })
    } catch (err) {
      console.error('[wizard] suggest-from-jd failed:', err)
      setSuggest({ status: 'failed' })
    }
  }

  const toggleMustHave = (idx: number) => {
    onChange({
      ...value,
      attributes: value.attributes.map((a, i) =>
        i === idx ? { ...a, mustHave: !a.mustHave } : a,
      ),
    })
  }

  const removeAttribute = (idx: number) => {
    onChange({
      ...value,
      attributes: value.attributes.filter((_, i) => i !== idx),
    })
  }

  const supportsKnockout = (t: ScreeningAnswerType) => t === 'yes_no' || t === 'select'
  const needsOptions = (t: ScreeningAnswerType) => t === 'select'

  const addQuestion = () => {
    const label = newQuestion.trim()
    if (!label) return
    if (needsOptions(newAnswerType)) {
      const parsed = newOptions
        .split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0)
      if (parsed.length === 0) return
      onChange({
        ...value,
        screeningQuestions: [
          ...value.screeningQuestions,
          {
            label,
            answerType: newAnswerType,
            knockout: newKnockout,
            options: parsed,
          },
        ],
      })
    } else {
      onChange({
        ...value,
        screeningQuestions: [
          ...value.screeningQuestions,
          {
            label,
            answerType: newAnswerType,
            knockout: supportsKnockout(newAnswerType) ? newKnockout : false,
          },
        ],
      })
    }
    setNewQuestion('')
    setNewAnswerType('yes_no')
    setNewKnockout(false)
    setNewOptions('')
  }

  const removeQuestion = (idx: number) => {
    onChange({
      ...value,
      screeningQuestions: value.screeningQuestions.filter((_, i) => i !== idx),
    })
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Interview scorecard */}
      <section className="flex-1 rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]" aria-label="Interview scorecard">
        <header className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-bold text-foreground">Interview scorecard</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={runSuggest}
            disabled={suggest.status === 'loading'}
            className="ml-auto h-8 gap-1.5"
          >
            {suggest.status === 'loading' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            )}
            Suggest from JD
          </Button>
        </header>
        <p className="mb-3 text-[12px] text-muted-foreground">
          Attributes interviewers rate 1–5. Skip to use a default set you can edit later.
        </p>

        {suggest.status !== 'idle' && suggest.status !== 'loading' && (
          <div className="mb-3 rounded-[9px] border border-dashed border-[oklch(0.85_0.05_250)] bg-[oklch(0.985_0.012_250)] p-2.5">
            {suggest.status === 'ok' ? (
              suggest.skills.filter((s) => !hasAttribute(s)).length === 0 ? (
                <p className="text-[11.5px] text-muted-foreground">
                  All suggestions are already on your scorecard.
                </p>
              ) : (
                <>
                  <p className="mb-1.5 text-[11.5px] font-medium text-muted-foreground">
                    Suggested attributes — click to add:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggest.skills
                      .filter((s) => !hasAttribute(s))
                      .map((skill) => (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => addSuggested(skill)}
                          className="inline-flex items-center gap-1 rounded-md border border-[oklch(0.85_0.05_250)] bg-white px-2 py-1 text-[12px] font-medium text-foreground/80 transition-colors hover:bg-[oklch(0.96_0.03_250)]"
                        >
                          <Plus className="h-3 w-3 text-primary" aria-hidden />
                          {skill}
                        </button>
                      ))}
                  </div>
                </>
              )
            ) : (
              <p className="text-[11.5px] text-muted-foreground">
                {suggest.status === 'too_thin'
                  ? 'Add a title (and ideally a description) first, then try again.'
                  : suggest.status === 'rate_limited'
                    ? 'You’ve generated a lot recently. Try again in a few minutes.'
                    : suggest.status === 'no_key'
                      ? 'AI features are not configured on this deployment.'
                      : 'Could not generate suggestions. Try again.'}
              </p>
            )}
          </div>
        )}

        <ul className="space-y-2">
          {value.attributes.map((attr, idx) => (
            <li
              key={`${attr.label}-${idx}`}
              className="flex items-center gap-2.5 rounded-[9px] border border-[oklch(0.92_0.01_250)] px-3 py-2.5"
            >
              <span className="flex-1 text-[13px] font-medium text-foreground">{attr.label}</span>
              <button
                type="button"
                onClick={() => toggleMustHave(idx)}
                aria-pressed={attr.mustHave}
                aria-label={attr.mustHave ? 'Mark nice-to-have' : 'Mark must-have'}
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-bold transition-colors"
                style={
                  attr.mustHave
                    ? {
                        background: 'oklch(0.96 0.05 27)',
                        color: 'oklch(0.5 0.19 27)',
                      }
                    : {
                        border: '1px solid oklch(0.9 0.01 250)',
                        color: 'oklch(0.5 0.02 250)',
                      }
                }
              >
                <Star
                  className="h-3 w-3"
                  fill={attr.mustHave ? 'oklch(0.5 0.19 27)' : 'none'}
                  aria-hidden
                />
                {attr.mustHave ? 'Must-have' : 'Nice-to-have'}
              </button>
              <button
                type="button"
                onClick={() => removeAttribute(idx)}
                aria-label={`Remove ${attr.label}`}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex gap-2">
          <Input
            value={newAttribute}
            onChange={(e) => setNewAttribute(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addAttribute()
              }
            }}
            placeholder="Add attribute — e.g. Stakeholder Communication"
            className="h-9 text-[13px]"
            aria-label="New attribute"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addAttribute}
            disabled={!newAttribute.trim()}
            className="h-9 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add
          </Button>
        </div>
      </section>

      {/* Screening questions */}
      <section className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px] lg:w-[460px]" aria-label="Screening questions">
        <header className="mb-3">
          <h3 className="text-[15px] font-bold text-foreground">Screening questions</h3>
        </header>
        <p className="mb-3 text-[12px] text-muted-foreground">
          Auto-added to the apply form. Knockout answers auto-flag at screening — candidates can
          still submit.
        </p>

        <ul className="space-y-2">
          {value.screeningQuestions.map((q, idx) => {
            const knockoutAnswer =
              q.answerType === 'yes_no'
                ? 'Yes'
                : q.answerType === 'select' && q.options && q.options.length > 0
                  ? q.options[0]
                  : null
            return (
              <li
                key={`${q.label}-${idx}`}
                className="rounded-[9px] border border-[oklch(0.92_0.01_250)] px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-[12.5px] font-medium text-foreground">{q.label}</span>
                  <span
                    className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
                    title={`Answer type: ${TYPE_LABELS[q.answerType]}`}
                  >
                    {TYPE_LABELS[q.answerType]}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeQuestion(idx)}
                    aria-label={`Remove ${q.label}`}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                <p
                  className="mt-1 text-[11px] font-semibold"
                  style={{ color: q.knockout ? 'oklch(0.5 0.19 27)' : 'oklch(0.5 0.02 250)' }}
                >
                  {q.knockout && knockoutAnswer
                    ? `Knockout · must = ${knockoutAnswer}`
                    : 'Informational'}
                </p>
                {q.answerType === 'select' && q.options && q.options.length > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Options: {q.options.join(' · ')}
                  </p>
                )}
              </li>
            )
          })}
        </ul>

        {/* Add new screening question */}
        <div className="mt-3 flex flex-col gap-2 rounded-[9px] border border-dashed border-[oklch(0.88_0.01_250)] p-2.5">
          <Input
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !needsOptions(newAnswerType)) {
                e.preventDefault()
                addQuestion()
              }
            }}
            placeholder="Add question — e.g. Eligible to work here?"
            className="h-9 text-[12.5px]"
            aria-label="New screening question"
            maxLength={500}
          />

          {/* Type picker */}
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Answer type">
            {(['yes_no', 'short_text', 'number', 'select'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setNewAnswerType(t)
                  if (!supportsKnockout(t)) setNewKnockout(false)
                }}
                role="radio"
                aria-checked={newAnswerType === t}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[11.5px] font-semibold transition-colors',
                  newAnswerType === t
                    ? 'border-[oklch(0.55_0.18_250)] bg-[oklch(0.98_0.015_250)] text-[oklch(0.2_0.16_250)]'
                    : 'border-[oklch(0.9_0.01_250)] text-foreground/75 hover:bg-muted/40',
                )}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Options input — select only */}
          {needsOptions(newAnswerType) && (
            <Input
              value={newOptions}
              onChange={(e) => setNewOptions(e.target.value)}
              placeholder="Options, comma-separated — e.g. Citizen, Permanent Resident, Visa needed"
              className="h-9 text-[12.5px]"
              aria-label="Select options"
            />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setNewKnockout((v) => !v)}
              disabled={!supportsKnockout(newAnswerType)}
              aria-pressed={newKnockout}
              className={cn(
                'rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                newKnockout
                  ? 'border-[oklch(0.86_0.05_27)] bg-[oklch(0.96_0.05_27)] text-[oklch(0.5_0.19_27)]'
                  : 'border-[oklch(0.9_0.01_250)] text-foreground/70',
              )}
              title={
                supportsKnockout(newAnswerType)
                  ? newKnockout
                    ? 'Will auto-flag if answer is wrong'
                    : 'Informational only'
                  : 'Knockout only applies to Yes/No and Select'
              }
            >
              {newKnockout ? 'Knockout' : 'Informational'}
            </button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addQuestion}
              disabled={
                !newQuestion.trim() ||
                (needsOptions(newAnswerType) && newOptions.split(',').every((o) => !o.trim()))
              }
              className="ml-auto h-9 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add
            </Button>
          </div>
        </div>

        <p className="mt-3 text-[11.5px] text-muted-foreground">
          Skip this step → default scorecard + no screening questions. Fully editable later on the
          vacancy.
        </p>
      </section>
    </div>
  )
}
