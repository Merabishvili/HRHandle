'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import { createOrgNotifications } from '@/lib/actions/notifications'
import { extractMentionIds, type MentionableMember } from '@/lib/notes/mentions'

const NoteSchema = z.object({
  text: z.string().min(1, 'Note cannot be empty').max(5000),
})

// Reasonable cap so a malicious or buggy client can't ask us to fan out a
// notification to ~100 teammates per note. Notes mentioning more than this
// either need to be split, or it's a sign of misuse — either way safe to
// drop the overflow.
const MAX_MENTIONS_PER_NOTE = 20

export async function createNote(
  candidateId: string,
  text: string,
  mentions: string[] = [],
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const parsed = NoteSchema.safeParse({ text })
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Validation failed" }
  }

  // Verify candidate belongs to org
  const { data: candidate } = await ctx.supabase
    .from('candidates')
    .select('id, first_name, last_name')
    .eq('id', candidateId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()

  if (!candidate) return { success: false, error: 'Candidate not found' }

  // Revalidate mentions against the current org members + the note text.
  // Belt-and-braces — the client records ids alongside the text, but we
  // never trust client-supplied arrays without re-checking.
  let validatedMentions: string[] = []
  if (mentions.length > 0) {
    const { data: members } = await ctx.supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('organization_id', ctx.orgId)
    const mapped: MentionableMember[] = ((members ?? []) as {
      id: string
      full_name: string | null
      email: string | null
    }[])
      .filter((m) => !!m.full_name || !!m.email)
      .map((m) => ({ id: m.id, display_name: m.full_name || (m.email as string) }))
    validatedMentions = extractMentionIds(parsed.data.text, mentions, mapped).slice(
      0,
      MAX_MENTIONS_PER_NOTE,
    )
  }

  const { data, error } = await ctx.supabase
    .from('candidate_notes')
    .insert({
      candidate_id: candidateId,
      organization_id: ctx.orgId,
      created_by: ctx.userId,
      note_text: parsed.data.text,
      mentions: validatedMentions,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: 'Failed to save note' }

  // Fire-and-forget notifications. Skip self-mentions silently. Failure is
  // logged inside createOrgNotifications and never blocks the save.
  const recipientIds = validatedMentions.filter((id) => id !== ctx.userId)
  if (recipientIds.length > 0) {
    const candidateName =
      `${candidate.first_name ?? ''} ${candidate.last_name ?? ''}`.trim() || 'a candidate'
    const preview = parsed.data.text.length > 120
      ? `${parsed.data.text.slice(0, 117)}…`
      : parsed.data.text

    const { data: author } = await ctx.supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', ctx.userId)
      .single()
    const authorLabel = author?.full_name || author?.email || 'A teammate'

    void createOrgNotifications(ctx.orgId, recipientIds, {
      type: 'note_mention',
      title: `${authorLabel} mentioned you on ${candidateName}`,
      body: preview,
      link: `/candidates/${candidateId}?note=${data.id}`,
    })
  }

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

/** Org members eligible to be @-mentioned in a note. Tiny list at HRHandle's
 * scale; no pagination. Excludes deactivated members and the caller (no
 * point @-ing yourself). */
export async function listMentionableMembers(): Promise<
  ActionResult<MentionableMember[]>
> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data, error } = await ctx.supabase
    .from('profiles')
    .select('id, full_name, email, is_active')
    .eq('organization_id', ctx.orgId)
    .order('full_name', { ascending: true })

  if (error) return { success: false, error: 'Failed to load members' }

  const out: MentionableMember[] = ((data ?? []) as {
    id: string
    full_name: string | null
    email: string | null
    is_active: boolean | null
  }[])
    .filter((m) => m.is_active !== false && m.id !== ctx.userId)
    .map((m) => ({
      id: m.id,
      display_name: m.full_name || (m.email as string) || 'Unnamed member',
    }))

  return { success: true, data: out }
}
