// Pure assembly of the candidate scorecard view from DB shapes (G-025). Lives
// outside the server action so the projection is unit-testable and so the
// public page component stays a dumb renderer.

export interface ScorecardQuestion {
  id: string
  label: string
  type: 'text' | 'score'
  sort_order: number
}

export interface ScorecardAnswer {
  question_id: string
  text_value: string | null
  score_value: number | null
}

export interface ScorecardInput {
  /** Overall percentage 0-100, as stored on `candidate_evaluations.score`. */
  overallScore: number | null
  questions: ReadonlyArray<ScorecardQuestion>
  answers: ReadonlyArray<ScorecardAnswer>
}

/** A single answered question on the public scorecard view. Either a text
 * response or a numeric score (never both — keeps the renderer trivial). */
export type ScorecardItem =
  | { kind: 'text'; questionId: string; label: string; text: string }
  | {
      kind: 'score'
      questionId: string
      label: string
      score: number
      max: number
      percentage: number
    }

export interface ScorecardView {
  overallScore: number | null
  items: ScorecardItem[]
}

const SCORE_MAX = 10

/** Build the view the public page renders. Filters out unanswered questions
 * (empty strings + null scores) and any answer whose question we no longer
 * know about (defensive against schema drift / soft-deleted question rows).
 * Items are sorted by the question's `sort_order` so the public scorecard
 * shows up in the same order the recruiter sees on their own page. */
export function projectScorecard(input: ScorecardInput): ScorecardView {
  const questionsById = new Map<string, ScorecardQuestion>(
    input.questions.map((q) => [q.id, q]),
  )
  const items: ScorecardItem[] = []

  for (const a of input.answers) {
    const q = questionsById.get(a.question_id)
    if (!q) continue
    if (q.type === 'score') {
      const score = a.score_value
      if (score === null || score === undefined) continue
      if (!Number.isFinite(score)) continue
      const clamped = Math.max(0, Math.min(SCORE_MAX, score))
      items.push({
        kind: 'score',
        questionId: q.id,
        label: q.label,
        score: clamped,
        max: SCORE_MAX,
        percentage: Math.round((clamped / SCORE_MAX) * 100),
      })
    } else {
      const text = (a.text_value ?? '').trim()
      if (text.length === 0) continue
      items.push({ kind: 'text', questionId: q.id, label: q.label, text })
    }
  }

  items.sort((a, b) => {
    const sa = questionsById.get(a.questionId)?.sort_order ?? 0
    const sb = questionsById.get(b.questionId)?.sort_order ?? 0
    return sa - sb
  })

  const overallScore =
    typeof input.overallScore === 'number' && Number.isFinite(input.overallScore)
      ? Math.max(0, Math.min(100, Math.round(input.overallScore)))
      : null

  return { overallScore, items }
}
