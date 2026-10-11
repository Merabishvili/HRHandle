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
 * Microsoft Teams message carrying an Adaptive Card. This is the format the
 * Teams Workflows template "Post to a channel when a webhook request is
 * received" expects (it replaces the retired Office 365 connectors), and the
 * classic Incoming Webhook connector accepts it too.
 */
export function buildTeamsPayload(ctx: WebhookEventContext): unknown {
  const body: Record<string, unknown>[] = [
    { type: 'TextBlock', text: ctx.title, weight: 'Bolder', size: 'Medium', wrap: true },
  ]
  if (ctx.body) body.push({ type: 'TextBlock', text: ctx.body, wrap: true })
  if (ctx.fields && ctx.fields.length > 0) {
    body.push({
      type: 'FactSet',
      facts: ctx.fields.map((f) => ({ title: f.label, value: f.value })),
    })
  }
  const card: Record<string, unknown> = {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.4',
    body,
  }
  if (ctx.url) {
    card.actions = [{ type: 'Action.OpenUrl', title: 'Open in HRHandle', url: ctx.url }]
  }
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: card,
      },
    ],
  }
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
  // a Microsoft-owned domain. We accept the common ones: Workflows URLs
  // (`*.environment.api.powerplatform.com`, older `*.logic.azure.com`) and
  // the classic connector hosts.
  const allowed = [
    'webhook.office.com',
    'outlook.office.com',
    'outlook.office365.com',
    'logic.azure.com',
    'api.powerplatform.com',
  ]
  return allowed.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))
}
