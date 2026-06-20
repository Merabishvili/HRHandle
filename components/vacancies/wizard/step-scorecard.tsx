'use client'

import { useState } from 'react'
import { Plus, X, Star, Sparkles } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export interface ScorecardAttribute {
  label: string
  mustHave: boolean
}

export interface ScorecardScreeningQuestion {
  label: string
  /** Knockout questions auto-flag the application at screening. Slice 2a
   * persists these as `yes_no` rows on `vacancy_screening_questions`;
   * Slice 2b extends the wizard to capture the other answer types and
   * wires the public apply form to read + write answers. */
  knockout: boolean
}

export interface ScorecardState {
  attributes: ScorecardAttribute[]
  screeningQuestions: ScorecardScreeningQuestion[]
}

interface StepScorecardProps {
  value: ScorecardState
  onChange: (next: ScorecardState) => void
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
 * Wave 2.5 Slice 1 + 2a wires both lists to persistence —
 * `vacancy_questions.must_have` for the attribute stars and the new
 * `vacancy_screening_questions` table for the screening list. The
 * candidate-facing apply form integration ships with Slice 2b.
 */
export function StepScorecard({ value, onChange }: StepScorecardProps) {
  const [newAttribute, setNewAttribute] = useState('')
  const [newQuestion, setNewQuestion] = useState('')

  const addAttribute = () => {
    const label = newAttribute.trim()
    if (!label) return
    onChange({
      ...value,
      attributes: [...value.attributes, { label, mustHave: false }],
    })
    setNewAttribute('')
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

  const addQuestion = () => {
    const label = newQuestion.trim()
    if (!label) return
    onChange({
      ...value,
      screeningQuestions: [...value.screeningQuestions, { label, knockout: false }],
    })
    setNewQuestion('')
  }

  const toggleKnockout = (idx: number) => {
    onChange({
      ...value,
      screeningQuestions: value.screeningQuestions.map((q, i) =>
        i === idx ? { ...q, knockout: !q.knockout } : q,
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
      <section className="flex-1 rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px]" aria-label="Interview scorecard">
        <header className="mb-3 flex items-center gap-2">
          <h3 className="text-[15px] font-bold text-foreground">Interview scorecard</h3>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[oklch(0.88_0.05_250)] bg-[oklch(0.98_0.04_250)] px-2.5 py-1 text-[12px] font-semibold text-[oklch(0.45_0.16_250)]">
            <Sparkles className="h-3 w-3" aria-hidden />
            Suggest from JD
            <span className="ml-1 rounded bg-[oklch(0.93_0.05_250)] px-1 text-[9px] font-bold uppercase">soon</span>
          </span>
        </header>
        <p className="mb-3 text-[12px] text-muted-foreground">
          Attributes interviewers rate 1–5. Skip to use a default set you can edit later.
        </p>

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
      <section className="rounded-xl border border-[oklch(0.91_0.01_250)] bg-white p-4 sm:p-[18px] lg:w-[420px]" aria-label="Screening questions">
        <header className="mb-3">
          <h3 className="text-[15px] font-bold text-foreground">Screening questions</h3>
        </header>
        <p className="mb-3 text-[12px] text-muted-foreground">
          Auto-added to the apply form. Knockout answers auto-flag at screening.
        </p>

        <ul className="space-y-2">
          {value.screeningQuestions.map((q, idx) => (
            <li
              key={`${q.label}-${idx}`}
              className="rounded-[9px] border border-[oklch(0.92_0.01_250)] px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[12.5px] font-medium text-foreground">{q.label}</span>
                <button
                  type="button"
                  onClick={() => removeQuestion(idx)}
                  aria-label={`Remove ${q.label}`}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              <button
                type="button"
                onClick={() => toggleKnockout(idx)}
                aria-pressed={q.knockout}
                className="mt-1 text-[11px] font-semibold transition-colors"
                style={{ color: q.knockout ? 'oklch(0.5 0.19 27)' : 'oklch(0.5 0.02 250)' }}
              >
                {q.knockout ? 'Knockout · must = Yes' : 'Informational'}
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex gap-2">
          <Input
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addQuestion()
              }
            }}
            placeholder="Add question — e.g. Eligible to work here?"
            className="h-9 text-[12.5px]"
            aria-label="New screening question"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addQuestion}
            disabled={!newQuestion.trim()}
            className="h-9 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add
          </Button>
        </div>

        <p className="mt-3 text-[11.5px] text-muted-foreground">
          Skip this step → default scorecard + no screening questions. Fully editable later on the vacancy.
        </p>
      </section>
    </div>
  )
}
