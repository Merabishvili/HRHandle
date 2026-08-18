import { describe, it, expect } from 'vitest'
import {
  WEBHOOK_EVENTS,
  WEBHOOK_EVENT_LABELS,
  DEFAULT_ENABLED_EVENTS,
  isWebhookEvent,
} from '@/lib/notifications/events'

describe('WEBHOOK_EVENTS', () => {
  it('contains exactly the canonical 8 events', () => {
    expect(WEBHOOK_EVENTS.length).toBe(8)
    expect(WEBHOOK_EVENTS).toContain('application_received')
    expect(WEBHOOK_EVENTS).toContain('interview_scheduled')
  })

  it('every event has a label', () => {
    for (const e of WEBHOOK_EVENTS) {
      expect(WEBHOOK_EVENT_LABELS[e]).toBeTruthy()
    }
  })
})

describe('DEFAULT_ENABLED_EVENTS', () => {
  it('is a subset of WEBHOOK_EVENTS', () => {
    for (const e of DEFAULT_ENABLED_EVENTS) {
      expect(WEBHOOK_EVENTS).toContain(e)
    }
  })
})

describe('isWebhookEvent', () => {
  it('accepts every declared event', () => {
    for (const e of WEBHOOK_EVENTS) expect(isWebhookEvent(e)).toBe(true)
  })
  it('rejects unknown strings', () => {
    expect(isWebhookEvent('bogus')).toBe(false)
    expect(isWebhookEvent('')).toBe(false)
  })
})
