export type TemplateType = 'application_received' | 'interview_invitation' | 'rejection'

export interface EmailTemplate {
  template_type: TemplateType
  subject: string
  body: string
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
}

export function resolveTemplate(
  saved: EmailTemplate | null,
  type: TemplateType
): EmailTemplate {
  return saved ?? DEFAULT_TEMPLATES[type]
}

export function applyVariables(
  text: string,
  vars: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}
