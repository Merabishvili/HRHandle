'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import { isOrgAdmin } from '@/lib/permissions'
import { defaultTemplate, isDefaultTemplateContentAnyLocale } from '@/lib/email-template-utils'
import { fetchOrgContentLocale } from '@/lib/i18n/org-locale'
export interface RejectionTemplate {
  id: string
  name: string
  subject: string
  body: string
  sort_order: number
  reason_id: string | null
}

const MAX_TEMPLATES = 20

export async function getRejectionTemplates(): Promise<ActionResult<RejectionTemplate[]>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const [{ data, error }, contentLocale] = await Promise.all([
    ctx.supabase
      .from('rejection_templates')
      .select('id, name, subject, body, sort_order, reason_id')
      .eq('organization_id', ctx.orgId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    fetchOrgContentLocale(ctx.supabase, ctx.orgId),
  ])

  if (error) return { success: false, error: 'Operation failed. Please try again.' }

  // Show an untouched default template (the onboarding-seeded "General", stored
  // as the built-in default in some locale) in the org's CURRENT content
  // language — matching what the rejection email actually sends (#8).
  const localized = (data as RejectionTemplate[]).map((tpl) => {
    if (isDefaultTemplateContentAnyLocale('rejection', tpl.subject, tpl.body)) {
      const d = defaultTemplate('rejection', contentLocale)
      return { ...tpl, subject: d.subject, body: d.body }
    }
    return tpl
  })

  return { success: true, data: localized }
}

export async function createRejectionTemplate(
  name: string,
  subject: string,
  body: string,
  reasonId: string | null
): Promise<ActionResult<RejectionTemplate>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only admins can manage rejection templates.' }
  }

  const trimName = name.trim()
  const trimSubject = subject.trim()
  const trimBody = body.trim()

  if (!trimName) return { success: false, error: 'Template name is required.' }
  if (trimName.length > 200) return { success: false, error: 'Template name must be 200 characters or fewer.' }
  if (!trimSubject) return { success: false, error: 'Subject is required.' }
  if (trimSubject.length > 500) return { success: false, error: 'Subject must be 500 characters or fewer.' }
  if (!trimBody) return { success: false, error: 'Message body is required.' }
  if (trimBody.length > 10000) return { success: false, error: 'Message body must be 10,000 characters or fewer.' }

  const { count } = await ctx.supabase
    .from('rejection_templates')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', ctx.orgId)

  if ((count ?? 0) >= MAX_TEMPLATES) {
    return { success: false, error: `Maximum ${MAX_TEMPLATES} rejection templates allowed.` }
  }

  // One template per reason: the reject dialog auto-fills the reason's template,
  // so two templates on the same reason would be ambiguous. (Unassigned /
  // reason-less templates may still coexist.)
  if (reasonId) {
    const { count: reasonCount } = await ctx.supabase
      .from('rejection_templates')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId)
      .eq('reason_id', reasonId)
    if ((reasonCount ?? 0) > 0) {
      // Machine code — the client localizes it (see rejection-templates-manager).
      return { success: false, error: 'reason_taken' }
    }
  }

  const { data, error } = await ctx.supabase
    .from('rejection_templates')
    .insert({
      organization_id: ctx.orgId,
      name: trimName,
      subject: trimSubject,
      body: trimBody,
      sort_order: count ?? 0,
      reason_id: reasonId ?? null,
    })
    .select('id, name, subject, body, sort_order, reason_id')
    .single()

  if (error) return { success: false, error: 'Operation failed. Please try again.' }

  revalidatePath('/settings/rejection-reasons')
  revalidatePath('/settings/email-templates')
  return { success: true, data: data as RejectionTemplate }
}

export async function updateRejectionTemplate(
  id: string,
  name: string,
  subject: string,
  body: string,
  reasonId: string | null
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only admins can manage rejection templates.' }
  }

  const trimName = name.trim()
  const trimSubject = subject.trim()
  const trimBody = body.trim()

  if (!trimName) return { success: false, error: 'Template name is required.' }
  if (trimName.length > 200) return { success: false, error: 'Template name must be 200 characters or fewer.' }
  if (!trimSubject) return { success: false, error: 'Subject is required.' }
  if (trimSubject.length > 500) return { success: false, error: 'Subject must be 500 characters or fewer.' }
  if (!trimBody) return { success: false, error: 'Message body is required.' }
  if (trimBody.length > 10000) return { success: false, error: 'Message body must be 10,000 characters or fewer.' }

  // One template per reason (see createRejectionTemplate) — block reassigning
  // this template to a reason another template already owns.
  if (reasonId) {
    const { data: clash } = await ctx.supabase
      .from('rejection_templates')
      .select('id')
      .eq('organization_id', ctx.orgId)
      .eq('reason_id', reasonId)
      .neq('id', id)
      .limit(1)
      .maybeSingle()
    if (clash) {
      // Machine code — localized client-side.
      return { success: false, error: 'reason_taken' }
    }
  }

  const { error } = await ctx.supabase
    .from('rejection_templates')
    .update({
      name: trimName,
      subject: trimSubject,
      body: trimBody,
      reason_id: reasonId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Operation failed. Please try again.' }

  revalidatePath('/settings/rejection-reasons')
  revalidatePath('/settings/email-templates')
  return { success: true, data: undefined }
}

export async function deleteRejectionTemplate(id: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only admins can manage rejection templates.' }
  }

  const { error } = await ctx.supabase
    .from('rejection_templates')
    .delete()
    .eq('id', id)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Operation failed. Please try again.' }

  revalidatePath('/settings/rejection-reasons')
  revalidatePath('/settings/email-templates')
  return { success: true, data: undefined }
}
