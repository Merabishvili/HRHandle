'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'

export async function activateApplicationForm(
  vacancyId: string
): Promise<ActionResult<{ token: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  // Verify vacancy belongs to this org
  const { data: vacancy } = await ctx.supabase
    .from('vacancies')
    .select('id, application_form_token')
    .eq('id', vacancyId)
    .eq('organization_id', ctx.orgId)
    .single()

  if (!vacancy) return { success: false, error: 'Vacancy not found' }

  // If already active, return existing token
  if (vacancy.application_form_token) {
    return { success: true, data: { token: vacancy.application_form_token } }
  }

  const token = crypto.randomUUID()

  const { error } = await ctx.supabase
    .from('vacancies')
    .update({ application_form_token: token })
    .eq('id', vacancyId)

  if (error) return { success: false, error: 'Failed to activate form' }

  revalidatePath(`/vacancies/${vacancyId}`)
  return { success: true, data: { token } }
}

export async function deactivateApplicationForm(
  vacancyId: string
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data: vacancy } = await ctx.supabase
    .from('vacancies')
    .select('id')
    .eq('id', vacancyId)
    .eq('organization_id', ctx.orgId)
    .single()

  if (!vacancy) return { success: false, error: 'Vacancy not found' }

  const { error } = await ctx.supabase
    .from('vacancies')
    .update({ application_form_token: null })
    .eq('id', vacancyId)

  if (error) return { success: false, error: 'Failed to deactivate form' }

  revalidatePath(`/vacancies/${vacancyId}`)
  return { success: true, data: undefined }
}
