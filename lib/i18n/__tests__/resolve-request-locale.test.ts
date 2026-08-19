import { describe, it, expect } from 'vitest'
import { resolveRequestLocale } from '@/lib/i18n/locales'

describe('resolveRequestLocale', () => {
  it('prefers an explicitly requested locale over the cookie', () => {
    // The public status/apply/offer pages request the org content locale; it
    // must win over the visitor's UI-language cookie.
    expect(resolveRequestLocale('ka', 'en')).toBe('ka')
    expect(resolveRequestLocale('ru', null)).toBe('ru')
  })

  it('falls back to the cookie when no locale is requested', () => {
    expect(resolveRequestLocale(undefined, 'ka')).toBe('ka')
    expect(resolveRequestLocale(null, 'ru')).toBe('ru')
  })

  it('falls back to English when neither is a valid locale', () => {
    expect(resolveRequestLocale(undefined, undefined)).toBe('en')
    expect(resolveRequestLocale('xx', 'zz')).toBe('en')
    expect(resolveRequestLocale('', '')).toBe('en')
  })

  it('ignores an invalid requested locale and uses the cookie', () => {
    expect(resolveRequestLocale('xx', 'ka')).toBe('ka')
  })
})
