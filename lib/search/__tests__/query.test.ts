import { describe, it, expect } from 'vitest'
import {
  normalizeQuery,
  escapeForIlike,
  toIlikePattern,
  MIN_QUERY_LENGTH,
} from '@/lib/search/query'

describe('normalizeQuery', () => {
  it('trims and collapses internal whitespace', () => {
    expect(normalizeQuery('  jane   doe ')).toBe('jane doe')
  })
  it('returns "" for queries below the minimum length', () => {
    expect(normalizeQuery('a')).toBe('')
    expect(normalizeQuery('   ')).toBe('')
    expect(MIN_QUERY_LENGTH).toBe(2)
  })
  it('returns "" for null/undefined', () => {
    expect(normalizeQuery(null)).toBe('')
    expect(normalizeQuery(undefined)).toBe('')
  })
})

describe('escapeForIlike', () => {
  it('escapes % and _ (ilike wildcards)', () => {
    expect(escapeForIlike('50%_off')).toBe('50\\%\\_off')
  })
  it('escapes backslashes first (no double-escaping)', () => {
    // input "a\b" (one backslash) → "a\\b" (two backslashes)
    expect(escapeForIlike('a\\b')).toBe('a\\\\b')
  })
  it('leaves ordinary text alone', () => {
    expect(escapeForIlike('jane doe')).toBe('jane doe')
  })
})

describe('toIlikePattern', () => {
  it('wraps a normalized query in wildcards', () => {
    expect(toIlikePattern('  jane ')).toBe('%jane%')
  })
  it('escapes wildcard chars inside the pattern', () => {
    expect(toIlikePattern('50%')).toBe('%50\\%%')
  })
  it('returns null for too-short / empty queries', () => {
    expect(toIlikePattern('a')).toBeNull()
    expect(toIlikePattern(null)).toBeNull()
  })
})
