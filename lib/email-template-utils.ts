import { DEFAULT_LOCALE, LOCALES, pickLocale, type Locale } from '@/lib/i18n/locales'
import emailsSource from '@/messages/emails.source.json'

export type TemplateType =
  | 'application_received'
  | 'interview_invitation'
  | 'rejection'
  | 'status_change_screening'
  | 'status_change_interview'
  | 'offer_sent'

/** Subset of TemplateType that's opt-IN per org. The send logic skips when no
 * row exists; admins enable by editing the template in /settings/email-templates. */
export const OPT_IN_TEMPLATE_TYPES = [
  'status_change_screening',
  'status_change_interview',
] as const satisfies ReadonlyArray<TemplateType>
export type OptInTemplateType = (typeof OPT_IN_TEMPLATE_TYPES)[number]

export function isOptInTemplate(t: TemplateType): t is OptInTemplateType {
  return (OPT_IN_TEMPLATE_TYPES as ReadonlyArray<TemplateType>).includes(t)
}

export interface EmailTemplate {
  template_type: TemplateType
  subject: string
  body: string
  /** Per-org enable flag. Pre-migration-034 rows are TRUE by default. For
   * opt-in template types (status_change_*), the absence of a row is treated
   * as disabled regardless of this field; the field only matters when a row
   * exists (and starts as true on first save). */
  is_enabled?: boolean
}

export const DEFAULT_TEMPLATES: Record<TemplateType, EmailTemplate> = {
  application_received: {
    template_type: 'application_received',
    subject: 'You applied for {{role}} at {{company}}',
    body: 'We have received your details and will review them shortly. We will be in touch if your profile matches our requirements. We appreciate your interest and the time you took to apply.',
  },
  interview_invitation: {
    template_type: 'interview_invitation',
    subject: 'Interview Invitation — {{role}} at {{company}}',
    body: 'You have been invited to an interview for the {{role}} position at {{company}}. Please find the details below.',
  },
  rejection: {
    template_type: 'rejection',
    subject: 'An update from {{company}} — {{role}}',
    body: 'After careful consideration, we have decided to move forward with other candidates whose experience more closely matches our current needs. We encourage you to apply for future opportunities that match your background.',
  },
  status_change_screening: {
    template_type: 'status_change_screening',
    subject: 'Your application is under review — {{role}} at {{company}}',
    body: 'Thanks again for applying for the {{role}} role at {{company}}. A recruiter has started reviewing your application. We will be in touch as soon as we have an update.',
  },
  status_change_interview: {
    template_type: 'status_change_interview',
    subject: 'Your application is moving to the interview stage — {{role}}',
    body: 'Good news — your application for the {{role}} role at {{company}} is now in the interview stage. The recruiter will contact you directly with the interview details.',
  },
  offer_sent: {
    template_type: 'offer_sent',
    subject: 'Your offer from {{company}} — {{role}}',
    body: '{{company}} is pleased to extend you an offer for the {{role}} role. The full details are available at the link below. You can accept or decline directly from that page.',
  },
}

// Localized default subject/body live in the reviewable `messages/emails.source.json`
// catalog (org-content-language, {{handlebars}} vars — deliberately kept out of the
// next-intl ICU catalog). Map each TemplateType to its `email.*` key prefix there.
const EMAIL_SOURCE = emailsSource as Record<string, Partial<Record<Locale, string>>>
const EMAIL_SOURCE_KEY: Record<TemplateType, string> = {
  application_received: 'applicationReceived',
  interview_invitation: 'interviewInvitation',
  rejection: 'rejection',
  status_change_screening: 'statusChangeScreening',
  status_change_interview: 'statusChangeInterview',
  offer_sent: 'offerSent',
}

/** The default template for a type in the given content locale, sourced from
 * `emails.source.json` (English base when a locale value is missing). */
export function defaultTemplate(
  type: TemplateType,
  locale: Locale = DEFAULT_LOCALE
): EmailTemplate {
  const base = DEFAULT_TEMPLATES[type]
  const k = EMAIL_SOURCE_KEY[type]
  const subject = pickLocale(EMAIL_SOURCE[`email.${k}.subject`], locale) || base.subject
  const body = pickLocale(EMAIL_SOURCE[`email.${k}.body`], locale) || base.body
  return { ...base, subject, body }
}

export function resolveTemplate(
  saved: EmailTemplate | null,
  type: TemplateType,
  locale: Locale = DEFAULT_LOCALE
): EmailTemplate {
  return saved ?? defaultTemplate(type, locale)
}

/** True when the given subject+body still match a built-in English default —
 * i.e. the org has never customized this template. Used to decide whether a
 * seeded/legacy row can be safely swapped for the localized default at send
 * time. */
export function isDefaultTemplateContent(
  type: TemplateType,
  subject: string,
  body: string
): boolean {
  const base = DEFAULT_TEMPLATES[type]
  return subject.trim() === base.subject && body.trim() === base.body
}

/** Like `isDefaultTemplateContent` but matches the built-in default in ANY
 * locale (en/ka/ru), not just English. Lets a seeded default template be
 * recognized — and re-localized to the org's CURRENT content language — even
 * after it was stored in a different locale's default text. */
export function isDefaultTemplateContentAnyLocale(
  type: TemplateType,
  subject: string,
  body: string
): boolean {
  const s = subject.trim()
  const b = body.trim()
  if (isDefaultTemplateContent(type, subject, body)) return true
  return LOCALES.some((locale) => {
    const d = defaultTemplate(type, locale)
    return s === d.subject.trim() && b === d.body.trim()
  })
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

export function applyVariables(
  text: string,
  vars: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => escapeHtml(vars[key] ?? ''))
}

export const DEFAULT_REJECTION_SUBJECT = DEFAULT_TEMPLATES.rejection.subject
export const DEFAULT_REJECTION_BODY = DEFAULT_TEMPLATES.rejection.body
