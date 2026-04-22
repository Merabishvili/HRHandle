'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'

const NoteSchema = z.object({
  text: z.string().min(1, 'Note cannot be empty').max(5000),
})

export async function createNote(
  candidateId: string,
  text: string
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const parsed = NoteSchema.safeParse({ text })
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  // Verify candidate belongs to org
  const { data: candidate } = await ctx.supabase
    .from('candidates')
    .select('id')
    .eq('id', candidateId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()

  if (!candidate) return { success: false, error: 'Candidate not found' }

  const { data, error } = await ctx.supabase
    .from('candidate_notes')
    .insert({
      candidate_id: candidateId,
      organization_id: ctx.orgId,
      author_id: ctx.userId,
      text: parsed.data.text,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: 'Failed to save note' }

  revalidatePath(`/candidates/${candidateId}`)
  return { success: true, data: { id: data.id } }
}

export async function deleteNote(
  noteId: string,
  candidateId: string
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { error } = await ctx.supabase
    .from('candidate_notes')
    .delete()
    .eq('id', noteId)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to delete note' }

  revalidatePath(`/candidates/${candidateId}`)
  return { success: true, data: undefined }
}
