import { describe, it, expect } from 'vitest'
import { evaluatePolicy, needsChallenge } from '@/lib/mfa/policy'

const noPolicy = { require_mfa: false, require_mfa_for_admins: false }

describe('evaluatePolicy', () => {
  it('never requires enrollment once the user has a factor', () => {
    expect(evaluatePolicy({ require_mfa: true, require_mfa_for_admins: true }, 'member', true))
      .toEqual({ enrollmentRequired: false, reason: null })
  })

  it('org-wide policy forces every role to enroll', () => {
    const p = { require_mfa: true, require_mfa_for_admins: false }
    for (const role of ['owner', 'admin', 'member'] as const) {
      expect(evaluatePolicy(p, role, false)).toEqual({ enrollmentRequired: true, reason: 'org_wide' })
    }
  })

  it('admin-only policy forces owner+admin but not member', () => {
    const p = { require_mfa: false, require_mfa_for_admins: true }
    expect(evaluatePolicy(p, 'owner', false)).toEqual({ enrollmentRequired: true, reason: 'admin_only' })
    expect(evaluatePolicy(p, 'admin', false)).toEqual({ enrollmentRequired: true, reason: 'admin_only' })
    expect(evaluatePolicy(p, 'member', false)).toEqual({ enrollmentRequired: false, reason: null })
  })

  it('org_wide wins the reason when both flags are set', () => {
    const p = { require_mfa: true, require_mfa_for_admins: true }
    expect(evaluatePolicy(p, 'admin', false).reason).toBe('org_wide')
  })

  it('no policy → no enrollment required', () => {
    expect(evaluatePolicy(noPolicy, 'owner', false)).toEqual({ enrollmentRequired: false, reason: null })
  })
})

describe('needsChallenge', () => {
  it('is false without an enrolled factor', () => {
    expect(needsChallenge(false, 'aal1')).toBe(false)
    expect(needsChallenge(false, null)).toBe(false)
  })
  it('is true with a factor but a session still at aal1 (password-only)', () => {
    expect(needsChallenge(true, 'aal1')).toBe(true)
    expect(needsChallenge(true, null)).toBe(true)
    expect(needsChallenge(true, undefined)).toBe(true)
  })
  it('is false once the session has reached aal2', () => {
    expect(needsChallenge(true, 'aal2')).toBe(false)
  })
})
