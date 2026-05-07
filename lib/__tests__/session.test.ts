import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  setSessionPreference,
  clearSessionTracking,
  SESSION_REMEMBER_KEY,
  SESSION_LAST_ACTIVE_KEY,
} from '@/lib/session'

// ─── localStorage mock ────────────────────────────────────────────────────────

// vitest runs in 'node' environment, so we need to mock localStorage
const localStorageStore: Record<string, string> = {}

const localStorageMock = {
  getItem: (key: string) => localStorageStore[key] ?? null,
  setItem: (key: string, value: string) => { localStorageStore[key] = value },
  removeItem: (key: string) => { delete localStorageStore[key] },
  clear: () => { Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]) },
}

vi.stubGlobal('localStorage', localStorageMock)

beforeEach(() => {
  localStorageMock.clear()
})

// ─── Constants ────────────────────────────────────────────────────────────────

describe('session constants', () => {
  it('SESSION_REMEMBER_KEY is hrhandle_remember_me', () => {
    expect(SESSION_REMEMBER_KEY).toBe('hrhandle_remember_me')
  })

  it('SESSION_LAST_ACTIVE_KEY is hrhandle_last_active', () => {
    expect(SESSION_LAST_ACTIVE_KEY).toBe('hrhandle_last_active')
  })
})

// ─── setSessionPreference(true) ───────────────────────────────────────────────

describe('setSessionPreference(true) — remember me ON', () => {
  it('sets SESSION_REMEMBER_KEY to "true"', () => {
    setSessionPreference(true)
    expect(localStorage.getItem(SESSION_REMEMBER_KEY)).toBe('true')
  })

  it('removes SESSION_LAST_ACTIVE_KEY', () => {
    // Pre-set it to simulate a previous "don't remember me" session
    localStorage.setItem(SESSION_LAST_ACTIVE_KEY, '1234567890')
    setSessionPreference(true)
    expect(localStorage.getItem(SESSION_LAST_ACTIVE_KEY)).toBeNull()
  })

  it('does NOT set SESSION_LAST_ACTIVE_KEY', () => {
    setSessionPreference(true)
    expect(localStorage.getItem(SESSION_LAST_ACTIVE_KEY)).toBeNull()
  })

  it('can be called multiple times without error', () => {
    setSessionPreference(true)
    setSessionPreference(true)
    expect(localStorage.getItem(SESSION_REMEMBER_KEY)).toBe('true')
  })
})

// ─── setSessionPreference(false) ─────────────────────────────────────────────

describe('setSessionPreference(false) — remember me OFF', () => {
  it('sets SESSION_REMEMBER_KEY to "false"', () => {
    setSessionPreference(false)
    expect(localStorage.getItem(SESSION_REMEMBER_KEY)).toBe('false')
  })

  it('sets SESSION_LAST_ACTIVE_KEY to a numeric timestamp string', () => {
    const before = Date.now()
    setSessionPreference(false)
    const after = Date.now()

    const stored = localStorage.getItem(SESSION_LAST_ACTIVE_KEY)
    expect(stored).not.toBeNull()

    const ts = Number(stored)
    expect(Number.isInteger(ts)).toBe(true)
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it('overwrites an existing SESSION_LAST_ACTIVE_KEY value', () => {
    localStorage.setItem(SESSION_LAST_ACTIVE_KEY, '9999')
    setSessionPreference(false)
    const stored = Number(localStorage.getItem(SESSION_LAST_ACTIVE_KEY))
    // Must be a recent timestamp, not the old stale value
    expect(stored).toBeGreaterThan(9999)
  })

  it('can be called multiple times, updating the timestamp', () => {
    setSessionPreference(false)
    const first = Number(localStorage.getItem(SESSION_LAST_ACTIVE_KEY))

    setSessionPreference(false)
    const second = Number(localStorage.getItem(SESSION_LAST_ACTIVE_KEY))

    // Both should be valid timestamps; second >= first
    expect(second).toBeGreaterThanOrEqual(first)
    expect(localStorage.getItem(SESSION_REMEMBER_KEY)).toBe('false')
  })
})

// ─── Switching between preferences ───────────────────────────────────────────

describe('setSessionPreference — switching between true and false', () => {
  it('switching from false → true removes SESSION_LAST_ACTIVE_KEY', () => {
    setSessionPreference(false)
    expect(localStorage.getItem(SESSION_LAST_ACTIVE_KEY)).not.toBeNull()

    setSessionPreference(true)
    expect(localStorage.getItem(SESSION_LAST_ACTIVE_KEY)).toBeNull()
    expect(localStorage.getItem(SESSION_REMEMBER_KEY)).toBe('true')
  })

  it('switching from true → false sets SESSION_LAST_ACTIVE_KEY', () => {
    setSessionPreference(true)
    expect(localStorage.getItem(SESSION_LAST_ACTIVE_KEY)).toBeNull()

    setSessionPreference(false)
    expect(localStorage.getItem(SESSION_LAST_ACTIVE_KEY)).not.toBeNull()
    expect(localStorage.getItem(SESSION_REMEMBER_KEY)).toBe('false')
  })
})

// ─── clearSessionTracking ─────────────────────────────────────────────────────

describe('clearSessionTracking', () => {
  it('removes SESSION_LAST_ACTIVE_KEY', () => {
    localStorage.setItem(SESSION_LAST_ACTIVE_KEY, '1234567890')
    clearSessionTracking()
    expect(localStorage.getItem(SESSION_LAST_ACTIVE_KEY)).toBeNull()
  })

  it('does NOT remove SESSION_REMEMBER_KEY', () => {
    localStorage.setItem(SESSION_REMEMBER_KEY, 'true')
    localStorage.setItem(SESSION_LAST_ACTIVE_KEY, '1234567890')
    clearSessionTracking()
    expect(localStorage.getItem(SESSION_REMEMBER_KEY)).toBe('true')
  })

  it('is safe to call when SESSION_LAST_ACTIVE_KEY is not set', () => {
    expect(() => clearSessionTracking()).not.toThrow()
    expect(localStorage.getItem(SESSION_LAST_ACTIVE_KEY)).toBeNull()
  })

  it('is safe to call multiple times in a row', () => {
    clearSessionTracking()
    clearSessionTracking()
    expect(localStorage.getItem(SESSION_LAST_ACTIVE_KEY)).toBeNull()
  })
})
