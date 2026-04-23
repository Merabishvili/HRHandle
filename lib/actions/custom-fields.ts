'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'

export type EntityType = 'candidate' | 'vacancy'
export type FieldType = 'text' | 'number' | 'dropdown' | 'checkbox'

export interface CustomFieldGroup {
  id: string
  name: string
  entity_type: EntityType
  sort_order: number
}

export interface CustomField {
  id: string
  group_id: string
  name: string
  field_type: FieldType
  is_required: boolean
  options: string[] | null
  sort_order: number
  deleted_at: string | null
}

export interface CustomFieldValue {
  id: string
  field_id: string
  entity_id: string
  value_text: string | null
  value_number: number | null
  value_boolean: boolean | null
  value_option: string | null
}

export interface CustomFieldGroupWithFields extends CustomFieldGroup {
  fields: CustomField[]
}

// ─── Read ────────────────────────────────────────────────────────────────────

export async function getCustomFieldSchema(
  entityType: EntityType
): Promise<CustomFieldGroupWithFields[]> {
  const ctx = await getAuthContext()
  if (!ctx) return []

  const { data: groups } = await ctx.supabase
    .from('custom_field_groups')
    .select('id, name, entity_type, sort_order')
    .eq('organization_id', ctx.orgId)
    .eq('entity_type', entityType)
    .order('sort_order', { ascending: true })

  if (!groups || groups.length === 0) return []

  const groupIds = groups.map((g) => g.id)

  const { data: fields } = await ctx.supabase
    .from('custom_fields')
    .select('id, group_id, name, field_type, is_required, options, sort_order, deleted_at')
    .eq('organization_id', ctx.orgId)
    .in('group_id', groupIds)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  const fieldsByGroup = new Map<string, CustomField[]>()
  for (const f of fields || []) {
    const list = fieldsByGroup.get(f.group_id) || []
    list.push({ ...f, options: f.options as string[] | null })
    fieldsByGroup.set(f.group_id, list)
  }

  return groups.map((g) => ({
    ...g,
    fields: fieldsByGroup.get(g.id) || [],
  }))
}

export async function getCustomFieldValues(
  entityId: string
): Promise<CustomFieldValue[]> {
  const ctx = await getAuthContext()
  if (!ctx) return []

  const { data } = await ctx.supabase
    .from('custom_field_values')
    .select('id, field_id, entity_id, value_text, value_number, value_boolean, value_option')
    .eq('organization_id', ctx.orgId)
    .eq('entity_id', entityId)

  return (data || []) as CustomFieldValue[]
}

// ─── Manage schema (admin/owner only) ────────────────────────────────────────

