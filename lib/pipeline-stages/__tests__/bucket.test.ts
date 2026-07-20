import { describe, it, expect } from 'vitest'
import { mapPipelineStageToBucket, type PipelineStageRowForBucket } from '@/lib/pipeline-stages/bucket'

const row = (over: Partial<PipelineStageRowForBucket>): PipelineStageRowForBucket => ({
  type: 'standard',
  name: 'Stage',
  is_terminal: false,
  ...over,
})

describe('mapPipelineStageToBucket — by type', () => {
  it('maps review → screening', () => {
    expect(mapPipelineStageToBucket(row({ type: 'review' }))).toBe('screening')
  })
  it('maps interview → interview', () => {
    expect(mapPipelineStageToBucket(row({ type: 'interview' }))).toBe('interview')
  })
  it('maps offer → offer', () => {
    expect(mapPipelineStageToBucket(row({ type: 'offer' }))).toBe('offer')
  })
})

describe('mapPipelineStageToBucket — standard non-terminal', () => {
  it('maps a non-terminal standard stage → applied', () => {
    expect(mapPipelineStageToBucket(row({ type: 'standard', is_terminal: false }))).toBe('applied')
  })
})

describe('mapPipelineStageToBucket — terminal standard by name', () => {
  it('a "Hired" stage → hired', () => {
    expect(mapPipelineStageToBucket(row({ is_terminal: true, name: 'Hired' }))).toBe('hired')
  })
  it('checks hire before rejection so "Re-hired" → hired (not rejected)', () => {
    expect(mapPipelineStageToBucket(row({ is_terminal: true, name: 'Re-hired' }))).toBe('hired')
  })
  it('a "Withdrawn" stage → withdrawn', () => {
    expect(mapPipelineStageToBucket(row({ is_terminal: true, name: 'Withdrawn' }))).toBe('withdrawn')
  })
  it('past-tense "Withdrew" → withdrawn (matches on withdr stem)', () => {
    expect(mapPipelineStageToBucket(row({ is_terminal: true, name: 'Candidate Withdrew' }))).toBe('withdrawn')
  })
  it('a custom terminal like "Closed - not a fit" defaults → rejected', () => {
    expect(mapPipelineStageToBucket(row({ is_terminal: true, name: 'Closed - not a fit' }))).toBe('rejected')
  })
  it('is case-insensitive on the name match', () => {
    expect(mapPipelineStageToBucket(row({ is_terminal: true, name: 'HIRED' }))).toBe('hired')
  })
})
