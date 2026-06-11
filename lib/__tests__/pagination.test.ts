import { describe, it, expect } from 'vitest'
import {
  getPageWindow,
  parsePageSize,
  PAGE_GAP,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from '@/lib/pagination'

describe('getPageWindow', () => {
  describe('edge cases', () => {
    it('returns empty for zero or negative totalPages', () => {
      expect(getPageWindow(1, 0)).toEqual([])
      expect(getPageWindow(1, -3)).toEqual([])
    })

    it('returns [1] when there is exactly one page', () => {
      expect(getPageWindow(1, 1)).toEqual([1])
    })

    it('clamps currentPage above totalPages to totalPages', () => {
      expect(getPageWindow(99, 5)).toEqual([1, 2, 3, 4, 5])
    })

    it('clamps currentPage below 1 to 1', () => {
      expect(getPageWindow(0, 5)).toEqual([1, 2, 3, 4, 5])
      expect(getPageWindow(-3, 5)).toEqual([1, 2, 3, 4, 5])
    })
  })

  describe('small totals — render every page (siblings=1, threshold=7)', () => {
    it('totalPages=2 shows both', () => {
      expect(getPageWindow(1, 2)).toEqual([1, 2])
    })

    it('totalPages=5 shows all', () => {
      expect(getPageWindow(3, 5)).toEqual([1, 2, 3, 4, 5])
    })

    it('totalPages=7 still shows all (boundary case)', () => {
      expect(getPageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
    })

    it('totalPages=8 starts using the windowed view', () => {
      expect(getPageWindow(4, 8)).toEqual([1, PAGE_GAP, 3, 4, 5, PAGE_GAP, 8])
    })
  })

  describe('windowed view (siblings=1)', () => {
    it('current=1 of 10 shows leading window without leading gap', () => {
      expect(getPageWindow(1, 10)).toEqual([1, 2, PAGE_GAP, 10])
    })

    it('current=2 of 10 still no leading gap', () => {
      expect(getPageWindow(2, 10)).toEqual([1, 2, 3, PAGE_GAP, 10])
    })

    it('current=5 of 10 shows both gaps', () => {
      expect(getPageWindow(5, 10)).toEqual([1, PAGE_GAP, 4, 5, 6, PAGE_GAP, 10])
    })

    it('current=9 of 10 no trailing gap', () => {
      expect(getPageWindow(9, 10)).toEqual([1, PAGE_GAP, 8, 9, 10])
    })

    it('current=10 of 10 no trailing gap', () => {
      expect(getPageWindow(10, 10)).toEqual([1, PAGE_GAP, 9, 10])
    })
  })

  describe('siblings parameter', () => {
    it('siblings=0 keeps just the current page in the window', () => {
      expect(getPageWindow(5, 20, 0)).toEqual([1, PAGE_GAP, 5, PAGE_GAP, 20])
    })

    it('siblings=2 widens the window', () => {
      expect(getPageWindow(10, 20, 2)).toEqual([
        1,
        PAGE_GAP,
        8,
        9,
        10,
        11,
        12,
        PAGE_GAP,
        20,
      ])
    })

    it('negative siblings clamps to zero', () => {
      expect(getPageWindow(5, 20, -3)).toEqual([1, PAGE_GAP, 5, PAGE_GAP, 20])
    })
  })

  describe('contains first and last reliably', () => {
    it('always includes page 1 and totalPages', () => {
      for (const current of [1, 7, 50, 100]) {
        const window = getPageWindow(current, 100)
        expect(window[0]).toBe(1)
        expect(window[window.length - 1]).toBe(100)
      }
    })
  })
})

describe('parsePageSize', () => {
  it('returns default when input is missing or empty', () => {
    expect(parsePageSize(null)).toBe(DEFAULT_PAGE_SIZE)
    expect(parsePageSize(undefined)).toBe(DEFAULT_PAGE_SIZE)
    expect(parsePageSize('')).toBe(DEFAULT_PAGE_SIZE)
  })

  it('returns default for malformed numeric input', () => {
    expect(parsePageSize('abc')).toBe(DEFAULT_PAGE_SIZE)
    expect(parsePageSize('NaN')).toBe(DEFAULT_PAGE_SIZE)
    expect(parsePageSize(Infinity)).toBe(DEFAULT_PAGE_SIZE)
  })

  it('returns default for sizes outside the allow list (prevents abuse)', () => {
    expect(parsePageSize(15)).toBe(DEFAULT_PAGE_SIZE)
    expect(parsePageSize(200)).toBe(DEFAULT_PAGE_SIZE)
    expect(parsePageSize('1000')).toBe(DEFAULT_PAGE_SIZE)
    expect(parsePageSize(-50)).toBe(DEFAULT_PAGE_SIZE)
  })

  it('returns the parsed size when it is one of the allowed options', () => {
    for (const size of PAGE_SIZE_OPTIONS) {
      expect(parsePageSize(size)).toBe(size)
      expect(parsePageSize(String(size))).toBe(size)
    }
  })
})
