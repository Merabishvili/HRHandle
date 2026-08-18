import { describe, it, expect } from 'vitest'
import {
  MIN_QUERY_LENGTH,
  MAX_RESULTS_PER_GROUP,
  normalizeQuery,
  escapeForIlike,
  toIlikePattern,
} from '@/lib/search/query'

describe('constants', () => {
  it('MIN_QUERY_LENGTH is at least 2 so single-letter searches do not fire', () => {
    expect(MIN_QUERY_LENGTH).toBeGreaterThanOrEqual(2)
  })
  it('MAX_RESULTS_PER_GROUP is small enough for a compact palette', () => {
    expect(MAX_RESULTS_PER_GROUP).toBeLessThanOrEqual(10)
  })
})

describe('normalizeQuery', () => {
  it('returns empty for nullish / undefined input', () => {
    expect(normalizeQuery(null)).toBe('')
    expect(normalizeQuery(undefined)).toBe('')
  })

  it('returns empty for whitespace-only input', () => {
    expect(normalizeQuery('')).toBe('')
    expect(normalizeQuery('   ')).toBe('')
    expect(normalizeQuery('\n\t')).toBe('')
  })

  it('returns empty for input shorter than MIN_QUERY_LENGTH after trim', () => {
    expect(normalizeQuery('a')).toBe('')
    expect(normalizeQuery('  b  ')).toBe('')
  })

  it('trims leading + trailing whitespace', () => {
    expect(normalizeQuery('  alex  ')).toBe('alex')
  })

  it('collapses internal whitespace runs to a single space', () => {
    expect(normalizeQuery('alex   merabishvili')).toBe('alex merabishvili')
    expect(normalizeQuery('alex\t\tmerabishvili')).toBe('alex merabishvili')
  })

  it('preserves Unicode characters (Cyrillic, accented Latin, etc)', () => {
    expect(normalizeQuery('Ольга Петрова')).toBe('Ольга Петрова')
    expect(normalizeQuery('  José  ')).toBe('José')
  })
})

describe('escapeForIlike', () => {
  it('escapes backslash, %, and _ for safe substring matching', () => {
    expect(escapeForIlike('hello')).toBe('hello')
    expect(escapeForIlike('50%')).toBe('50\\%')
    expect(escapeForIlike('snake_case')).toBe('snake\\_case')
    expect(escapeForIlike('back\\slash')).toBe('back\\\\slash')
  })

  it('handles a string with all three special characters at once', () => {
    expect(escapeForIlike('a\\b%c_d')).toBe('a\\\\b\\%c\\_d')
  })

  it('leaves text without specials untouched', () => {
    expect(escapeForIlike('Alex Merabishvili')).toBe('Alex Merabishvili')
    expect(escapeForIlike('alex@example.com')).toBe('alex@example.com')
  })
})

describe('toIlikePattern', () => {
  it('returns null for empty / short queries', () => {
    expect(toIlikePattern(null)).toBeNull()
    expect(toIlikePattern('')).toBeNull()
    expect(toIlikePattern(' ')).toBeNull()
    expect(toIlikePattern('a')).toBeNull()
  })

  it('wraps a valid query in % wildcards', () => {
    expect(toIlikePattern('alex')).toBe('%alex%')
    expect(toIlikePattern('  alex   merabishvili  ')).toBe('%alex merabishvili%')
  })

  it('escapes ilike specials inside the wildcards', () => {
    expect(toIlikePattern('50%')).toBe('%50\\%%')
    expect(toIlikePattern('back\\slash')).toBe('%back\\\\slash%')
  })
})
