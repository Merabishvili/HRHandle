import { describe, it, expect, vi } from 'vitest'

import {
  defaultStageNameForCode,
  resolvePipelineStageId,
  type LegacyStatusCode,
} from '@/lib/pipeline-stages/resolve'

describe('defaultStageNameForCode', () => {
  it.each<[LegacyStatusCode, string]>([
    ['applied', 'Applied'],
    ['screening', 'Screening'],
    ['interview', 'Interview'],
    ['offer', 'Offer'],
    ['hired', 'Hired'],
    ['rejected', 'Rejected'],
    ['withdrawn', 'Withdrawn'],
  ])('maps %s → %s', (code, expected) => {
    expect(defaultStageNameForCode(code)).toBe(expected)
  })
})

describe('resolvePipelineStageId', () => {
  function makeClient(returnedId: string | null) {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: returnedId === null ? null : { id: returnedId },
    })
    const chain = {
      ilike: vi.fn(() => ({ maybeSingle })),
      eq: vi.fn(() => chain),
      select: vi.fn(() => chain),
    }
    const from = vi.fn(() => chain)
    return { from, chain, maybeSingle }
  }

  it('returns the id from the vacancy + name lookup', async () => {
    const client = makeClient('stage-uuid-1')
    const id = await resolvePipelineStageId(client, 'vacancy-uuid', 'screening')
    expect(id).toBe('stage-uuid-1')
    expect(client.from).toHaveBeenCalledWith('pipeline_stages')
    expect(client.chain.eq).toHaveBeenCalledWith('vacancy_id', 'vacancy-uuid')
    expect(client.chain.ilike).toHaveBeenCalledWith('name', 'Screening')
  })

  it('returns null when no row matches (defensive)', async () => {
    const client = makeClient(null)
    const id = await resolvePipelineStageId(client, 'vacancy-uuid', 'applied')
    expect(id).toBeNull()
  })

  it('looks up the stage by the legacy code’s default name', async () => {
    const client = makeClient('stage-uuid-2')
    await resolvePipelineStageId(client, 'vacancy-uuid', 'withdrawn')
    expect(client.chain.ilike).toHaveBeenCalledWith('name', 'Withdrawn')
  })
})
