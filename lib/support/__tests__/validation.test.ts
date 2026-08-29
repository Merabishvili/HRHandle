import { describe, it, expect } from 'vitest'

import { validateSupportInput, SUBJECT_MAX, MESSAGE_MAX } from '@/lib/support/validation'

describe('validateSupportInput', () => {
  const ok = { subject: 'Login issue', message: 'I cannot sign in to my account today.' }

  it('accepts a valid authed submission (no email required)', () => {
    expect(validateSupportInput(ok)).toBeNull()
  })

  it('rejects a too-short subject', () => {
    expect(validateSupportInput({ ...ok, subject: 'hi' })).toBe('subject_required')
    expect(validateSupportInput({ ...ok, subject: '   ' })).toBe('subject_required')
  })

  it('rejects an over-long subject', () => {
    expect(validateSupportInput({ ...ok, subject: 'a'.repeat(SUBJECT_MAX + 1) })).toBe('subject_too_long')
  })

  it('rejects a too-short message', () => {
    expect(validateSupportInput({ ...ok, message: 'too short' })).toBe('message_required')
  })

  it('rejects an over-long message', () => {
    expect(validateSupportInput({ ...ok, message: 'a'.repeat(MESSAGE_MAX + 1) })).toBe('message_too_long')
  })

  it('requires a valid email only when requireEmail is set (public form)', () => {
    expect(validateSupportInput({ ...ok, requireEmail: true, email: null })).toBe('email_required')
    expect(validateSupportInput({ ...ok, requireEmail: true, email: 'not-an-email' })).toBe('email_invalid')
    expect(validateSupportInput({ ...ok, requireEmail: true, email: 'user@example.com' })).toBeNull()
  })

  it('ignores email entirely when requireEmail is not set', () => {
    expect(validateSupportInput({ ...ok, email: 'garbage' })).toBeNull()
  })

  it('trims before measuring length', () => {
    // Trimmed subject "abc" (3) and message (>10) both clear the minimums.
    expect(validateSupportInput({ subject: '  abc  ', message: '  a valid ten+ char message  ' })).toBeNull()
    // Whitespace-padded but effectively 2-char subject still fails.
    expect(validateSupportInput({ subject: '  ok  ', message: '  a valid ten+ char message  ' })).toBe('subject_required')
  })
})
