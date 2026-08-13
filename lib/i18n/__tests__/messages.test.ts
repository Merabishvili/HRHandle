import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LOCALES, DEFAULT_LOCALE, isLocale, pickLocale, aiLanguageDirective, type Locale } from '@/lib/i18n/locales'

type SourceEntry = Partial<Record<Locale, string>>
const source = JSON.parse(
  readFileSync(join(process.cwd(), 'messages', 'source.json'), 'utf8'),
) as Record<string, SourceEntry>

describe('messages/source.json integrity', () => {
  const entries = Object.entries(source)

  it('is non-empty and uses flat dotted keys', () => {
    expect(entries.length).toBeGreaterThan(0)
    // Underscores are allowed inside a segment: many keys mirror a canonical DB
    // enum code (e.g. `vacStatus.on_hold`, `auditEntity.webhook_notification`,
    // `aiBias.cat.gender_coded`) so a dynamic `t.has(`prefix.${code}`)` lookup
    // resolves with the raw code verbatim.
    for (const [key] of entries) expect(key).toMatch(/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_]+)+$/)
  })

  it('every key has a non-empty value in every locale (en/ru/ka)', () => {
    const gaps: string[] = []
    for (const [key, entry] of entries) {
      for (const locale of LOCALES) {
        const v = entry[locale]
        if (typeof v !== 'string' || v.trim() === '') gaps.push(`${key}:${locale}`)
      }
    }
    expect(gaps, `missing/empty translations: ${gaps.join(', ')}`).toEqual([])
  })

  it('has no duplicate keys after parse (object keys are unique)', () => {
    // A duplicate key in the raw file would silently collapse; guard the count
    // against a re-parse of the raw text.
    const raw = readFileSync(join(process.cwd(), 'messages', 'source.json'), 'utf8')
    const rawKeyCount = (raw.match(/^\s{2}"[^"]+":\s*\{/gm) ?? []).length
    expect(Object.keys(source).length).toBe(rawKeyCount)
  })
})

// Candidate email templates — a separate catalog (org-content-language, {{ }}
// Handlebars vars, NOT next-intl). Validate completeness + that each locale
// carries the same {{var}} set as English (a dropped {{role}} would break the
// rendered email silently).
const emails = JSON.parse(
  readFileSync(join(process.cwd(), 'messages', 'emails.source.json'), 'utf8'),
) as Record<string, SourceEntry>

describe('messages/emails.source.json integrity', () => {
  const entries = Object.entries(emails).filter(([k]) => !k.startsWith('_'))
  const vars = (s: string) => (s.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((v) => v.replace(/\s/g, '')).sort()

  it('every email key has a non-empty value in every locale', () => {
    const gaps: string[] = []
    for (const [key, entry] of entries) {
      for (const locale of LOCALES) {
        const v = entry[locale]
        if (typeof v !== 'string' || v.trim() === '') gaps.push(`${key}:${locale}`)
      }
    }
    expect(gaps, `missing email translations: ${gaps.join(', ')}`).toEqual([])
  })

  it('ka + ru preserve the same {{handlebars}} vars as en', () => {
    const mismatches: string[] = []
    for (const [key, entry] of entries) {
      const enVars = JSON.stringify(vars(entry.en ?? ''))
      for (const locale of ['ka', 'ru'] as const) {
        if (JSON.stringify(vars(entry[locale] ?? '')) !== enVars) mismatches.push(`${key}:${locale}`)
      }
    }
    expect(mismatches, `{{var}} set drifted from en: ${mismatches.join(', ')}`).toEqual([])
  })
})

describe('locale helpers', () => {
  it('isLocale narrows correctly', () => {
    expect(isLocale('ka')).toBe(true)
    expect(isLocale('en')).toBe(true)
    expect(isLocale('xx')).toBe(false)
    expect(isLocale(null)).toBe(false)
  })

  it('pickLocale returns the requested locale when present', () => {
    expect(pickLocale({ en: 'Hi', ka: 'გამარჯობა', ru: 'Привет' }, 'ka')).toBe('გამარჯობა')
  })

  it('pickLocale falls back to the default locale, then any, then empty', () => {
    expect(pickLocale({ en: 'Hi' }, 'ka')).toBe('Hi') // default fallback
    expect(pickLocale({ ru: 'Привет' }, 'ka', 'en')).toBe('Привет') // first-available
    expect(pickLocale({}, 'ka')).toBe('')
    expect(pickLocale(null, 'ka')).toBe('')
    expect(pickLocale(undefined, 'en')).toBe('')
  })

  it('pickLocale passes through a legacy plain string (pre-i18n content)', () => {
    expect(pickLocale('Legacy JD text', 'ka')).toBe('Legacy JD text')
  })

  it('DEFAULT_LOCALE is a valid locale', () => {
    expect(isLocale(DEFAULT_LOCALE)).toBe(true)
  })
})

describe('aiLanguageDirective (Slice 5)', () => {
  it('is empty for English (the source language)', () => {
    expect(aiLanguageDirective('en')).toBe('')
  })
  it('names the target language + native label for non-English', () => {
    expect(aiLanguageDirective('ka')).toContain('Georgian')
    expect(aiLanguageDirective('ka')).toContain('ქართული')
    expect(aiLanguageDirective('ru')).toContain('Russian')
  })
  it('is JSON-safe: keeps keys + enum values in English (protects structured output)', () => {
    const d = aiLanguageDirective('ka')
    expect(d).toMatch(/JSON keys/i)
    expect(d).toMatch(/enumerated|category/i)
    expect(d).toMatch(/proper nouns/i)
  })
})
