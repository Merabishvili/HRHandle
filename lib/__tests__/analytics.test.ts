import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// posthog-js is mocked with a mutable __loaded flag so we can exercise both the
// loaded and not-loaded branches. vi.hoisted keeps the mock object accessible
// from the hoisted vi.mock factory.
const { posthogMock, captureMock } = vi.hoisted(() => {
  const captureMock = vi.fn()
  return { captureMock, posthogMock: { __loaded: false, capture: captureMock } }
})

vi.mock('posthog-js', () => ({ default: posthogMock }))

import { capture } from '@/lib/analytics'

describe('capture', () => {
  beforeEach(() => {
    captureMock.mockClear()
    posthogMock.__loaded = false
    // Simulate a browser environment (the helper bails when window is undefined).
    vi.stubGlobal('window', {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('no-ops when PostHog has not initialized', () => {
    posthogMock.__loaded = false
    capture('vacancy_created')
    expect(captureMock).not.toHaveBeenCalled()
  })

  it('forwards the event name and properties when initialized', () => {
    posthogMock.__loaded = true
    capture('interview_scheduled', { count: 3 })
    expect(captureMock).toHaveBeenCalledWith('interview_scheduled', { count: 3 })
  })

  it('forwards events with no properties', () => {
    posthogMock.__loaded = true
    capture('application_submitted')
    expect(captureMock).toHaveBeenCalledWith('application_submitted', undefined)
  })

  it('no-ops on the server (no window)', () => {
    posthogMock.__loaded = true
    vi.unstubAllGlobals() // window now undefined
    capture('vacancy_created')
    expect(captureMock).not.toHaveBeenCalled()
  })
})
