'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import {
  DEFAULT_TEMPLATES,
  resolveTemplate,
  type TemplateType,
  type EmailTemplate,
} from '@/lib/email-template-utils'

export type { TemplateType, EmailTemplate }
export { DEFAULT_TEMPLATES }

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
