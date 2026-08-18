import { describe, it, expect } from 'vitest'
import {
  PIPELINE_STAGE_TYPES,
  type OrgPipelineStageTemplate,
  type PipelineStageType,
} from '@/lib/pipeline-stage-templates/types'

// Pure-shape tests for A-5. The data mutation paths live inside
// Postgres (Migration 055's trigger + seed function) and are exercised
// through the live SQL — vitest just pins the public contract that the
// Settings UI relies on.

describe('PIPELINE_STAGE_TYPES', () => {
  it('exposes the four design-mandated types', () => {
    expect(PIPELINE_STAGE_TYPES).toEqual(['standard', 'interview', 'offer', 'review'])
  })

  it('every entry is assignable to PipelineStageType', () => {
    for (const t of PIPELINE_STAGE_TYPES) {
      const x: PipelineStageType = t
      expect(['standard', 'interview', 'offer', 'review']).toContain(x)
    }
  })
})

describe('OrgPipelineStageTemplate', () => {
  it('matches the row shape returned by listOrgPipelineStageTemplates', () => {
    const row: OrgPipelineStageTemplate = {
      id: 'uuid',
      name: 'Applied',
      type: 'standard',
      sort_order: 1,
      is_terminal: false,
    }
    expect(row.id).toBe('uuid')
    expect(row.type).toBe('standard')
    expect(row.is_terminal).toBe(false)
  })

  it('accepts all four types', () => {
    for (const t of PIPELINE_STAGE_TYPES) {
      const row: OrgPipelineStageTemplate = {
        id: 'x',
        name: 'X',
        type: t,
        sort_order: 1,
        is_terminal: false,
      }
      expect(row.type).toBe(t)
    }
  })
})
