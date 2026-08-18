import { describe, it, expect } from 'vitest'
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  RECOVERY_CODE_COUNT,
} from '@/lib/mfa/recovery-codes'

const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/

describe('generateRecoveryCodes', () => {
  it('generates RECOVERY_CODE_COUNT codes by default', () => {
    expect(generateRecoveryCodes()).toHaveLength(RECOVERY_CODE_COUNT)
  })
  it('honours a custom count', () => {
    expect(generateRecoveryCodes(5)).toHaveLength(5)
  })
  it('every code matches the XXXXX-XXXXX ambiguity-free format', () => {
    for (const code of generateRecoveryCodes()) {
      expect(code).toMatch(CODE_RE)
      expect(code).not.toMatch(/[01IO]/) // no look-alike chars
    }
  })
  it('codes within a set are unique', () => {
    const codes = generateRecoveryCodes()
    expect(new Set(codes).size).toBe(codes.length)
  })
})

describe('hashRecoveryCode', () => {
  it('is a 64-char lowercase hex (sha256)', () => {
    expect(hashRecoveryCode('ABCDE-FGHIJ')).toMatch(/^[0-9a-f]{64}$/)
  })
  it('is deterministic', () => {
    expect(hashRecoveryCode('ABCDE-FGHIJ')).toBe(hashRecoveryCode('ABCDE-FGHIJ'))
  })
  it('normalises formatting + case (dash / space / lowercase all match)', () => {
    const canonical = hashRecoveryCode('ABCDEFGHIJ')
    expect(hashRecoveryCode('abcde-fghij')).toBe(canonical)
    expect(hashRecoveryCode('ABCDE FGHIJ')).toBe(canonical)
    expect(hashRecoveryCode('a b c d e f g h i j')).toBe(canonical)
  })
  it('different codes hash differently', () => {
    expect(hashRecoveryCode('ABCDE-FGHIJ')).not.toBe(hashRecoveryCode('KLMNP-QRSTU'))
  })
})
