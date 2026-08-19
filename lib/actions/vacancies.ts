'use server'

import { revalidatePath } from 'next/cache'
import { differenceInCalendarDays } from 'date-fns'
import { getAuthContext, checkPlanLimit, type ActionResult } from './index'
import { VacancySchema, type VacancyInput } from '@/lib/validations/vacancy'
import { writeAuditLog } from '@/lib/audit-log'

export async function createVacancy(input: VacancyInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const limitError = await checkPlanLimit(ctx, 'vacancy')
  if (limitError) return { success: false, error: limitError }

  const parsed = VacancySchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Validation failed" }

  const tokenForInsert = parsed.data.show_on_public_page
    ? Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
    : undefined

  // hiring_manager_id (FK → profiles) is only written when a manager is
  // actually selected, so a vacancy created before the 20260820 migration is
  // applied still succeeds (an unknown column would otherwise reject the insert).
  const { hiring_manager_id: hmId, ...insertData } = parsed.data

  const { data, error } = await ctx.supabase
    .from('vacancies')
    .insert({
      ...insertData,
      ...(hmId ? { hiring_manager_id: hmId } : {}),
      organization_id: ctx.orgId,
      created_by: ctx.userId,
      ...(tokenForInsert ? { application_form_token: tokenForInsert } : {}),
    })
    .select('id')
    .single()

  if (error) return { success: false, error: 'Failed to create vacancy' }

  // Wave 2.6 Slice 1 — seed the per-vacancy default pipeline_stages set
  // (Applied / Screening / Interview / Offer / Hired / Rejected /
  // Withdrawn). Best-effort: failures are logged but don't fail the
  // vacancy insert, because Slice 1 still has the legacy status_id path
  // working underneath. Slice 2's read cutover relies on these rows
  // existing, so the helper falls back to the legacy join only when this
  // seed is missing.
  const { error: seedErr } = await ctx.supabase.rpc('seed_default_pipeline_stages', {
    p_vacancy_id: data.id,
    p_org_id: ctx.orgId,
    p_created_by: ctx.userId,
  })
  if (seedErr) {
    console.error('[vacancies] seed_default_pipeline_stages failed:', seedErr.message)
  }

  revalidatePath('/vacancies')
  return { success: true, data: { id: data.id } }
}

export async function updateVacancy(
  id: string,
  input: VacancyInput
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const parsed = VacancySchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Validation failed" }

  // See createVacancy: only write hiring_manager_id when a manager is picked,
  // so edits still work before the 20260820 migration lands.
  const { hiring_manager_id: hmId, ...updateData } = parsed.data
  const updatePayload: Record<string, unknown> = { ...updateData }
  if (hmId) updatePayload.hiring_manager_id = hmId

  // Auto-generate application_form_token when show_on_public_page is being enabled
  if (parsed.data.show_on_public_page) {
    const { data: existing } = await ctx.supabase
      .from('vacancies')
      .select('application_form_token')
      .eq('id', id)
      .eq('organization_id', ctx.orgId)
      .is('deleted_at', null)
      .single()

    if (!existing?.application_form_token) {
      updatePayload.application_form_token = Buffer.from(
        crypto.getRandomValues(new Uint8Array(32))
      ).toString('base64url')
    }
  }

  const { error } = await ctx.supabase
    .from('vacancies')
    .update(updatePayload)
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)

  if (error) return { success: false, error: 'Failed to update vacancy' }

  revalidatePath('/vacancies')
  revalidatePath(`/vacancies/${id}`)
  return { success: true, data: undefined }
}

export async function updateVacancyStatus(
  id: string,
  statusId: string
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  // Capture before/after status codes for the audit log (read both in parallel)
  const [{ data: vacancyBefore }, { data: newStatus }] = await Promise.all([
    ctx.supabase
      .from('vacancies')
      .select('status_id, vacancy_statuses ( code )')
      .eq('id', id)
      .eq('organization_id', ctx.orgId)
      .is('deleted_at', null)
      .single(),
    ctx.supabase.from('vacancy_statuses').select('code').eq('id', statusId).single(),
  ])

  const { error } = await ctx.supabase
    .from('vacancies')
    .update({ status_id: statusId })
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)

  if (error) return { success: false, error: 'Failed to update vacancy status' }

  type StatusJoin = { code: string } | { code: string }[] | null
  const beforeJoin = vacancyBefore?.vacancy_statuses as StatusJoin
  const beforeCode = Array.isArray(beforeJoin) ? beforeJoin[0]?.code : beforeJoin?.code
  const afterCode = newStatus?.code ?? null
  void writeAuditLog({
    orgId: ctx.orgId,
    userId: ctx.userId,
    entityType: 'vacancy',
    entityId: id,
    action: 'status_changed',
    message:
      beforeCode && afterCode ? `${beforeCode} → ${afterCode}` : `status changed to ${afterCode}`,
    details: { before: beforeCode ?? null, after: afterCode },
  })

  revalidatePath('/vacancies')
  revalidatePath(`/vacancies/${id}`)
  return { success: true, data: undefined }
}

