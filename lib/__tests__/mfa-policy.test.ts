import { describe, it, expect } from 'vitest'
import { evaluatePolicy, needsChallenge } from '@/lib/mfa/policy'

describe('evaluatePolicy', () => {
  it('allows everyone through when no policy is set', () => {
    const p = evaluatePolicy({ require_mfa: false, require_mfa_for_admins: false }, 'member', false)
    expect(p.enrollmentRequired).toBe(false)
    expect(p.reason).toBe(null)
  })

  it('allows enrolled users through under every policy', () => {
    const p = evaluatePolicy({ require_mfa: true, require_mfa_for_admins: true }, 'owner', true)
    expect(p.enrollmentRequired).toBe(false)
  })

  it('blocks unenrolled member when org-wide policy is on', () => {
    const p = evaluatePolicy({ require_mfa: true, require_mfa_for_admins: false }, 'member', false)
    expect(p.enrollmentRequired).toBe(true)
    expect(p.reason).toBe('org_wide')
  })

  it('blocks unenrolled owner when admin-only policy is on', () => {
    const p = evaluatePolicy({ require_mfa: false, require_mfa_for_admins: true }, 'owner', false)
    expect(p.enrollmentRequired).toBe(true)
    expect(p.reason).toBe('admin_only')
  })

  it('blocks unenrolled admin when admin-only policy is on', () => {
    const p = evaluatePolicy({ require_mfa: false, require_mfa_for_admins: true }, 'admin', false)
    expect(p.enrollmentRequired).toBe(true)
    expect(p.reason).toBe('admin_only')
  })

  it('does not block member when only admin-only policy is on', () => {
    const p = evaluatePolicy({ require_mfa: false, require_mfa_for_admins: true }, 'member', false)
    expect(p.enrollmentRequired).toBe(false)
    expect(p.reason).toBe(null)
  })

  it('reports org_wide reason when both policies apply', () => {
    const p = evaluatePolicy({ require_mfa: true, require_mfa_for_admins: true }, 'owner', false)
    expect(p.enrollmentRequired).toBe(true)
    expect(p.reason).toBe('org_wide')
  })
})

describe('needsChallenge', () => {
  it('returns false for users with no factor', () => {
    expect(needsChallenge(false, 'aal1')).toBe(false)
    expect(needsChallenge(false, 'aal2')).toBe(false)
    expect(needsChallenge(false, null)).toBe(false)
  })

  it('returns true for enrolled users at aal1', () => {
    expect(needsChallenge(true, 'aal1')).toBe(true)
  })

  it('returns false for enrolled users at aal2', () => {
    expect(needsChallenge(true, 'aal2')).toBe(false)
  })

  it('returns true for enrolled users with unknown AAL (defensive)', () => {
    expect(needsChallenge(true, null)).toBe(true)
    expect(needsChallenge(true, undefined)).toBe(true)
  })
})
