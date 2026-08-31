import { describe, it, expect } from 'vitest'
import {
  validateHeaders,
  buildValueMapper,
  detectDelimiter,
  stripBom,
  looksNonUtf8,
  normalizeHeader,
  TEMPLATE_HEADERS,
} from '@/lib/candidate-import/parsing'

const TEMPLATE = [...TEMPLATE_HEADERS] as string[]

describe('validateHeaders — hard gate', () => {
  it('accepts the exact template header row (case-insensitive + trimmed)', () => {
    const res = validateHeaders(TEMPLATE.map((h) => h.toUpperCase()).map((h) => ` ${h} `))
    expect(res.ok).toBe(true)
    expect(res.presentFields).toEqual(TEMPLATE)
  })

  it('rejects an unknown column and reports its original text', () => {
    const res = validateHeaders(['first_name', 'last_name', 'nickname'])
    expect(res.ok).toBe(false)
    expect(res.unknownHeader).toBe('nickname')
  })

  it('rejects when a required column is missing', () => {
    const res = validateHeaders(['first_name', 'email'])
    expect(res.ok).toBe(false)
    expect(res.missingRequiredHeader).toBe('last_name')
  })

  it('accepts when only an optional column is missing (email omitted)', () => {
    const res = validateHeaders(['first_name', 'last_name', 'phone'])
    expect(res.ok).toBe(true)
    expect(res.presentFields).toEqual(['first_name', 'last_name', 'phone'])
  })
})

describe('buildValueMapper', () => {
  it('maps cells by header position, trims, and nulls empty/absent columns', () => {
    const map = buildValueMapper(['first_name', 'last_name', 'email'])
    const out = map(['  Jane ', 'Doe', ''])
    expect(out.first_name).toBe('Jane')
    expect(out.last_name).toBe('Doe')
    expect(out.email).toBeNull()
    expect(out.phone).toBeNull() // column absent from the file
  })
})

describe('detectDelimiter', () => {
  it('detects comma by default', () => {
    expect(detectDelimiter('a,b,c')).toBe(',')
  })
  it('falls back to semicolon when it dominates', () => {
    expect(detectDelimiter('a;b;c')).toBe(';')
  })
  it('ignores delimiters inside quotes', () => {
    expect(detectDelimiter('"a,b,c";d')).toBe(';')
  })
})

describe('stripBom / looksNonUtf8', () => {
  it('strips a leading BOM', () => {
    expect(stripBom('﻿first_name')).toBe('first_name')
  })
  it('flags the UTF-8 replacement char as non-UTF-8', () => {
    expect(looksNonUtf8('na�me')).toBe(true)
    expect(looksNonUtf8('name')).toBe(false)
  })
})

describe('normalizeHeader', () => {
  it('lowercases and trims', () => {
    expect(normalizeHeader('  First_Name ')).toBe('first_name')
  })
})
