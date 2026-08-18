import { describe, it, expect } from 'vitest'
import { buildCandidateDeleteAuditDetails } from '@/lib/candidate-delete-cascade'

describe('buildCandidateDeleteAuditDetails', () => {
  it('reports zero applications when the candidate had none', () => {
    const result = buildCandidateDeleteAuditDetails([])
    expect(result).toEqual({
      cascaded_applications: 0,
      application_ids: [],
    })
  })

  it('passes a single application id through unchanged', () => {
    const result = buildCandidateDeleteAuditDetails(['a1'])
    expect(result).toEqual({
      cascaded_applications: 1,
      application_ids: ['a1'],
    })
  })

  it('preserves order and count for many ids', () => {
    const ids = ['a1', 'a2', 'a3', 'a4']
    const result = buildCandidateDeleteAuditDetails(ids)
    expect(result.cascaded_applications).toBe(4)
    expect(result.application_ids).toEqual(ids)
  })

  it('filters out null and empty string ids defensively', () => {
    const result = buildCandidateDeleteAuditDetails([
      'a1',
      '',
      // @ts-expect-error — deliberately bad input to match the runtime guard
      null,
      'a2',
      // @ts-expect-error — same
      undefined,
    ])
    expect(result).toEqual({
      cascaded_applications: 2,
      application_ids: ['a1', 'a2'],
    })
  })

  it('does not mutate the caller array', () => {
    const ids = ['a1', 'a2']
    buildCandidateDeleteAuditDetails(ids)
    expect(ids).toEqual(['a1', 'a2'])
  })
})
