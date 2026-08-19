import { describe, it, expect } from 'vitest'
import { transliterate } from '@/lib/i18n/transliterate'

describe('transliterate', () => {
  it('romanizes Georgian (Mkhedruli) to Latin', () => {
    expect(transliterate('კომპანია')).toBe('kompania')
    expect(transliterate('ჰრ ჰენდლი')).toBe('hr hendli')
    expect(transliterate('საქართველო')).toBe('sakartvelo')
  })

  it('romanizes Russian/Cyrillic to Latin', () => {
    expect(transliterate('компания')).toBe('kompaniya')
    expect(transliterate('Москва')).toBe('Moskva')
  })

  it('capitalizes the romanization of an uppercase Cyrillic letter', () => {
    // Ж → "Zh" (multi-char romanization keeps only the first letter capitalized)
    expect(transliterate('Жук')).toBe('Zhuk')
  })

  it('passes Latin, digits, spaces, and punctuation through unchanged', () => {
    expect(transliterate('Acme Inc. 2026')).toBe('Acme Inc. 2026')
  })

  it('handles mixed scripts', () => {
    expect(transliterate('HR კომპანია')).toBe('HR kompania')
  })

  it('returns an empty string unchanged', () => {
    expect(transliterate('')).toBe('')
  })
})
