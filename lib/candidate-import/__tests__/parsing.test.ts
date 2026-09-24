import { describe, it, expect } from 'vitest'
import {
  validateHeaders,
  buildValueMapper,
  detectDelimiter,
  decodeCsvBytes,
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

describe('decodeCsvBytes — encoding tolerance', () => {
  const u8 = (s: string) => new TextEncoder().encode(s)

  it('decodes plain UTF-8', () => {
    expect(decodeCsvBytes(u8('first_name,last_name'))).toBe('first_name,last_name')
  })

  it('strips a UTF-8 BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...u8('a,b')])
    expect(decodeCsvBytes(bytes)).toBe('a,b')
  })

  it('decodes UTF-16 LE with BOM (what Numbers/Excel often re-save)', () => {
    // BOM FF FE, then "a,b" as little-endian 16-bit code units.
    const bytes = new Uint8Array([0xff, 0xfe, 0x61, 0x00, 0x2c, 0x00, 0x62, 0x00])
    expect(decodeCsvBytes(bytes)).toBe('a,b')
  })

  it('decodes UTF-16 BE with BOM', () => {
    const bytes = new Uint8Array([0xfe, 0xff, 0x00, 0x61, 0x00, 0x2c, 0x00, 0x62])
    expect(decodeCsvBytes(bytes)).toBe('a,b')
  })

  it('detects BOM-less UTF-16 LE from interleaved NUL bytes', () => {
    const bytes = new Uint8Array([0x68, 0x00, 0x69, 0x00]) // "hi"
    expect(decodeCsvBytes(bytes)).toBe('hi')
  })
})
