'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'

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

export async function getEmailTemplates(): Promise<
  ActionResult<Record<TemplateType, EmailTemplate>>
> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data } = await ctx.supabase
    .from('email_templates')
    .select('template_type, subject, body')
    .eq('organization_id', ctx.orgId)

  const saved: Partial<Record<TemplateType, EmailTemplate>> = {}
  for (const row of data || []) {
    saved[row.template_type as TemplateType] = row as EmailTemplate
  }

  const result: Record<TemplateType, EmailTemplate> = {
    application_received: resolveTemplate(saved.application_received ?? null, 'application_received'),
    interview_invitation: resolveTemplate(saved.interview_invitation ?? null, 'interview_invitation'),
    rejection: resolveTemplate(saved.rejection ?? null, 'rejection'),
  }

  return { success: true, data: result }
}

export async function saveEmailTemplate(
  templateType: TemplateType,
  subject: string,
  body: string
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return { success: false, error: 'Only admins can edit email templates.' }
  }

  const trimmedSubject = subject.trim()
  const trimmedBody = body.trim()

  if (!trimmedSubject) return { success: false, error: 'Subject is required.' }
  if (!trimmedBody) return { success: false, error: 'Message body is required.' }

  const { error } = await ctx.supabase
    .from('email_templates')
    .upsert(
      {
        organization_id: ctx.orgId,
        template_type: templateType,
        subject: trimmedSubject,
        body: trimmedBody,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id,template_type' }
    )

  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/email-templates')
  return { success: true, data: undefined }
}

export async function resetEmailTemplate(
  templateType: TemplateType
): Promise<ActionResult<EmailTemplate>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return { success: false, error: 'Only admins can reset email templates.' }
  }

  await ctx.supabase
    .from('email_templates')
    .delete()
    .eq('organization_id', ctx.orgId)
    .eq('template_type', templateType)

  revalidatePath('/settings/email-templates')
  return { success: true, data: DEFAULT_TEMPLATES[templateType] }
}
