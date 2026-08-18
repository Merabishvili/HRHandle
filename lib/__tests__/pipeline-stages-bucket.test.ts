import { describe, it, expect } from 'vitest'

import { mapPipelineStageToBucket } from '@/lib/pipeline-stages/bucket'

describe('mapPipelineStageToBucket', () => {
  it('maps review → screening', () => {
    expect(
      mapPipelineStageToBucket({ type: 'review', name: 'Screening', is_terminal: false }),
    ).toBe('screening')
  })

  it('maps interview → interview regardless of name', () => {
    expect(
      mapPipelineStageToBucket({ type: 'interview', name: 'Phone screen', is_terminal: false }),
    ).toBe('interview')
    expect(
      mapPipelineStageToBucket({ type: 'interview', name: 'Final loop', is_terminal: false }),
    ).toBe('interview')
  })

  it('maps offer → offer', () => {
    expect(
      mapPipelineStageToBucket({ type: 'offer', name: 'Offer sent', is_terminal: false }),
    ).toBe('offer')
  })

  it('maps non-terminal standard → applied (default entry point)', () => {
    expect(
      mapPipelineStageToBucket({ type: 'standard', name: 'Applied', is_terminal: false }),
    ).toBe('applied')
    expect(
      mapPipelineStageToBucket({ type: 'standard', name: 'Sourced', is_terminal: false }),
    ).toBe('applied')
  })

  it('maps terminal standard "Hired" → hired', () => {
    expect(
      mapPipelineStageToBucket({ type: 'standard', name: 'Hired', is_terminal: true }),
    ).toBe('hired')
  })

  it('maps terminal standard "Rejected" → rejected', () => {
    expect(
      mapPipelineStageToBucket({ type: 'standard', name: 'Rejected', is_terminal: true }),
    ).toBe('rejected')
  })

  it('maps terminal standard "Withdrawn" → withdrawn', () => {
    expect(
      mapPipelineStageToBucket({ type: 'standard', name: 'Withdrawn', is_terminal: true }),
    ).toBe('withdrawn')
  })

  it('matches custom terminal names case-insensitively by keyword', () => {
    // "Re-hired" → hired bucket via the "hire" substring check
    expect(
      mapPipelineStageToBucket({ type: 'standard', name: 'Re-hired', is_terminal: true }),
    ).toBe('hired')
    expect(
      mapPipelineStageToBucket({ type: 'standard', name: 'Candidate Withdrew', is_terminal: true }),
    ).toBe('withdrawn')
    expect(
      mapPipelineStageToBucket({ type: 'standard', name: 'Closed - not a fit', is_terminal: true }),
    ).toBe('rejected')
  })

  it('defaults unknown terminal standard → rejected (rejection is the common custom case)', () => {
    expect(
      mapPipelineStageToBucket({ type: 'standard', name: 'Archived', is_terminal: true }),
    ).toBe('rejected')
  })
})
