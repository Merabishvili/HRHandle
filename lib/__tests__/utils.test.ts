import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('merges plain class strings', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, '', 'b')).toBe('a b')
  })

  it('flattens arrays', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c')
  })

  it('honours conditional objects', () => {
    expect(cn('a', { b: true, c: false })).toBe('a b')
  })

  it('lets later Tailwind utilities override earlier ones (twMerge)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('keeps non-conflicting Tailwind utilities side-by-side', () => {
    const result = cn('p-2', 'm-4')
    expect(result).toContain('p-2')
    expect(result).toContain('m-4')
  })

  it('returns empty string when no inputs', () => {
    expect(cn()).toBe('')
  })
})
