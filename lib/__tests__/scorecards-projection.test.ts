import { describe, it, expect } from 'vitest'
import {
  projectScorecard,
  type ScorecardAnswer,
  type ScorecardQuestion,
} from '@/lib/scorecards/projection'

const Q1: ScorecardQuestion = { id: 'q1', label: 'Communication', type: 'score', sort_order: 1 }
const Q2: ScorecardQuestion = { id: 'q2', label: 'Technical depth', type: 'score', sort_order: 2 }
const Q3: ScorecardQuestion = {
  id: 'q3',
  label: 'How did they handle the system-design round?',
  type: 'text',
  sort_order: 3,
}
const Q4: ScorecardQuestion = { id: 'q4', label: 'Culture', type: 'text', sort_order: 4 }

describe('projectScorecard', () => {
  it('returns empty items + null overall for an evaluation with no answers', () => {
    expect(
      projectScorecard({ overallScore: null, questions: [Q1, Q2], answers: [] }),
    ).toEqual({ overallScore: null, items: [] })
  })

  it('renders a single score answer with the percentage computed', () => {
    const answers: ScorecardAnswer[] = [
      { question_id: 'q1', text_value: null, score_value: 8 },
    ]
    const view = projectScorecard({ overallScore: 80, questions: [Q1], answers })
    expect(view.overallScore).toBe(80)
    expect(view.items).toEqual([
      { kind: 'score', questionId: 'q1', label: 'Communication', score: 8, max: 10, percentage: 80 },
    ])
  })

  it('renders a single text answer trimmed', () => {
    const answers: ScorecardAnswer[] = [
      { question_id: 'q3', text_value: '  Did very well end-to-end.  ', score_value: null },
    ]
    const view = projectScorecard({ overallScore: null, questions: [Q3], answers })
    expect(view.items).toEqual([
      {
        kind: 'text',
        questionId: 'q3',
        label: 'How did they handle the system-design round?',
        text: 'Did very well end-to-end.',
      },
    ])
  })

  it('drops empty text answers and null/undefined score answers', () => {
    const answers: ScorecardAnswer[] = [
      { question_id: 'q3', text_value: '   ', score_value: null }, // empty after trim
      { question_id: 'q1', text_value: null, score_value: null },  // no score
      { question_id: 'q2', text_value: null, score_value: 9 },     // kept
    ]
    const view = projectScorecard({
      overallScore: 90,
      questions: [Q1, Q2, Q3],
      answers,
    })
    expect(view.items).toEqual([
      { kind: 'score', questionId: 'q2', label: 'Technical depth', score: 9, max: 10, percentage: 90 },
    ])
  })

  it('drops answers whose question is unknown (defensive)', () => {
    const answers: ScorecardAnswer[] = [
      { question_id: 'q1', text_value: null, score_value: 7 },
      { question_id: 'mystery', text_value: 'should not render', score_value: null },
    ]
    const view = projectScorecard({ overallScore: null, questions: [Q1], answers })
    expect(view.items.map((i) => i.questionId)).toEqual(['q1'])
  })

  it('sorts items by question sort_order', () => {
    const answers: ScorecardAnswer[] = [
      { question_id: 'q4', text_value: 'culture note', score_value: null },
      { question_id: 'q1', text_value: null, score_value: 8 },
      { question_id: 'q3', text_value: 'system design', score_value: null },
      { question_id: 'q2', text_value: null, score_value: 9 },
    ]
    const view = projectScorecard({
      overallScore: 85,
      questions: [Q1, Q2, Q3, Q4],
      answers,
    })
    expect(view.items.map((i) => i.questionId)).toEqual(['q1', 'q2', 'q3', 'q4'])
  })

  it('clamps out-of-range scores to [0, 10]', () => {
    const answers: ScorecardAnswer[] = [
      { question_id: 'q1', text_value: null, score_value: 20 }, // clamped to 10
      { question_id: 'q2', text_value: null, score_value: -3 }, // clamped to 0
    ]
    const view = projectScorecard({ overallScore: null, questions: [Q1, Q2], answers })
    const s1 = view.items[0]
    const s2 = view.items[1]
    if (!s1 || !s2 || s1.kind !== 'score' || s2.kind !== 'score') throw new Error('expected score items')
    expect(s1.score).toBe(10)
    expect(s1.percentage).toBe(100)
    expect(s2.score).toBe(0)
    expect(s2.percentage).toBe(0)
  })

  it('clamps overall score to [0, 100] and rounds', () => {
    expect(
      projectScorecard({ overallScore: 87.6, questions: [], answers: [] }).overallScore,
    ).toBe(88)
    expect(
      projectScorecard({ overallScore: 105, questions: [], answers: [] }).overallScore,
    ).toBe(100)
    expect(
      projectScorecard({ overallScore: -5, questions: [], answers: [] }).overallScore,
    ).toBe(0)
  })

  it('treats non-finite overall scores as null', () => {
    expect(projectScorecard({ overallScore: NaN, questions: [], answers: [] }).overallScore).toBeNull()
    expect(
      projectScorecard({ overallScore: Number.POSITIVE_INFINITY, questions: [], answers: [] })
        .overallScore,
    ).toBeNull()
  })

  it('drops non-finite score_value answers defensively', () => {
    // NaN typechecks as `number`, so this exercises the runtime
    // `Number.isFinite` guard in projectScorecard, not the type system.
    const answers: ScorecardAnswer[] = [
      { question_id: 'q1', text_value: null, score_value: NaN },
      { question_id: 'q2', text_value: null, score_value: 5 },
    ]
    const view = projectScorecard({ overallScore: null, questions: [Q1, Q2], answers })
    expect(view.items.map((i) => i.questionId)).toEqual(['q2'])
  })
})
