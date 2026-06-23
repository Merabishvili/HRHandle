'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import {
  PIPELINE_STAGE_TYPES,
  type OrgPipelineStageTemplate,
  type PipelineStageType,
} from '@/lib/pipeline-stage-templates/types'

export type { OrgPipelineStageTemplate, PipelineStageType }

/**
 * A-5 — Org-level pipeline-stage templates (per Custom Stages.dc.html).
 *
 * Settings → Pipeline stages CRUDs these rows; the
 * `seed_default_pipeline_stages` SQL function in Migration 055 copies
 * the template onto every new vacancy. Cap-10 per org is enforced by
 * trigger.
 */

const isAdminRole = (role: string | undefined): boolean =>
  role === 'owner' || role === 'admin'

export async function listOrgPipelineStageTemplates(): Promise<
  ActionResult<OrgPipelineStageTemplate[]>
> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data, error } = await ctx.supabase
    .from('org_pipeline_stage_templates')
    .select('id, name, type, sort_order, is_terminal')
    .eq('organization_id', ctx.orgId)
    .order('sort_order', { ascending: true })

  if (error) return { success: false, error: 'Could not load templates' }
  return { success: true, data: (data ?? []) as OrgPipelineStageTemplate[] }
}

export async function createOrgPipelineStageTemplate(input: {
  name: string
  type: PipelineStageType
  isTerminal?: boolean
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isAdminRole(ctx.role)) {
    return { success: false, error: 'Only owners and admins can manage stages' }
  }

  const trimmed = input.name.trim()
  if (!trimmed) return { success: false, error: 'Name is required' }
  if (trimmed.length > 60) {
    return { success: false, error: 'Name must be 60 characters or fewer' }
  }
  if (!PIPELINE_STAGE_TYPES.includes(input.type)) {
    return { success: false, error: 'Invalid stage type' }
  }

  // Append at the end. Read the current max sort_order first so we
  // don't collide with the UNIQUE(org, sort_order) index.
  const { data: tail } = await ctx.supabase
    .from('org_pipeline_stage_templates')
    .select('sort_order')
    .eq('organization_id', ctx.orgId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextSort = ((tail?.sort_order as number | undefined) ?? 0) + 1

  const { data, error } = await ctx.supabase
    .from('org_pipeline_stage_templates')
    .insert({
      organization_id: ctx.orgId,
      name: trimmed,
      type: input.type,
      sort_order: nextSort,
      is_terminal: input.isTerminal ?? false,
      created_by: ctx.userId,
    })
    .select('id')
    .single()

  if (error) {
    const msg = error.message ?? ''
    const friendly = msg.includes('capped at 10')
      ? 'Pipeline stage templates are capped at 10 per organization'
      : 'Could not add stage'
    return { success: false, error: friendly }
  }

  revalidatePath('/settings/pipeline-stages')
  return { success: true, data: { id: data.id as string } }
}

export async function deleteOrgPipelineStageTemplate(
  id: string,
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isAdminRole(ctx.role)) {
    return { success: false, error: 'Only owners and admins can manage stages' }
  }

  const { error } = await ctx.supabase
    .from('org_pipeline_stage_templates')
    .delete()
    .eq('id', id)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Could not remove stage' }
  revalidatePath('/settings/pipeline-stages')
  return { success: true, data: undefined }
}

/**
 * Atomically rewrite sort_order across the org's templates from a
 * client-supplied ordered list of ids. Backed by the
 * `reorder_org_pipeline_stage_templates` SQL function in Migration 057
 * (two-pass write to dodge the UNIQUE(org, sort_order) index).
 */
export async function reorderOrgPipelineStageTemplates(
  orderedIds: string[],
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isAdminRole(ctx.role)) {
    return { success: false, error: 'Only owners and admins can manage stages' }
  }
  if (orderedIds.length === 0) return { success: true, data: undefined }

  const { error } = await ctx.supabase.rpc(
    'reorder_org_pipeline_stage_templates',
    { p_template_ids: orderedIds },
  )
  if (error) {
    const msg = error.message ?? ''
    const friendly = msg.includes('does not cover')
      ? 'Reorder list is incomplete or contains unknown stages'
      : msg.includes('mixes multiple')
        ? 'Reorder list references stages from a different organization'
        : 'Could not save the new order'
    return { success: false, error: friendly }
  }

  revalidatePath('/settings/pipeline-stages')
  return { success: true, data: undefined }
}

/**
 * Counts vacancies that have zero applications — the safe target for
 * the bulk-apply action. Lets the Settings UI surface "this will affect
 * N vacancies" up-front before the user clicks.
 */
export async function countEmptyVacancies(): Promise<ActionResult<number>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data, error } = await ctx.supabase
    .from('vacancies')
    .select('id, applications(id)')
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)

  if (error) return { success: false, error: 'Could not count vacancies' }

  type Row = { id: string; applications: { id: string }[] | null }
  const empty = (data as Row[] | null ?? []).filter(
    (v) => !v.applications || v.applications.length === 0,
  )
  return { success: true, data: empty.length }
}

/**
 * Replaces pipeline_stages on every vacancy in the org that has zero
 * applications. Vacancies with any application history (live or
 * archived) are skipped — re-pointing application.pipeline_stage_id
 * across stage swaps is risky and out of scope here. Returns the
 * number of vacancies updated.
 */
export async function applyTemplateToEmptyVacancies(): Promise<
  ActionResult<{ updated: number }>
> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isAdminRole(ctx.role)) {
    return { success: false, error: 'Only owners and admins can manage stages' }
  }

  const { data, error } = await ctx.supabase.rpc(
    'apply_template_to_empty_vacancies',
    { p_org_id: ctx.orgId, p_actor_id: ctx.userId },
  )
  if (error) return { success: false, error: 'Could not apply template to vacancies' }

  revalidatePath('/settings/pipeline-stages')
  return { success: true, data: { updated: (data as number) ?? 0 } }
}

/**
 * One-shot helper that materializes the org's template from the
 * hardcoded default set. Backed by the SQL function in Migration 055
 * so the cap-10 trigger + the "must be empty" check live in one place.
 */
export async function seedOrgPipelineStageTemplateFromDefaults(): Promise<
  ActionResult<void>
> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!isAdminRole(ctx.role)) {
    return { success: false, error: 'Only owners and admins can manage stages' }
  }

  const { error } = await ctx.supabase.rpc(
    'seed_org_pipeline_stage_template_defaults',
    { p_org_id: ctx.orgId, p_created_by: ctx.userId },
  )
  if (error) {
    const msg = error.message ?? ''
    const friendly = msg.includes('already has')
      ? 'Templates already exist — clear them first to re-seed defaults'
      : 'Could not seed default templates'
    return { success: false, error: friendly }
  }

  revalidatePath('/settings/pipeline-stages')
  return { success: true, data: undefined }
}
