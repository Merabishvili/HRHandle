import { describe, it, expect } from 'vitest'
import {
  encodeParams,
  decodeParams,
  paramsAreEqual,
  buildHrefForView,
  normalizeViewName,
} from '@/lib/saved-views/filter-encoding'

describe('encodeParams', () => {
  it('returns {} for an empty bag', () => {
    expect(encodeParams('candidates', {})).toEqual({})
  })

  it('keeps only allowed filter keys', () => {
    expect(
      encodeParams('candidates', {
        search: 'alex',
        page: '3',        // dropped — pagination
        pageSize: '50',   // dropped — pagination
        unknown: 'x',     // dropped — not in allow-list
      }),
    ).toEqual({ search: 'alex' })
  })

  it('trims values and drops empty / whitespace-only ones', () => {
    expect(
      encodeParams('candidates', {
        search: '  alex   ',
        status: '   ',
        vacancy: '',
        sort: undefined,
      }),
    ).toEqual({ search: 'alex' })
  })

  it('drops the default sort for the kind', () => {
    expect(encodeParams('candidates', { sort: 'created_desc' })).toEqual({})
    expect(encodeParams('candidates', { sort: 'created_asc' })).toEqual({ sort: 'created_asc' })
    expect(encodeParams('vacancies', { sort: 'created_desc' })).toEqual({})
  })

  it('uses kind-specific filter keys (candidates has vacancy; vacancies does not)', () => {
    expect(encodeParams('candidates', { vacancy: 'v1' })).toEqual({ vacancy: 'v1' })
    expect(encodeParams('vacancies', { vacancy: 'v1' })).toEqual({})
  })

  it('canonical ordering: equivalent inputs encode to the same shape', () => {
    const a = encodeParams('candidates', { search: 'alex', status: 'st1' })
    const b = encodeParams('candidates', { status: 'st1', search: 'alex' })
    expect(Object.keys(a)).toEqual(Object.keys(b))
    expect(a).toEqual(b)
  })

  it('null and undefined raw values are skipped, not coerced to "null"', () => {
    expect(encodeParams('candidates', { search: null, status: undefined })).toEqual({})
  })
})

describe('decodeParams', () => {
  it('returns empty URLSearchParams for nullish / non-object input', () => {
    // @ts-expect-error — deliberately bad input
    expect(decodeParams('candidates', null).toString()).toBe('')
    // @ts-expect-error — deliberately bad input
    expect(decodeParams('candidates', 'string').toString()).toBe('')
    expect(decodeParams('candidates', {}).toString()).toBe('')
  })

  it('rebuilds the URL params from a stored encoded shape', () => {
    const out = decodeParams('candidates', { search: 'alex', status: 'st1' })
    expect(out.get('search')).toBe('alex')
    expect(out.get('status')).toBe('st1')
  })

  it('ignores keys outside the kind allow-list', () => {
    const out = decodeParams('vacancies', { vacancy: 'v1', search: 'be' })
    expect(out.get('vacancy')).toBeNull() // vacancies kind doesn't carry `vacancy`
    expect(out.get('search')).toBe('be')
  })

  it('ignores stored non-string + empty values defensively', () => {
    const out = decodeParams('candidates', { search: 42 as unknown as string, status: '' })
    expect(out.toString()).toBe('')
  })
})

describe('paramsAreEqual', () => {
  it('true for two identical empty maps', () => {
    expect(paramsAreEqual({}, {})).toBe(true)
  })

  it('true regardless of insertion order', () => {
    expect(paramsAreEqual({ a: '1', b: '2' }, { b: '2', a: '1' })).toBe(true)
  })

  it('false when one has a key the other does not', () => {
    expect(paramsAreEqual({ a: '1' }, {})).toBe(false)
  })

  it('false on value diff', () => {
    expect(paramsAreEqual({ a: '1' }, { a: '2' })).toBe(false)
  })
})

describe('buildHrefForView', () => {
  it('returns the base path when params is empty', () => {
    expect(buildHrefForView('candidates', {})).toBe('/candidates')
    expect(buildHrefForView('vacancies', {})).toBe('/vacancies')
  })

  it('appends only the allow-listed params', () => {
    expect(
      buildHrefForView('candidates', { search: 'alex', vacancy: 'v1' }),
    ).toMatch(/^\/candidates\?/)
    expect(
      buildHrefForView('candidates', { search: 'alex', vacancy: 'v1' }),
    ).toContain('search=alex')
    expect(
      buildHrefForView('candidates', { search: 'alex', vacancy: 'v1' }),
    ).toContain('vacancy=v1')
  })

  it('vacancies kind drops the candidate-only `vacancy` key', () => {
    // Even if a stored shape somehow has `vacancy`, the URL for vacancies should not carry it.
    const stored = { search: 'be', vacancy: 'v1' }
    expect(buildHrefForView('vacancies', stored)).toBe('/vacancies?search=be')
  })
})

describe('normalizeViewName', () => {
  it('returns null for nullish / whitespace-only input', () => {
    expect(normalizeViewName(null)).toBeNull()
    expect(normalizeViewName(undefined)).toBeNull()
    expect(normalizeViewName('')).toBeNull()
    expect(normalizeViewName('   ')).toBeNull()
  })

  it('returns null for names longer than 60 characters', () => {
    expect(normalizeViewName('a'.repeat(61))).toBeNull()
    expect(normalizeViewName('a'.repeat(60))).toBe('a'.repeat(60))
  })

  it('trims valid names', () => {
    expect(normalizeViewName('  Senior Engineers  ')).toBe('Senior Engineers')
  })
})
