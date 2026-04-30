'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'

export type ColumnEntity = 'candidates' | 'vacancies'

export const DEFAULT_CANDIDATE_COLUMNS = ['current_position', 'current_company', 'created_at']
export const DEFAULT_VACANCY_COLUMNS = ['department', 'location', 'end_date']

export async function updateColumnPreferences(
  entity: ColumnEntity,
  columns: string[]
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('column_preferences')
    .eq('id', ctx.userId)
    .single()

  const current = (profile?.column_preferences as Record<string, string[]>) || {}
  const updated = { ...current, [entity]: columns }

  const { error } = await ctx.supabase
    .from('profiles')
    .update({ column_preferences: updated })
    .eq('id', ctx.userId)

  if (error) return { success: false, error: 'Failed to save preferences' }

  revalidatePath(entity === 'candidates' ? '/candidates' : '/vacancies')
  return { success: true, data: undefined }
}
