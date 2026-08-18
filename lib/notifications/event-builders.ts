import type { WebhookEventContext } from './events'

/** Build a base HRHandle URL for click-through links in webhook payloads. */
function appUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
  if (!base) return path
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export interface ApplicationContext {
  applicationId: string
  candidateId: string
  candidateName: string
  vacancyTitle: string | null
  source?: string | null
}

export function applicationReceivedCtx(input: ApplicationContext): WebhookEventContext {
  return {
    title: 'New application received',
    body: `${input.candidateName} applied${input.vacancyTitle ? ` for ${input.vacancyTitle}` : ''}.`,
    url: appUrl(`/candidates/${input.candidateId}`),
    fields: input.source ? [{ label: 'Source', value: input.source }] : undefined,
  }
}

export function applicationHiredCtx(input: ApplicationContext): WebhookEventContext {
  return {
    title: 'Candidate hired',
    body: `${input.candidateName}${input.vacancyTitle ? ` is now hired for ${input.vacancyTitle}` : ' was marked as hired'}.`,
    url: appUrl(`/candidates/${input.candidateId}`),
  }
}

export function applicationRejectedCtx(input: ApplicationContext): WebhookEventContext {
  return {
    title: 'Candidate rejected',
    body: `${input.candidateName}${input.vacancyTitle ? ` was rejected for ${input.vacancyTitle}` : ' was rejected'}.`,
    url: appUrl(`/candidates/${input.candidateId}`),
  }
}

export function applicationWithdrawnCtx(input: ApplicationContext): WebhookEventContext {
  return {
    title: 'Candidate withdrew',
    body: `${input.candidateName} withdrew${input.vacancyTitle ? ` from ${input.vacancyTitle}` : ''}.`,
    url: appUrl(`/candidates/${input.candidateId}`),
  }
}

export interface OfferContext {
  candidateId: string
  candidateName: string
  vacancyTitle: string | null
  roleTitle: string
}

export function offerSentCtx(input: OfferContext): WebhookEventContext {
  return {
    title: 'Offer sent',
    body: `${input.candidateName} was sent an offer for ${input.roleTitle}.`,
    url: appUrl(`/candidates/${input.candidateId}`),
  }
}

export function offerAcceptedCtx(input: OfferContext): WebhookEventContext {
  return {
    title: 'Offer accepted',
    body: `${input.candidateName} accepted the offer for ${input.roleTitle}.`,
    url: appUrl(`/candidates/${input.candidateId}`),
  }
}

export function offerDeclinedCtx(input: OfferContext): WebhookEventContext {
  return {
    title: 'Offer declined',
    body: `${input.candidateName} declined the offer for ${input.roleTitle}.`,
    url: appUrl(`/candidates/${input.candidateId}`),
  }
}

export interface InterviewContext {
  candidateId: string
  candidateName: string
  vacancyTitle: string | null
  scheduledAt: string // ISO
  duration?: number | null // minutes
  meetingUrl?: string | null
}

export function interviewScheduledCtx(input: InterviewContext): WebhookEventContext {
  const dt = new Date(input.scheduledAt)
  const when = Number.isNaN(dt.getTime())
    ? input.scheduledAt
    : dt.toUTCString()
  return {
    title: 'Interview scheduled',
    body: `${input.candidateName} scheduled an interview${input.vacancyTitle ? ` for ${input.vacancyTitle}` : ''}.`,
    url: appUrl(`/candidates/${input.candidateId}`),
    fields: [
      { label: 'When', value: when },
      ...(input.duration ? [{ label: 'Duration', value: `${input.duration} min` }] : []),
      ...(input.meetingUrl ? [{ label: 'Link', value: input.meetingUrl }] : []),
    ],
  }
}
