'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import { isOrgAdmin } from '@/lib/permissions'
import {
  DEFAULT_TEMPLATES,
  resolveTemplate,
  isOptInTemplate,
  type TemplateType,
  type EmailTemplate,
} from '@/lib/email-template-utils'

export async function getEmailTemplates(): Promise<
  ActionResult<Record<TemplateType, EmailTemplate>>
> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data } = await ctx.supabase
    .from('email_templates')
    .select('template_type, subject, body, is_enabled')
    .eq('organization_id', ctx.orgId)

  const saved: Partial<Record<TemplateType, EmailTemplate>> = {}
  for (const row of data || []) {
    saved[row.template_type as TemplateType] = row as EmailTemplate
  }

  // For the always-on legacy template types, missing rows fall back to default
  // and is_enabled defaults to true. For opt-IN types (status_change_*),
  // missing rows return the default body but is_enabled defaults to false so
  // the UI shows the feature as off until the admin toggles it on.
  const resolveWithFlag = (type: TemplateType): EmailTemplate => {
    const row = saved[type]
    const base = resolveTemplate(row ?? null, type)
    const isEnabled =
      typeof row?.is_enabled === 'boolean' ? row.is_enabled : !isOptInTemplate(type)
    return { ...base, is_enabled: isEnabled }
  }

  const result: Record<TemplateType, EmailTemplate> = {
    application_received: resolveWithFlag('application_received'),
    interview_invitation: resolveWithFlag('interview_invitation'),
    rejection: resolveWithFlag('rejection'),
    status_change_screening: resolveWithFlag('status_change_screening'),
    status_change_interview: resolveWithFlag('status_change_interview'),
    offer_sent: resolveWithFlag('offer_sent'),
  }

  return { success: true, data: result }
}

// HTML safety (S-016): admin-supplied template body is stored verbatim and
// later interpolated into a transactional HTML email by `lib/email.ts`. We do
// not sanitize HTML here because (a) the editing surface is restricted to
// owner/admin roles, who already have privileged write access to the org's
// data; (b) any XSS risk is on the recipient's email-client side, where most
// modern clients strip <script>/<iframe>/event handlers; and (c) sanitizing
// would block legitimate formatting (links, bold, etc.). Reassess if a
// non-admin path to template editing is ever added.
export async function saveEmailTemplate(
  templateType: TemplateType,
  subject: string,
  body: string
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only admins can edit email templates.' }
  }

  const trimmedSubject = subject.trim()
  const trimmedBody = body.trim()

  if (!trimmedSubject) return { success: false, error: 'Subject is required.' }
  if (trimmedSubject.length > 500) return { success: false, error: 'Subject must be 500 characters or fewer.' }
  if (!trimmedBody) return { success: false, error: 'Message body is required.' }
  if (trimmedBody.length > 10000) return { success: false, error: 'Message body must be 10,000 characters or fewer.' }

  // Preserve existing is_enabled on update. For brand-new rows, default to
  // false for opt-in types (admins enable via the toggle separately) and true
  // for always-on legacy types so they keep firing as before.
  const { data: existing } = await ctx.supabase
    .from('email_templates')
    .select('is_enabled')
    .eq('organization_id', ctx.orgId)
    .eq('template_type', templateType)
    .maybeSingle()

  const isEnabled =
    existing?.is_enabled ?? (isOptInTemplate(templateType) ? false : true)

  const { error } = await ctx.supabase
    .from('email_templates')
    .upsert(
      {
        organization_id: ctx.orgId,
        template_type: templateType,
        subject: trimmedSubject,
        body: trimmedBody,
        is_enabled: isEnabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id,template_type' }
    )

  if (error) return { success: false, error: 'Failed to save email template. Please try again.' }

  revalidatePath('/settings/email-templates')
  return { success: true, data: undefined }
}

/** Toggle the is_enabled flag on a template row. For opt-in templates, this is
 * the gate the auto-email send logic checks. If no row exists yet, this
 * creates one with the default body so the toggle has somewhere to live. */
export async function setEmailTemplateEnabled(
  templateType: TemplateType,
  isEnabled: boolean
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only admins can edit email templates.' }
  }

  // Read the current row so we preserve any custom subject/body the admin
  // already saved. Falls back to the platform default if no row yet.
  const { data: existing } = await ctx.supabase
    .from('email_templates')
    .select('subject, body')
    .eq('organization_id', ctx.orgId)
    .eq('template_type', templateType)
    .maybeSingle()

  const fallback = DEFAULT_TEMPLATES[templateType]
  const subject = existing?.subject ?? fallback.subject
  const body = existing?.body ?? fallback.body

  const { error } = await ctx.supabase
    .from('email_templates')
    .upsert(
      {
        organization_id: ctx.orgId,
        template_type: templateType,
        subject,
        body,
        is_enabled: isEnabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id,template_type' }
    )

  if (error) return { success: false, error: 'Failed to update email template.' }

  revalidatePath('/settings/email-templates')
  return { success: true, data: undefined }
}

export async function resetEmailTemplate(
  templateType: TemplateType
): Promise<ActionResult<EmailTemplate>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (!isOrgAdmin(ctx.role)) {
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