export async function createCustomFieldGroup(
  entityType: EntityType,
  name: string
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (ctx.role === 'member') return { success: false, error: 'Admins only' }

  const trimmed = name.trim()
  if (!trimmed) return { success: false, error: 'Group name is required' }

  const { count: existingGroupCount } = await ctx.supabase
    .from('custom_field_groups')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', ctx.orgId)
    .eq('entity_type', entityType)

  const { data, error } = await ctx.supabase
    .from('custom_field_groups')
    .insert({
      organization_id: ctx.orgId,
      entity_type: entityType,
      name: trimmed,
      sort_order: (existingGroupCount ?? 0) + 1,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { success: false, error: 'A group with this name already exists' }
    return { success: false, error: 'Failed to create group' }
  }

  revalidatePath('/settings')
  return { success: true, data: { id: data.id } }
}

export async function deleteCustomFieldGroup(
  groupId: string
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (ctx.role === 'member') return { success: false, error: 'Admins only' }

  // Verify ownership
  const { data: group } = await ctx.supabase
    .from('custom_field_groups')
    .select('id')
    .eq('id', groupId)
    .eq('organization_id', ctx.orgId)
    .single()

  if (!group) return { success: false, error: 'Group not found' }

  // Fields + values cascade via FK
  const { error } = await ctx.supabase
    .from('custom_field_groups')
    .delete()
    .eq('id', groupId)

  if (error) return { success: false, error: 'Failed to delete group' }

  revalidatePath('/settings')
  return { success: true, data: undefined }
}

export async function createCustomField(input: {
  groupId: string
  entityType: EntityType
  name: string
  fieldType: FieldType
  isRequired: boolean
  options?: string[]
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (ctx.role === 'member') return { success: false, error: 'Admins only' }

  const trimmed = input.name.trim()
  if (!trimmed) return { success: false, error: 'Field name is required' }

  if (input.fieldType === 'dropdown' && (!input.options || input.options.length === 0)) {
    return { success: false, error: 'Dropdown fields require at least one option' }
  }

  // Enforce 20-field limit per entity type
  const { data: groups } = await ctx.supabase
    .from('custom_field_groups')
    .select('id')
    .eq('organization_id', ctx.orgId)
    .eq('entity_type', input.entityType)

  if (groups && groups.length > 0) {
    const groupIds = groups.map((g) => g.id)
    const { count } = await ctx.supabase
      .from('custom_fields')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx.orgId)
      .in('group_id', groupIds)
      .is('deleted_at', null)

    if ((count ?? 0) >= 20) {
      return {
        success: false,
        error: `You've reached the limit of 20 custom fields for ${input.entityType}s.`,
      }
    }
  }

  // Verify group belongs to this org
  const { data: group } = await ctx.supabase
    .from('custom_field_groups')
    .select('id')
    .eq('id', input.groupId)
    .eq('organization_id', ctx.orgId)
    .single()

  if (!group) return { success: false, error: 'Group not found' }

  const { count: existingCount } = await ctx.supabase
    .from('custom_fields')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', input.groupId)
    .is('deleted_at', null)

  const options =
    input.fieldType === 'dropdown'
      ? (input.options || []).map((o) => o.trim()).filter(Boolean)
      : null

  const { data, error } = await ctx.supabase
    .from('custom_fields')
    .insert({
      organization_id: ctx.orgId,
      group_id: input.groupId,
      name: trimmed,
      field_type: input.fieldType,
      is_required: input.isRequired,
      options,
      sort_order: (existingCount ?? 0) + 1,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: 'Failed to create field' }

  revalidatePath('/settings')
  return { success: true, data: { id: data.id } }
}

export async function addDropdownOption(
  fieldId: string,
  newOption: string
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (ctx.role === 'member') return { success: false, error: 'Admins only' }

  const trimmed = newOption.trim()
  if (!trimmed) return { success: false, error: 'Option value is required' }

  const { data: field } = await ctx.supabase
    .from('custom_fields')
    .select('id, options, field_type')
    .eq('id', fieldId)
    .eq('organization_id', ctx.orgId)
    .single()

  if (!field) return { success: false, error: 'Field not found' }
  if (field.field_type !== 'dropdown') return { success: false, error: 'Not a dropdown field' }

  const current: string[] = Array.isArray(field.options) ? (field.options as string[]) : []
  if (current.includes(trimmed)) return { success: false, error: 'Option already exists' }

  const { error } = await ctx.supabase
    .from('custom_fields')
    .update({ options: [...current, trimmed] })
    .eq('id', fieldId)

  if (error) return { success: false, error: 'Failed to add option' }

  revalidatePath('/settings')
  return { success: true, data: undefined }
}

export async function deleteCustomField(
  fieldId: string
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (ctx.role === 'member') return { success: false, error: 'Admins only' }

  const { data: field } = await ctx.supabase
    .from('custom_fields')
    .select('id')
    .eq('id', fieldId)
    .eq('organization_id', ctx.orgId)
    .single()

  if (!field) return { success: false, error: 'Field not found' }

  // Soft delete
  const { error } = await ctx.supabase
    .from('custom_fields')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', fieldId)

  if (error) return { success: false, error: 'Failed to delete field' }

  revalidatePath('/settings')
  return { success: true, data: undefined }
}

// ─── Save values (any member) ─────────────────────────────────────────────────

export async function saveCustomFieldValues(
  entityId: string,
  values: Array<{
    fieldId: string
    valueText?: string | null
    valueNumber?: number | null
    valueBoolean?: boolean | null
    valueOption?: string | null
  }>
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const upserts = values.map((v) => ({
    organization_id: ctx.orgId,
    field_id: v.fieldId,
    entity_id: entityId,
    value_text: v.valueText ?? null,
    value_number: v.valueNumber ?? null,
    value_boolean: v.valueBoolean ?? null,
    value_option: v.valueOption ?? null,
    updated_at: new Date().toISOString(),
  }))

  if (upserts.length === 0) return { success: true, data: undefined }

  const { error } = await ctx.supabase
    .from('custom_field_values')
    .upsert(upserts, { onConflict: 'field_id,entity_id' })

  if (error) return { success: false, error: 'Failed to save custom field values' }

  return { success: true, data: undefined }
}