export async function duplicateVacancy(id: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const limitError = await checkPlanLimit(ctx, 'vacancy')
  if (limitError) return { success: false, error: limitError }

  const { data: orig } = await ctx.supabase
    .from('vacancies')
    .select('title, sector_id, status_id, department, location, employment_type, work_mode, hiring_manager_name, salary_min, salary_max, salary_currency, openings_count, start_date, end_date, description, responsibilities, requirements')
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()

  if (!orig) return { success: false, error: 'Vacancy not found' }

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  let newEndDate: string | null = null
  if (orig.end_date && orig.start_date) {
    // differenceInCalendarDays handles DST + day-boundary correctly, unlike
    // (end-start)/86_400_000 which can be off-by-one near midnight or DST shifts.
    const diffDays = differenceInCalendarDays(
      new Date(orig.end_date),
      new Date(orig.start_date),
    )
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + diffDays)
    newEndDate = endDate.toISOString().split('T')[0] ?? null
  } else {
    // BL-012: if the original was open-ended (no end_date), default the
    // duplicate to today + 90 days so it doesn't silently inherit a null
    // deadline. The user can still clear it on the edit page.
    const fallbackEnd = new Date(today)
    fallbackEnd.setDate(fallbackEnd.getDate() + 90)
    newEndDate = fallbackEnd.toISOString().split('T')[0] ?? null
  }

  const { data: draftStatus } = await ctx.supabase
    .from('vacancy_statuses')
    .select('id')
    .eq('code', 'draft')
    .single()

  const { data: newVacancy, error: vacancyError } = await ctx.supabase
    .from('vacancies')
    .insert({
      organization_id: ctx.orgId,
      created_by: ctx.userId,
      title: orig.title,
      sector_id: orig.sector_id,
      status_id: draftStatus?.id ?? orig.status_id,
      department: orig.department,
      location: orig.location,
      employment_type: orig.employment_type,
      work_mode: orig.work_mode,
      hiring_manager_name: orig.hiring_manager_name,
      salary_min: orig.salary_min,
      salary_max: orig.salary_max,
      salary_currency: orig.salary_currency,
      openings_count: orig.openings_count,
      start_date: todayStr,
      end_date: newEndDate,
      description: orig.description,
      responsibilities: orig.responsibilities,
      requirements: orig.requirements,
      show_on_public_page: false,
      application_form_token: null,
    })
    .select('id')
    .single()

  if (vacancyError || !newVacancy) return { success: false, error: 'Failed to duplicate vacancy' }

  // Wave 2.6 Slice 1 — copy the source vacancy's pipeline_stages onto
  // the duplicate so any custom stages the recruiter set up are carried
  // forward. If the source has none (shouldn't happen after Migration
  // 049's backfill) fall back to the seeder so the duplicate at least
  // has the default 7-stage set.
  const { data: srcStages } = await ctx.supabase
    .from('pipeline_stages')
    .select('name, type, sort_order, is_terminal')
    .eq('vacancy_id', id)
    .order('sort_order', { ascending: true })

  if (srcStages && srcStages.length > 0) {
    await ctx.supabase.from('pipeline_stages').insert(
      srcStages.map((s) => ({
        vacancy_id: newVacancy.id,
        organization_id: ctx.orgId,
        name: s.name,
        type: s.type,
        sort_order: s.sort_order,
        is_terminal: s.is_terminal,
        created_by: ctx.userId,
      })),
    )
  } else {
    await ctx.supabase.rpc('seed_default_pipeline_stages', {
      p_vacancy_id: newVacancy.id,
      p_org_id: ctx.orgId,
      p_created_by: ctx.userId,
    })
  }

  // Copy assessment questions — including the Wave 2.5 must_have flag so
  // duplicated roles inherit the original's hard-requirement attributes
  // and recruiters don't have to re-toggle them.
  const { data: questions } = await ctx.supabase
    .from('vacancy_questions')
    .select('label, type, sort_order, must_have')
    .eq('vacancy_id', id)
    .eq('organization_id', ctx.orgId)
    .order('sort_order', { ascending: true })

  if (questions && questions.length > 0) {
    await ctx.supabase.from('vacancy_questions').insert(
      questions.map((q) => ({
        vacancy_id: newVacancy.id,
        organization_id: ctx.orgId,
        label: q.label,
        type: q.type,
        sort_order: q.sort_order,
        must_have: q.must_have ?? false,
      }))
    )
  }

  // Copy custom field values
  const { data: cfValues } = await ctx.supabase
    .from('custom_field_values')
    .select('field_id, value_text, value_number, value_boolean, value_option')
    .eq('entity_id', id)
    .eq('organization_id', ctx.orgId)

  if (cfValues && cfValues.length > 0) {
    await ctx.supabase.from('custom_field_values').insert(
      cfValues.map((v) => ({
        organization_id: ctx.orgId,
        entity_id: newVacancy.id,
        field_id: v.field_id,
        value_text: v.value_text,
        value_number: v.value_number,
        value_boolean: v.value_boolean,
        value_option: v.value_option,
      }))
    )
  }

  revalidatePath('/vacancies')
  return { success: true, data: { id: newVacancy.id } }
}

export async function deleteVacancy(id: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { error } = await ctx.supabase
    .from('vacancies')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)

  if (error) return { success: false, error: 'Failed to delete vacancy' }

  revalidatePath('/vacancies')
  return { success: true, data: undefined }
}
