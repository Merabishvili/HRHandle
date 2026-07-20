import { describe, it, expect } from 'vitest'
import {
  stageOf,
  getVacancyTitle,
  groupApplicationsByCandidate,
  aggregateFitScores,
  deriveStageAndFit,
  formatCustomFieldValue,
  buildCustomFieldValueMap,
  type ApplicationRow,
  type StageJoinRow,
  type EvaluationRow,
  type CustomFieldValueRow,
} from '@/lib/candidates/list-derivation'

// ─── Helpers to build rows ────────────────────────────────────────────────────

const applied: StageJoinRow = { name: 'Applied', type: 'standard', is_terminal: false }
const interview: StageJoinRow = { name: 'Interview', type: 'interview', is_terminal: false }
const hired: StageJoinRow = { name: 'Hired', type: 'standard', is_terminal: true }

function app(overrides: Partial<ApplicationRow> & Pick<ApplicationRow, 'id' | 'candidate_id'>): ApplicationRow {
  return {
    vacancy_id: 'v1',
    applied_at: '2026-01-01',
    pipeline_stage_id: 'ps1',
    vacancies: { id: 'v1', title: 'Engineer' },
    pipeline_stages: applied,
    ...overrides,
  }
}

// ─── stageOf ──────────────────────────────────────────────────────────────────

describe('stageOf', () => {
  it('returns the object when the join is a single object', () => {
    expect(stageOf(app({ id: 'a', candidate_id: 'c', pipeline_stages: interview }))).toBe(interview)
  })

  it('returns the first element when the join is an array', () => {
    expect(stageOf(app({ id: 'a', candidate_id: 'c', pipeline_stages: [interview, applied] }))).toBe(interview)
  })

  it('returns null for an empty array', () => {
    expect(stageOf(app({ id: 'a', candidate_id: 'c', pipeline_stages: [] }))).toBeNull()
  })

  it('returns null when the join is null', () => {
    expect(stageOf(app({ id: 'a', candidate_id: 'c', pipeline_stages: null }))).toBeNull()
  })
})

// ─── getVacancyTitle ──────────────────────────────────────────────────────────

describe('getVacancyTitle', () => {
  it('reads the title from an object join', () => {
    expect(getVacancyTitle(app({ id: 'a', candidate_id: 'c', vacancies: { id: 'v', title: 'PM' } }))).toBe('PM')
  })

  it('reads the title from the first element of an array join', () => {
    expect(getVacancyTitle(app({ id: 'a', candidate_id: 'c', vacancies: [{ id: 'v', title: 'PM' }] }))).toBe('PM')
  })

  it('returns null for a null join', () => {
    expect(getVacancyTitle(app({ id: 'a', candidate_id: 'c', vacancies: null }))).toBeNull()
  })

  it('returns null for an empty array join', () => {
    expect(getVacancyTitle(app({ id: 'a', candidate_id: 'c', vacancies: [] }))).toBeNull()
  })
})

// ─── groupApplicationsByCandidate ─────────────────────────────────────────────

describe('groupApplicationsByCandidate', () => {
  it('groups applications by candidate id', () => {
    const rows = [
      app({ id: 'a1', candidate_id: 'c1' }),
      app({ id: 'a2', candidate_id: 'c2' }),
      app({ id: 'a3', candidate_id: 'c1' }),
    ]
    const grouped = groupApplicationsByCandidate(rows)
    expect(grouped.get('c1')?.map((a) => a.id)).toEqual(['a1', 'a3'])
    expect(grouped.get('c2')?.map((a) => a.id)).toEqual(['a2'])
  })

  it('preserves input order within a candidate', () => {
    const rows = [
      app({ id: 'a3', candidate_id: 'c1' }),
      app({ id: 'a1', candidate_id: 'c1' }),
      app({ id: 'a2', candidate_id: 'c1' }),
    ]
    expect(groupApplicationsByCandidate(rows).get('c1')?.map((a) => a.id)).toEqual(['a3', 'a1', 'a2'])
  })

  it('returns an empty map for no applications', () => {
    expect(groupApplicationsByCandidate([]).size).toBe(0)
  })
})

// ─── aggregateFitScores ───────────────────────────────────────────────────────

describe('aggregateFitScores', () => {
  it('averages multiple submitted scores per application and rounds', () => {
    const rows: EvaluationRow[] = [
      { application_id: 'a1', score: 80 },
      { application_id: 'a1', score: 91 }, // avg 85.5 → 86
    ]
    expect(aggregateFitScores(rows).get('a1')).toBe(86)
  })

  it('returns a single score unchanged', () => {
    expect(aggregateFitScores([{ application_id: 'a1', score: 72 }]).get('a1')).toBe(72)
  })

  it('ignores rows with a null score', () => {
    const rows: EvaluationRow[] = [
      { application_id: 'a1', score: null },
      { application_id: 'a1', score: 60 },
    ]
    expect(aggregateFitScores(rows).get('a1')).toBe(60)
  })

  it('omits applications with only null scores', () => {
    expect(aggregateFitScores([{ application_id: 'a1', score: null }]).has('a1')).toBe(false)
  })

  it('returns an empty map for no rows', () => {
    expect(aggregateFitScores([]).size).toBe(0)
  })
})

