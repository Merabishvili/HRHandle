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

type TeamsMessage = {
  type: string
  attachments: { contentType: string; content: { type: string; version: string; body: Record<string, unknown>[]; actions?: { type: string; url: string }[] } }[]
}

describe('buildTeamsPayload', () => {
  it('wraps an Adaptive Card in a Teams message with the title first', () => {
    const p = buildTeamsPayload({ title: 'Hello', body: '' }) as TeamsMessage
    expect(p.type).toBe('message')
    expect(p.attachments[0]!.contentType).toBe('application/vnd.microsoft.card.adaptive')
    const card = p.attachments[0]!.content
    expect(card.type).toBe('AdaptiveCard')
    expect(card.body[0]).toMatchObject({ type: 'TextBlock', text: 'Hello', weight: 'Bolder' })
    expect(card.body).toHaveLength(1)
    expect(card.actions).toBeUndefined()
  })

  it('adds the body as a second text block', () => {
    const p = buildTeamsPayload({ title: 'T', body: 'b' }) as TeamsMessage
    expect(p.attachments[0]!.content.body[1]).toMatchObject({ type: 'TextBlock', text: 'b' })
  })

  it('adds facts when fields are provided', () => {
    const p = buildTeamsPayload({
      title: 'T',
      body: '',
      fields: [{ label: 'A', value: '1' }],
    }) as TeamsMessage
    expect(p.attachments[0]!.content.body[1]).toEqual({ type: 'FactSet', facts: [{ title: 'A', value: '1' }] })
  })

  it('adds an open-URL action when a URL is set', () => {
    const p = buildTeamsPayload({ title: 'T', body: '', url: 'https://example.com' }) as TeamsMessage
    expect(p.attachments[0]!.content.actions).toEqual([
      { type: 'Action.OpenUrl', title: 'Open in HRHandle', url: 'https://example.com' },
    ])
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

  it('accepts a Teams Workflows (Power Platform) webhook URL', () => {
    expect(
      isPlausibleWebhookUrl(
        'https://default0a1b2c.3d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/abc/triggers/manual/paths/invoke',
        'teams'
      )
    ).toBe(true)
  })

  it('rejects look-alike hosts for Teams', () => {
    expect(isPlausibleWebhookUrl('https://evil-powerplatform.com/x', 'teams')).toBe(false)
    expect(isPlausibleWebhookUrl('https://example.com/webhook.office.com', 'teams')).toBe(false)
  })

  it('rejects http (non-tls) URLs', () => {
    expect(isPlausibleWebhookUrl('http://hooks.slack.com/x', 'slack')).toBe(false)
  })

  it('rejects empty / garbage', () => {
    expect(isPlausibleWebhookUrl('', 'slack')).toBe(false)
    expect(isPlausibleWebhookUrl('not-a-url', 'slack')).toBe(false)
  })
})
