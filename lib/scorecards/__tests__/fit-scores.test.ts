import { describe, it, expect, vi, beforeEach } from 'vitest'

// A fake service-role client: records the query chain and answers it.
const { calls, answer } = vi.hoisted(() => ({
  calls: [] as { method: string; args: unknown[] }[],
  answer: { value: {} as Record<string, unknown> },
}))
vi.mock('@/lib/supabase/admin', () => {
  const chain: Record<string, unknown> = {}
  for (const method of ['from', 'select', 'eq', 'in', 'or']) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return chain
    }
  }
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(answer.value).then(resolve)
  return { createAdminClient: () => chain }
})

import { otherSubmittedAssessmentCount, submittedAssessmentScores } from '@/lib/scorecards/fit-scores'

const filters = () => calls.filter((c) => c.method !== 'select' && c.method !== 'from').map((c) => [c.method, ...c.args])

beforeEach(() => {
  calls.length = 0
})

describe('submittedAssessmentScores', () => {
  it("reads only submitted scores of the caller's organization", async () => {
    answer.value = { data: [{ application_id: 'a1', score: 80 }], error: null }
    expect(await submittedAssessmentScores('org-1', ['a1', 'a2'])).toEqual([{ application_id: 'a1', score: 80 }])
    expect(calls[0]).toEqual({ method: 'from', args: ['candidate_evaluations'] })
    expect(filters()).toEqual([
      ['eq', 'organization_id', 'org-1'],
      ['eq', 'submitted', true],
      ['in', 'application_id', ['a1', 'a2']],
    ])
  })

  it('skips the query without applications', async () => {
    expect(await submittedAssessmentScores('org-1', [])).toEqual([])
    expect(calls).toEqual([])
  })
})

describe('otherSubmittedAssessmentCount', () => {
  it("counts other people's submitted cards (legacy anonymous ones too) in the organization", async () => {
    answer.value = { count: 2, error: null }
    expect(await otherSubmittedAssessmentCount('org-1', 'a1', 'me')).toBe(2)
    expect(filters()).toEqual([
      ['eq', 'organization_id', 'org-1'],
      ['eq', 'application_id', 'a1'],
      ['eq', 'submitted', true],
      ['or', 'reviewer_id.is.null,reviewer_id.neq.me'],
    ])
  })
})
