import { describe, it, expect } from 'vitest'
import {
  buildFitPrompt,
  parseFitResponse,
  FIT_PROMPT_VERSION,
  MEETS_THRESHOLD,
  type FitCriterionSpec,
} from '@/lib/ai/fit-analysis'
import type { SanitizedFitInput } from '@/lib/ai/cv-sanitizer'

const criteria: FitCriterionSpec[] = [
  { name: 'BA experience', must_have: true },
  { name: 'SQL / data literacy', must_have: true },
  { name: 'Communication', must_have: false },
]

const sanitized: SanitizedFitInput = {
  yearsOfExperience: 8,
  languages: ['English'],
  experience: [{ company: 'TBC', title: 'BA', start_date: '2018', end_date: null, is_current: true, description: 'process modelling' }],
  education: [],
  screeningAnswers: [{ label: 'Salary', answer: '$4.5k' }],
  cvExcerpt: null,
  redactedCategories: ['name'],
}

describe('buildFitPrompt', () => {
  const p = buildFitPrompt(sanitized, criteria)
  it('lists the role criteria with must-have flags', () => {
    expect(p).toContain('BA experience (must-have)')
    expect(p).toContain('Communication (nice-to-have)')
  })
  it('carries the advisory + anti-bias + no-overall-score rules', () => {
    expect(p).toMatch(/advisory only/i)
    expect(p).toMatch(/do NOT output any overall score/i)
    expect(p).toMatch(/protected characteristics/i)
    expect(p).toMatch(/never add your own criteria/i)
  })
  it('includes the sanitized data but no obvious protected fields', () => {
    expect(p).toContain('process modelling')
    expect(p).not.toMatch(/\bname\b:/i) // no "Name:" line like candidate-summary has
  })
})

describe('parseFitResponse', () => {
  const valid = JSON.stringify({
    criteria: [
      { name: 'BA experience', match_degree: 90, evidence: '8y at TBC', explanation: 'matches 5+' },
      { name: 'SQL / data literacy', match_degree: 20, evidence: 'not evidenced', explanation: 'no SQL' },
      { name: 'Communication', match_degree: 70, evidence: 'workshops', explanation: 'stakeholder work' },
    ],
    strengths: [{ text: '8y fintech BA', evidence: 'TBC' }],
    to_verify: [{ text: 'SQL not evidenced' }],
    suggested_questions: ['Walk me through a SQL-driven decision.'],
    confidence: 'medium',
  })

  it('computes meets_count / must_have_total from the scorecard (no overall score)', () => {
    const r = parseFitResponse(valid, criteria)!
    expect(r.must_have_total).toBe(2)
    expect(r.meets_count).toBe(1) // BA 90>=60 met; SQL 20<60 not met
    expect(r).not.toHaveProperty('overall_score')
    expect(r.confidence).toBe('medium')
  })

  it('parses a markdown-fenced JSON response', () => {
    expect(parseFitResponse('```json\n' + valid + '\n```', criteria)).not.toBeNull()
  })

  it('drops criteria the model invented (not in the scorecard)', () => {
    const withInvented = JSON.stringify({
      criteria: [
        { name: 'BA experience', match_degree: 80 },
        { name: 'Charisma', match_degree: 100 }, // invented
      ],
    })
    const r = parseFitResponse(withInvented, criteria)!
    expect(r.criteria.map((c) => c.name)).toEqual(['BA experience'])
  })

  it('clamps match_degree to 0..100', () => {
    const r = parseFitResponse(JSON.stringify({ criteria: [{ name: 'BA experience', match_degree: 150 }] }), criteria)!
    expect(r.criteria[0]?.match_degree).toBe(100)
  })

  it('returns null on malformed / non-JSON (caller degrades to "score manually")', () => {
    expect(parseFitResponse('not json at all', criteria)).toBeNull()
    expect(parseFitResponse('{ broken', criteria)).toBeNull()
    expect(parseFitResponse('', criteria)).toBeNull()
  })

  it('defaults confidence to low + tolerates missing arrays', () => {
    const r = parseFitResponse(JSON.stringify({ criteria: [] }), criteria)!
    expect(r.confidence).toBe('low')
    expect(r.strengths).toEqual([])
    expect(r.meets_count).toBe(0)
  })
})

describe('constants', () => {
  it('has a stable prompt version + a sane meets threshold', () => {
    expect(FIT_PROMPT_VERSION).toBeTruthy()
    expect(MEETS_THRESHOLD).toBeGreaterThan(0)
    expect(MEETS_THRESHOLD).toBeLessThanOrEqual(100)
  })
})
