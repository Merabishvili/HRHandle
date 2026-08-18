'use server'

import { revalidatePath } from 'next/cache'

import { getAuthContext, type ActionResult } from './index'
import { isOrgAdmin } from '@/lib/permissions'

const STAGE_TYPES = ['standard', 'review', 'interview', 'offer'] as const
export type PipelineStageType = (typeof STAGE_TYPES)[number]

const MAX_NAME_LEN = 60

/**
 * Wave 2.6 Slice 3 — server actions for the per-vacancy Pipeline Stages
 * Manager UI. Each action revalidates both the vacancy detail page (so
 * the Settings tab re-renders) and the per-vacancy pipeline page (so the
 * board columns reflect the change).
 *
 * The cap-10 limit per vacancy is enforced by the BEFORE INSERT trigger
 * added in Migration 046 (`enforce_pipeline_stages_cap`); these actions
 * surface the trigger's exception as a clean error.
 */
function revalidateForVacancy(vacancyId: string) {
  revalidatePath(`/vacancies/${vacancyId}`)
  revalidatePath(`/vacancies/${vacancyId}/pipeline`)
}

export async function createPipelineStage(input: {
  vacancyId: string
  name: string
  type: PipelineStageType
  isTerminal?: boolean
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can manage pipeline stages.' }
  }

  const name = input.name.trim()
  if (!name) return { success: false, error: 'Stage name is required' }
  if (name.length > MAX_NAME_LEN) {
    return { success: false, error: `Stage name must be ${MAX_NAME_LEN} characters or fewer` }
  }
  if (!STAGE_TYPES.includes(input.type)) {
    return { success: false, error: 'Invalid stage type' }
  }

  // Verify vacancy belongs to caller's org.
  const { data: vacancyCheck } = await ctx.supabase
    .from('vacancies')
    .select('id')
    .eq('id', input.vacancyId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()
  if (!vacancyCheck) return { success: false, error: 'Vacancy not found' }

  // Next sort_order = max(existing) + 1. The DB trigger separately caps
  // total rows at 10 and will raise if we hit it.
  const { data: existing } = await ctx.supabase
    .from('pipeline_stages')
    .select('sort_order')
    .eq('vacancy_id', input.vacancyId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextSortOrder = (existing?.[0]?.sort_order ?? 0) + 1

  const { data, error } = await ctx.supabase
    .from('pipeline_stages')
    .insert({
      vacancy_id: input.vacancyId,
      organization_id: ctx.orgId,
      name,
      type: input.type,
      is_terminal: Boolean(input.isTerminal),
      sort_order: nextSortOrder,
      created_by: ctx.userId,
    })
    .select('id')
    .single()

  if (error) {
    if (error.message?.includes('Pipeline stages capped at 10')) {
      return { success: false, error: 'This vacancy already has 10 stages — the per-vacancy cap.' }
    }
    return { success: false, error: 'Failed to add stage' }
  }

  revalidateForVacancy(input.vacancyId)
  return { success: true, data: { id: data.id } }
}

export async function updatePipelineStage(input: {
  stageId: string
  vacancyId: string
  name?: string
  type?: PipelineStageType
  isTerminal?: boolean
}): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can manage pipeline stages.' }
  }

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) return { success: false, error: 'Stage name is required' }
    if (name.length > MAX_NAME_LEN) {
      return { success: false, error: `Stage name must be ${MAX_NAME_LEN} characters or fewer` }
    }
    updatePayload.name = name
  }
  if (input.type !== undefined) {
    if (!STAGE_TYPES.includes(input.type)) {
      return { success: false, error: 'Invalid stage type' }
    }
    updatePayload.type = input.type
  }
  if (input.isTerminal !== undefined) {
    updatePayload.is_terminal = input.isTerminal
  }

  const { error } = await ctx.supabase
    .from('pipeline_stages')
    .update(updatePayload)
    .eq('id', input.stageId)
    .eq('vacancy_id', input.vacancyId)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to update stage' }

  revalidateForVacancy(input.vacancyId)
  return { success: true, data: undefined }
}

export async function deletePipelineStage(input: {
  stageId: string
  vacancyId: string
}): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can manage pipeline stages.' }
  }

  // Block delete if any non-deleted application is currently in this
  // stage. The FK is ON DELETE SET NULL — without this check, those
  // apps would vanish from the per-vacancy board until the recruiter
  // re-stages them. Better to make the recruiter move them first.
  const { count } = await ctx.supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('pipeline_stage_id', input.stageId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)

  if ((count ?? 0) > 0) {
    return {
      success: false,
      error: `Move the ${count} candidate(s) on this stage to another stage before deleting it.`,
    }
  }

  const { error } = await ctx.supabase
    .from('pipeline_stages')
    .delete()
    .eq('id', input.stageId)
    .eq('vacancy_id', input.vacancyId)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to delete stage' }

  revalidateForVacancy(input.vacancyId)
  return { success: true, data: undefined }
}

/**
 * Bulk-reorder all stages on a vacancy. The caller passes the stage ids
 * in their new order; we assign sort_order 1..N based on the array
 * position. The two-pass approach (shift everyone past the new max,
 * then write final positions) sidesteps the unique-index conflict on
 * (vacancy_id, sort_order).
 */
export async function reorderPipelineStages(input: {
  vacancyId: string
  orderedStageIds: string[]
}): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isOrgAdmin(ctx.role)) {
    return { success: false, error: 'Only owners and admins can manage pipeline stages.' }
  }

  if (input.orderedStageIds.length === 0) {
    return { success: true, data: undefined }
  }

  // Verify every id belongs to this vacancy + org.
  const { data: existingRows } = await ctx.supabase
    .from('pipeline_stages')
    .select('id')
    .eq('vacancy_id', input.vacancyId)
    .eq('organization_id', ctx.orgId)
    .in('id', input.orderedStageIds)

  if ((existingRows ?? []).length !== input.orderedStageIds.length) {
    return { success: false, error: 'Some stages no longer exist — reload and try again.' }
  }

  // Pass 1: shift every targeted row to a high sort_order (existing max
  // + 100 + index) so the unique index allows our final assignments
  // without temporary collisions.
  const { data: maxRow } = await ctx.supabase
    .from('pipeline_stages')
    .select('sort_order')
    .eq('vacancy_id', input.vacancyId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const shiftBase = (maxRow?.[0]?.sort_order ?? 0) + 100

  for (let i = 0; i < input.orderedStageIds.length; i++) {
    const id = input.orderedStageIds[i]
    const { error } = await ctx.supabase
      .from('pipeline_stages')
      .update({ sort_order: shiftBase + i })
      .eq('id', id)
      .eq('vacancy_id', input.vacancyId)
      .eq('organization_id', ctx.orgId)
    if (error) return { success: false, error: 'Failed to reorder stages' }
  }

  // Pass 2: assign the final 1..N order.
  for (let i = 0; i < input.orderedStageIds.length; i++) {
    const id = input.orderedStageIds[i]
    const { error } = await ctx.supabase
      .from('pipeline_stages')
      .update({ sort_order: i + 1 })
      .eq('id', id)
      .eq('vacancy_id', input.vacancyId)
      .eq('organization_id', ctx.orgId)
    if (error) return { success: false, error: 'Failed to reorder stages' }
  }

  revalidateForVacancy(input.vacancyId)
  return { success: true, data: undefined }
}
