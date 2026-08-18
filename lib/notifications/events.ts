export const WEBHOOK_EVENTS = [
  'application_received',
  'application_hired',
  'application_rejected',
  'application_withdrawn',
  'offer_sent',
  'offer_accepted',
  'offer_declined',
  'interview_scheduled',
] as const

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  application_received: 'New application',
  application_hired: 'Candidate hired',
  application_rejected: 'Candidate rejected',
  application_withdrawn: 'Candidate withdrew',
  offer_sent: 'Offer sent',
  offer_accepted: 'Offer accepted',
  offer_declined: 'Offer declined',
  interview_scheduled: 'Interview scheduled',
}

export const DEFAULT_ENABLED_EVENTS: WebhookEvent[] = [
  'application_received',
  'application_hired',
  'offer_accepted',
]

export function isWebhookEvent(value: string): value is WebhookEvent {
  return (WEBHOOK_EVENTS as readonly string[]).includes(value)
}

export interface WebhookEventContext {
  /** Brief subject line — what happened, who/what it affects. */
  title: string
  /** One sentence of additional context. Empty string if there isn't more to say. */
  body: string
  /** Optional link back to HRHandle for the recipient to click through. */
  url?: string
  /** Optional structured fields shown as label/value rows. */
  fields?: { label: string; value: string }[] | undefined
}
