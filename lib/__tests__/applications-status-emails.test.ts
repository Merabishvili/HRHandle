import { describe, it, expect } from 'vitest'
import { shouldEmailForTransition } from '@/lib/applications-status-emails'

describe('shouldEmailForTransition', () => {
  describe('forward moves we email about', () => {
    it('applied → screening returns the screening template', () => {
      const result = shouldEmailForTransition('applied', 'screening', 1, 2)
      expect(result).toEqual({ stage: 'screening', type: 'status_change_screening' })
    })

    it('screening → interview returns the interview template', () => {
      const result = shouldEmailForTransition('screening', 'interview', 2, 3)
      expect(result).toEqual({ stage: 'interview', type: 'status_change_interview' })
    })

    it('applied → interview (skipping screening) still emails about interview', () => {
      const result = shouldEmailForTransition('applied', 'interview', 1, 3)
      expect(result).toEqual({ stage: 'interview', type: 'status_change_interview' })
    })
  })

  describe('forward moves we do NOT email about', () => {
    it('interview → offer returns null (offer is recruiter-driven)', () => {
      expect(shouldEmailForTransition('interview', 'offer', 3, 4)).toBeNull()
    })

    it('offer → hired returns null (hired is recruiter-driven)', () => {
      expect(shouldEmailForTransition('offer', 'hired', 4, 5)).toBeNull()
    })

    it('screening → rejected returns null (rejection has its own path)', () => {
      expect(shouldEmailForTransition('screening', 'rejected', 2, 6)).toBeNull()
    })

    it('screening → withdrawn returns null (candidate-initiated)', () => {
      expect(shouldEmailForTransition('screening', 'withdrawn', 2, 7)).toBeNull()
    })

    it('null → applied (new application) returns null', () => {
      expect(shouldEmailForTransition(null, 'applied', null, 1)).toBeNull()
    })
  })

  describe('backward / no-op moves are filtered out', () => {
    it('interview → screening returns null (backward correction)', () => {
      expect(shouldEmailForTransition('interview', 'screening', 3, 2)).toBeNull()
    })

    it('screening → screening returns null (no actual change)', () => {
      expect(shouldEmailForTransition('screening', 'screening', 2, 2)).toBeNull()
    })

    it('equal sort_order with different codes returns null (treat as no-op)', () => {
      // Defensive — if the schema is ever changed to share sort_order, don't email.
      expect(shouldEmailForTransition('screening', 'interview', 2, 2)).toBeNull()
    })
  })

  describe('missing data is handled defensively', () => {
    it('returns null when afterCode is missing', () => {
      expect(shouldEmailForTransition('applied', null, 1, 2)).toBeNull()
      expect(shouldEmailForTransition('applied', undefined, 1, 2)).toBeNull()
    })

    it('assumes forward when sort_order is unknown on both sides', () => {
      // Unknown ordering shouldn't silently drop legitimate transitions.
      const result = shouldEmailForTransition('applied', 'screening', null, null)
      expect(result).toEqual({ stage: 'screening', type: 'status_change_screening' })
    })

    it('assumes forward when only one side of sort_order is known', () => {
      const result = shouldEmailForTransition('applied', 'screening', null, 2)
      expect(result).toEqual({ stage: 'screening', type: 'status_change_screening' })
    })

    it('returns null for an unknown target code', () => {
      expect(shouldEmailForTransition('applied', 'mystery_code', 1, 2)).toBeNull()
    })
  })
})