// ─── deriveStageAndFit ────────────────────────────────────────────────────────

describe('deriveStageAndFit', () => {
  it('prefers the first non-terminal application for stage + fit', () => {
    const grouped = groupApplicationsByCandidate([
      app({ id: 'a1', candidate_id: 'c1', pipeline_stages: hired }),
      app({ id: 'a2', candidate_id: 'c1', pipeline_stages: interview }),
    ])
    const fitByApp = new Map([['a2', 88]])
    const { stageByCandidate, fitScoreByCandidate } = deriveStageAndFit(grouped, fitByApp)
    expect(stageByCandidate.get('c1')).toEqual({ code: 'interview', name: 'Interview' })
    expect(fitScoreByCandidate.get('c1')).toBe(88)
  })

  it('falls back to the first application when all are terminal', () => {
    const grouped = groupApplicationsByCandidate([
      app({ id: 'a1', candidate_id: 'c1', pipeline_stages: hired }),
    ])
    const { stageByCandidate } = deriveStageAndFit(grouped, new Map())
    expect(stageByCandidate.get('c1')).toEqual({ code: 'hired', name: 'Hired' })
  })

  it('omits fit when the active application has no score', () => {
    const grouped = groupApplicationsByCandidate([
      app({ id: 'a1', candidate_id: 'c1', pipeline_stages: interview }),
    ])
    const { fitScoreByCandidate } = deriveStageAndFit(grouped, new Map())
    expect(fitScoreByCandidate.has('c1')).toBe(false)
  })

  it('omits stage when the active application has no stage join', () => {
    const grouped = groupApplicationsByCandidate([
      app({ id: 'a1', candidate_id: 'c1', pipeline_stages: null }),
    ])
    const { stageByCandidate } = deriveStageAndFit(grouped, new Map())
    expect(stageByCandidate.has('c1')).toBe(false)
  })
})

// ─── formatCustomFieldValue ───────────────────────────────────────────────────

const emptyRow = {
  value_text: null,
  value_number: null,
  value_boolean: null,
  value_option: null,
}

describe('formatCustomFieldValue', () => {
  it('formats a number field', () => {
    expect(formatCustomFieldValue('number', { ...emptyRow, value_number: 5 })).toBe('5')
  })

  it('formats a checkbox field as Yes / No', () => {
    expect(formatCustomFieldValue('checkbox', { ...emptyRow, value_boolean: true })).toBe('Yes')
    expect(formatCustomFieldValue('checkbox', { ...emptyRow, value_boolean: false })).toBe('No')
  })

  it('returns null for an unset checkbox', () => {
    expect(formatCustomFieldValue('checkbox', emptyRow)).toBeNull()
  })

  it('formats a dropdown field from value_option', () => {
    expect(formatCustomFieldValue('dropdown', { ...emptyRow, value_option: 'Remote' })).toBe('Remote')
  })

  it('formats text / long_text / date from value_text', () => {
    expect(formatCustomFieldValue('text', { ...emptyRow, value_text: 'hello' })).toBe('hello')
    expect(formatCustomFieldValue('date', { ...emptyRow, value_text: '2026-01-01' })).toBe('2026-01-01')
  })

  it('returns null for an empty string value', () => {
    expect(formatCustomFieldValue('text', { ...emptyRow, value_text: '' })).toBeNull()
  })

  it('returns null when the numeric value is unset', () => {
    expect(formatCustomFieldValue('number', emptyRow)).toBeNull()
  })
})

// ─── buildCustomFieldValueMap ─────────────────────────────────────────────────

describe('buildCustomFieldValueMap', () => {
  it('keys display values by `${entityId}:${fieldId}` and skips empties', () => {
    const rows: CustomFieldValueRow[] = [
      { field_id: 'f1', entity_id: 'e1', value_text: 'A', value_number: null, value_boolean: null, value_option: null },
      { field_id: 'f2', entity_id: 'e1', value_text: null, value_number: 9, value_boolean: null, value_option: null },
      { field_id: 'f3', entity_id: 'e1', value_text: '', value_number: null, value_boolean: null, value_option: null },
    ]
    const types = new Map([
      ['f1', 'text' as const],
      ['f2', 'number' as const],
      ['f3', 'text' as const],
    ])
    const map = buildCustomFieldValueMap(rows, types)
    expect(map.get('e1:f1')).toBe('A')
    expect(map.get('e1:f2')).toBe('9')
    expect(map.has('e1:f3')).toBe(false)
  })
})
