'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, X, Star, Sparkles, Loader2 } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { blankQuestion, TYPE_LABEL_KEY } from './scorecard-shared'
import type {
  ScorecardState,
  ScorecardJdContext,
  ScorecardScreeningQuestion,
  ScreeningAnswerType,
} from './scorecard-shared'
export type {
  ScorecardState,
  ScreeningAnswerType,
  ScorecardScreeningQuestion,
  ScorecardAttribute,
  ScorecardJdContext,
  NumberOp,
} from './scorecard-shared'
import { ScreeningQuestionRow } from './step-scorecard-parts'

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
  const t = useTranslations()
  const [newAttribute, setNewAttribute] = useState('')
  const [newQuestion, setNewQuestion] = useState('')
  const [newAnswerType, setNewAnswerType] = useState<ScreeningAnswerType>('yes_no')
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
          // So the model returns only NEW criteria, not rephrasings of what's added.
          existing_skills: value.attributes.map((a) => a.label).filter(Boolean),
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

  const needsOptions = (t: ScreeningAnswerType) => t === 'select'

  const addQuestion = () => {
    const label = newQuestion.trim()
    if (!label) return
    let options: string[] | undefined
    if (needsOptions(newAnswerType)) {
      options = newOptions
        .split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0)
      if (options.length === 0) return
    }
    onChange({
      ...value,
      screeningQuestions: [
        ...value.screeningQuestions,
        blankQuestion(label, newAnswerType, options),
      ],
    })
    setNewQuestion('')
    setNewAnswerType('yes_no')
    setNewOptions('')
  }

  const updateQuestion = (idx: number, patch: Partial<ScorecardScreeningQuestion>) => {
    onChange({
      ...value,
      screeningQuestions: value.screeningQuestions.map((q, i) =>
        i === idx ? { ...q, ...patch } : q,
      ),
    })
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
      <section className="flex-1 rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]" aria-label={t('wizard.interviewScorecard')}>
        <header className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-bold text-foreground">{t('wizard.interviewScorecard')}</h3>
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
            {t('wizard.suggestFromJd')}
          </Button>
        </header>
        <p className="mb-3 text-[12px] text-muted-foreground">
          {t('wizard.scorecardHint')}
        </p>

        {suggest.status !== 'idle' && suggest.status !== 'loading' && (
          <div className="mb-3 rounded-[9px] border border-dashed border-[oklch(0.85_0.05_250)] bg-[oklch(0.985_0.012_250)] p-2.5">
            {suggest.status === 'ok' ? (
              suggest.skills.filter((s) => !hasAttribute(s)).length === 0 ? (
                <p className="text-[11.5px] text-muted-foreground">
                  {t('wizard.suggestAllAdded')}
                </p>
              ) : (
                <>
                  <p className="mb-1.5 text-[11.5px] font-medium text-muted-foreground">
                    {t('wizard.suggestClickToAdd')}
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
                  ? t('wizard.suggestTooThin')
                  : suggest.status === 'rate_limited'
                    ? t('wizard.suggestRateLimited')
                    : suggest.status === 'no_key'
                      ? t('wizard.aiNotConfigured')
                      : t('wizard.suggestFailed')}
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
                aria-label={attr.mustHave ? t('wizard.markNiceToHave') : t('wizard.markMustHave')}
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
                {attr.mustHave ? t('wizard.mustHave') : t('wizard.niceToHave')}
              </button>
              <button
                type="button"
                onClick={() => removeAttribute(idx)}
                aria-label={t('wizard.removeNamed', { label: attr.label })}
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
            placeholder={t('wizard.addAttributePlaceholder')}
            className="h-9 text-[13px]"
            aria-label={t('wizard.newAttributeAria')}
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
            {t('wizard.add')}
          </Button>
        </div>
      </section>

      {/* Screening questions */}
      <section className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px] lg:w-[460px]" aria-label={t('wizard.screeningQuestions')}>
        <header className="mb-3">
          <h3 className="text-[15px] font-bold text-foreground">{t('wizard.screeningQuestions')}</h3>
        </header>
        <p className="mb-3 text-[12px] text-muted-foreground">
          {t('wizard.screeningHint')}
        </p>

        <ul className="space-y-2">
          {value.screeningQuestions.map((q, idx) => (
            <ScreeningQuestionRow
              key={idx}
              q={q}
              onPatch={(patch) => updateQuestion(idx, patch)}
              onRemove={() => removeQuestion(idx)}
            />
          ))}
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
            placeholder={t('wizard.addQuestionPlaceholder')}
            className="h-9 text-[12.5px]"
            aria-label={t('wizard.newQuestionAria')}
            maxLength={500}
          />

          {/* Type picker */}
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('wizard.answerType')}>
            {(['yes_no', 'short_text', 'number', 'select'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setNewAnswerType(type)}
                role="radio"
                aria-checked={newAnswerType === type}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[11.5px] font-semibold transition-colors',
                  newAnswerType === type
                    ? 'border-[oklch(0.55_0.18_250)] bg-[oklch(0.98_0.015_250)] text-[oklch(0.2_0.16_250)]'
                    : 'border-[oklch(0.9_0.01_250)] text-foreground/75 hover:bg-muted/40',
                )}
              >
                {t(TYPE_LABEL_KEY[type])}
              </button>
            ))}
          </div>

          {/* Options input — select only */}
          {needsOptions(newAnswerType) && (
            <Input
              value={newOptions}
              onChange={(e) => setNewOptions(e.target.value)}
              placeholder={t('wizard.optionsPlaceholder')}
              className="h-9 text-[12.5px]"
              aria-label={t('wizard.selectOptionsAria')}
            />
          )}

          <div className="flex items-center">
            <span className="text-[11px] text-muted-foreground">
              {t('wizard.addedInformational')}
            </span>
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
              {t('wizard.add')}
            </Button>
          </div>
        </div>

        <p className="mt-3 text-[11.5px] text-muted-foreground">
          {t('wizard.skipScorecard')}
        </p>
      </section>
    </div>
  )
}
