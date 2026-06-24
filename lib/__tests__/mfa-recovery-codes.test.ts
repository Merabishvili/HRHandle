import { describe, it, expect } from 'vitest'
import {
  RECOVERY_CODE_COUNT,
  generateRecoveryCodes,
  hashRecoveryCode,
} from '@/lib/mfa/recovery-codes'

describe('generateRecoveryCodes', () => {
  it('produces the requested number of codes by default', () => {
    const codes = generateRecoveryCodes()
    expect(codes.length).toBe(RECOVERY_CODE_COUNT)
  })

  it('produces the requested number when overridden', () => {
    expect(generateRecoveryCodes(3).length).toBe(3)
    expect(generateRecoveryCodes(15).length).toBe(15)
  })

  it('every code matches the XXXXX-XXXXX shape with the safe alphabet', () => {
    const codes = generateRecoveryCodes(20)
    for (const c of codes) {
      expect(c).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/)
    }
  })

  it('returns unique codes across the set', () => {
    const codes = generateRecoveryCodes(20)
    expect(new Set(codes).size).toBe(20)
  })

  it('codes do not contain ambiguity characters (0/1/I/O)', () => {
    const codes = generateRecoveryCodes(20)
    for (const c of codes) {
      expect(c).not.toMatch(/[01IO]/)
    }
  })
})

describe('hashRecoveryCode', () => {
  it('returns a 64-char hex sha256', () => {
    expect(hashRecoveryCode('ABCDE-FGHJK')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('normalizes case + dashes + spaces before hashing', () => {
    const a = hashRecoveryCode('ABCDE-FGHJK')
    const b = hashRecoveryCode('abcde-fghjk')
    const c = hashRecoveryCode('ABCDE FGHJK')
    const d = hashRecoveryCode('abcdefghjk')
    expect(a).toBe(b)
    expect(b).toBe(c)
    expect(c).toBe(d)
  })

  it('different codes hash to different digests', () => {
    expect(hashRecoveryCode('AAAAA-BBBBB')).not.toBe(hashRecoveryCode('CCCCC-DDDDD'))
  })
})
