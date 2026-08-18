import type { WebhookEventContext } from './events'

/**
 * Slack Block Kit message. Keep this minimal — every field is optional under
 * Slack's schema but we always set `text` (the fallback used for
 * notifications + accessibility) and a small `blocks` array.
 */
export function buildSlackPayload(ctx: WebhookEventContext): unknown {
  const blocks: unknown[] = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*${ctx.title}*` },
    },
  ]
  if (ctx.body) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: ctx.body },
    })
  }
  if (ctx.fields && ctx.fields.length > 0) {
    blocks.push({
      type: 'section',
      fields: ctx.fields.map((f) => ({
        type: 'mrkdwn',
        text: `*${f.label}*\n${f.value}`,
      })),
    })
  }
  if (ctx.url) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open in HRHandle' },
          url: ctx.url,
          style: 'primary',
        },
      ],
    })
  }
  return { text: ctx.title, blocks }
}

/**
 * Microsoft Teams MessageCard. Newer Adaptive Cards via Workflows would
 * also work but MessageCard is still accepted by Incoming Webhook
 * connectors and is much simpler to construct.
 */
export function buildTeamsPayload(ctx: WebhookEventContext): unknown {
  const card: Record<string, unknown> = {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    summary: ctx.title,
    themeColor: '0078D4',
    title: ctx.title,
  }
  if (ctx.body) card.text = ctx.body
  if (ctx.fields && ctx.fields.length > 0) {
    card.sections = [
      {
        facts: ctx.fields.map((f) => ({ name: f.label, value: f.value })),
      },
    ]
  }
  if (ctx.url) {
    card.potentialAction = [
      {
        '@type': 'OpenUri',
        name: 'Open in HRHandle',
        targets: [{ os: 'default', uri: ctx.url }],
      },
    ]
  }
  return card
}

/** Validate that a string looks like a plausible Slack or Teams webhook URL. */
export function isPlausibleWebhookUrl(value: string, channel: 'slack' | 'teams'): boolean {
  if (typeof value !== 'string') return false
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  if (channel === 'slack') {
    return url.hostname === 'hooks.slack.com'
  }
  // Microsoft Teams hostname varies by tenant region but always ends in
  // a Microsoft-owned domain. We accept the common ones.
  const allowed = [
    'webhook.office.com',
    'outlook.office.com',
    'outlook.office365.com',
    'prod-00.westus.logic.azure.com',
  ]
  return allowed.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`)) ||
    url.hostname.endsWith('.webhook.office.com') ||
    url.hostname.endsWith('.logic.azure.com')
}
