import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createAutosaver, DEFAULT_AUTOSAVE_DELAY_MS } from '@/lib/scorecards/autosave'

describe('createAutosaver', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('saves once after the debounce delay', () => {
    const save = vi.fn()
    const a = createAutosaver(save, 1500)
    a.schedule()
    expect(save).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1499)
    expect(save).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('coalesces rapid schedules into a single save (newest wins)', () => {
    const save = vi.fn()
    const a = createAutosaver(save, 1500)
    a.schedule()
    vi.advanceTimersByTime(1000)
    a.schedule() // resets the timer
    vi.advanceTimersByTime(1000)
    expect(save).not.toHaveBeenCalled() // 2000ms elapsed but timer reset at 1000
    vi.advanceTimersByTime(500)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('flush() saves immediately when a save is pending, then disarms', () => {
    const save = vi.fn()
    const a = createAutosaver(save)
    a.schedule()
    expect(a.isPending()).toBe(true)
    a.flush()
    expect(save).toHaveBeenCalledTimes(1)
    expect(a.isPending()).toBe(false)
    // A trailing timer must not fire a second save.
    vi.advanceTimersByTime(DEFAULT_AUTOSAVE_DELAY_MS)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('flush() is a no-op when nothing is pending', () => {
    const save = vi.fn()
    const a = createAutosaver(save)
    a.flush()
    expect(save).not.toHaveBeenCalled()
  })

  it('cancel() disarms without saving', () => {
    const save = vi.fn()
    const a = createAutosaver(save)
    a.schedule()
    a.cancel()
    vi.advanceTimersByTime(DEFAULT_AUTOSAVE_DELAY_MS)
    expect(save).not.toHaveBeenCalled()
    expect(a.isPending()).toBe(false)
  })
})
