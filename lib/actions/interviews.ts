'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import { InterviewSchema, type InterviewInput } from '@/lib/validations/interview'

export async function createInterview(
  input: InterviewInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const parsed = InterviewSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  // Verify the candidate belongs to this org
  const { data: candidate } = await ctx.supabase
    .from('candidates')
    .select('id')
    .eq('id', parsed.data.candidate_id)
    .eq('organization_id', ctx.orgId)
    .single()

  if (!candidate) return { success: false, error: 'Candidate not found' }

  const { data, error } = await ctx.supabase
    .from('interviews')
    .insert({
      ...parsed.data,
      organization_id: ctx.orgId,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: 'Failed to schedule interview' }

  revalidatePath('/interviews')
  return { success: true, data: { id: data.id } }
}
