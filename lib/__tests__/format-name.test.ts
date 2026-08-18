import { describe, it, expect } from 'vitest'
import { toDisplayName, toDisplayFullName } from '@/lib/format-name'

describe('toDisplayName', () => {
  it('title-cases an ALL-CAPS ASCII name', () => {
    expect(toDisplayName('ALEKSANDRE')).toBe('Aleksandre')
    expect(toDisplayName('MERABISHVILI')).toBe('Merabishvili')
  })

  it('title-cases each token across spaces', () => {
    expect(toDisplayName('ALEKSANDRE MERABISHVILI')).toBe('Aleksandre Merabishvili')
  })

  it('preserves hyphen + spacing between tokens', () => {
    expect(toDisplayName('ANNA-MARIA')).toBe('Anna-Maria')
    expect(toDisplayName('VAN  DER  BERG')).toBe('Van  Der  Berg')
  })

  it('leaves an already mixed-case name untouched', () => {
    expect(toDisplayName('McDonald')).toBe('McDonald')
    expect(toDisplayName('de la Cruz')).toBe('de la Cruz')
  })

  it('leaves non-Latin (Georgian) script untouched', () => {
    expect(toDisplayName('ალექსანდრე')).toBe('ალექსანდრე')
    expect(toDisplayName('მერაბიშვილი')).toBe('მერაბიშვილი')
  })

  it('leaves accented all-caps alone rather than risk a wrong fold', () => {
    expect(toDisplayName('JOSÉ')).toBe('JOSÉ')
  })

  it('handles null / empty input', () => {
    expect(toDisplayName(null)).toBe('')
    expect(toDisplayName(undefined)).toBe('')
    expect(toDisplayName('')).toBe('')
  })
})

describe('toDisplayFullName', () => {
  it('joins and trims a first + last pair', () => {
    expect(toDisplayFullName('ALEKSANDRE', 'MERABISHVILI')).toBe('Aleksandre Merabishvili')
    expect(toDisplayFullName('ALEKSANDRE', null)).toBe('Aleksandre')
  })
})
