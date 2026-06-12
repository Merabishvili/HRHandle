import { describe, it, expect } from 'vitest'
import {
  buildSlackPayload,
  buildTeamsPayload,
  isPlausibleWebhookUrl,
} from '@/lib/notifications/payload-builders'

describe('buildSlackPayload', () => {
  it('always sets text fallback and a section block for the title', () => {
    const p = buildSlackPayload({ title: 'Hello', body: '' }) as { text: string; blocks: unknown[] }
    expect(p.text).toBe('Hello')
    expect(Array.isArray(p.blocks)).toBe(true)
    expect(p.blocks.length).toBeGreaterThan(0)
  })

  it('includes body section when body is non-empty', () => {
    const p = buildSlackPayload({ title: 'T', body: 'Some body' }) as { blocks: unknown[] }
    expect(p.blocks.length).toBeGreaterThanOrEqual(2)
  })

  it('emits a fields block when fields are provided', () => {
    const p = buildSlackPayload({
      title: 'T',
      body: '',
      fields: [{ label: 'X', value: 'Y' }],
    }) as { blocks: { type: string }[] }
    expect(p.blocks.some((b) => b.type === 'section')).toBe(true)
  })

  it('emits an actions block when a URL is set', () => {
    const p = buildSlackPayload({ title: 'T', body: '', url: 'https://example.com' }) as {
      blocks: { type: string }[]
    }
    expect(p.blocks.some((b) => b.type === 'actions')).toBe(true)
  })
})

describe('buildTeamsPayload', () => {
  it('returns a MessageCard with title and summary set', () => {
    const p = buildTeamsPayload({ title: 'Hello', body: '' }) as Record<string, unknown>
    expect(p['@type']).toBe('MessageCard')
    expect(p.title).toBe('Hello')
    expect(p.summary).toBe('Hello')
  })

  it('sets `text` from body', () => {
    const p = buildTeamsPayload({ title: 'T', body: 'b' }) as Record<string, unknown>
    expect(p.text).toBe('b')
  })

  it('adds facts when fields are provided', () => {
    const p = buildTeamsPayload({
      title: 'T',
      body: '',
      fields: [{ label: 'A', value: '1' }],
    }) as { sections: { facts: { name: string; value: string }[] }[] }
    expect(p.sections[0].facts).toEqual([{ name: 'A', value: '1' }])
  })

  it('adds an OpenUri action when a URL is set', () => {
    const p = buildTeamsPayload({ title: 'T', body: '', url: 'https://example.com' }) as {
      potentialAction: { '@type': string }[]
    }
    expect(p.potentialAction[0]['@type']).toBe('OpenUri')
  })
})

describe('isPlausibleWebhookUrl', () => {
  it('accepts a real Slack hook host', () => {
    expect(isPlausibleWebhookUrl('https://hooks.slack.com/services/T/B/X', 'slack')).toBe(true)
  })

  it('rejects non-Slack hosts when channel=slack', () => {
    expect(isPlausibleWebhookUrl('https://example.com/x', 'slack')).toBe(false)
  })

  it('accepts a Teams Office webhook host', () => {
    expect(
      isPlausibleWebhookUrl('https://outlook.office.com/webhook/abc', 'teams')
    ).toBe(true)
  })

  it('accepts a Teams logic-apps webhook URL', () => {
    expect(
      isPlausibleWebhookUrl('https://prod-00.westus.logic.azure.com/workflows/abc', 'teams')
    ).toBe(true)
  })

  it('rejects http (non-tls) URLs', () => {
    expect(isPlausibleWebhookUrl('http://hooks.slack.com/x', 'slack')).toBe(false)
  })

  it('rejects empty / garbage', () => {
    expect(isPlausibleWebhookUrl('', 'slack')).toBe(false)
    expect(isPlausibleWebhookUrl('not-a-url', 'slack')).toBe(false)
  })
})
