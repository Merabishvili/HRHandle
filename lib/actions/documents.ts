'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'

const BUCKET = 'candidate-documents'
const SIGNED_URL_TTL_SECONDS = 3600

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

export async function uploadDocument(
  candidateId: string,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const file = formData.get('file')
  const documentType = formData.get('document_type') as string | null

  if (!(file instanceof File)) return { success: false, error: 'No file provided' }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { success: false, error: 'Only PDF and Word documents are accepted' }
  }
  if (file.size > MAX_FILE_BYTES) {
    return { success: false, error: 'File must be under 10 MB' }
  }

  const { data: candidate } = await ctx.supabase
    .from('candidates')
    .select('id')
    .eq('id', candidateId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()

  if (!candidate) return { success: false, error: 'Candidate not found' }

  const ext = file.name.split('.').pop() ?? 'bin'
  const storagePath = `${ctx.orgId}/${candidateId}/${Date.now()}.${ext}`

  const { error: uploadError } = await ctx.supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  if (uploadError) return { success: false, error: 'Upload failed: ' + uploadError.message }

  const { data, error: dbError } = await ctx.supabase
    .from('candidate_documents')
    .insert({
      candidate_id: candidateId,
      organization_id: ctx.orgId,
      uploaded_by: ctx.userId,
      file_name: file.name,
      file_path: storagePath,
      file_size: file.size,
      mime_type: file.type,
      document_type: documentType || 'other',
    })
    .select('id')
    .single()

  if (dbError || !data) {
    await ctx.supabase.storage.from(BUCKET).remove([storagePath])
    return { success: false, error: 'Failed to record document' }
  }

  revalidatePath(`/candidates/${candidateId}`)
  return { success: true, data: { id: data.id } }
}

/**
 * Returns a short-lived signed URL for a candidate document.
 * Never exposes raw storage paths to the client.
 */
export async function getDocumentSignedUrl(
  documentId: string
): Promise<ActionResult<{ url: string; filename: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  // Verify the document belongs to this org before generating a URL
  const { data: doc } = await ctx.supabase
    .from('candidate_documents')
    .select('file_path, file_name')
    .eq('id', documentId)
    .eq('organization_id', ctx.orgId)
    .is('deleted_at', null)
    .single()

  if (!doc) return { success: false, error: 'Document not found' }

  const { data, error } = await ctx.supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.file_path, SIGNED_URL_TTL_SECONDS)

  if (error || !data?.signedUrl) {
    return { success: false, error: 'Failed to generate download link' }
  }

  return { success: true, data: { url: data.signedUrl, filename: doc.file_name } }
}

/**
 * Soft-deletes a document record and removes it from storage.
 */
export async function deleteDocument(documentId: string): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { data: doc } = await ctx.supabase
    .from('candidate_documents')
    .select('file_path')
    .eq('id', documentId)
    .eq('organization_id', ctx.orgId)
    .single()

  if (!doc) return { success: false, error: 'Document not found' }

  await ctx.supabase.storage.from(BUCKET).remove([doc.file_path])

  const { error } = await ctx.supabase
    .from('candidate_documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', documentId)
    .eq('organization_id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to delete document' }

  return { success: true, data: undefined }
}
