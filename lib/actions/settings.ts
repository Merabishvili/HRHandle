'use server'

import { revalidatePath } from 'next/cache'
import { getAuthContext, type ActionResult } from './index'
import { createAdminClient } from '@/lib/supabase/admin'
import { ProfileSchema, OrganizationSchema } from '@/lib/validations/settings'
import type { ProfileInput, OrganizationInput } from '@/lib/validations/settings'

const AVATAR_BUCKET = 'avatars'
const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const AVATAR_MAX_BYTES = 2 * 1024 * 1024

/** #1 — upload a profile avatar to the public `avatars` bucket and save the URL
 * on the user's profile. Server-side via the admin client, so no per-user
 * storage policy is needed. */
export async function uploadAvatar(formData: FormData): Promise<ActionResult<{ url: string }>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const file = formData.get('file')
  if (!(file instanceof File)) return { success: false, error: 'No file provided' }
  if (!AVATAR_MIME_TYPES.has(file.type)) {
    return { success: false, error: 'Only JPG, PNG, or WebP images are accepted' }
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { success: false, error: 'Image must be under 2 MB' }
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${ctx.userId}/${crypto.randomUUID()}.${ext}`
  const bytes = await file.arrayBuffer()

  const admin = createAdminClient()
  const { error: upErr } = await admin.storage
    .from(AVATAR_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false })
  if (upErr) {
    console.error('[settings] avatar upload failed:', upErr.message)
    return { success: false, error: 'Failed to upload image' }
  }

  const { data: pub } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  const url = pub.publicUrl

  const { error: dbErr } = await ctx.supabase
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', ctx.userId)
  if (dbErr) {
    await admin.storage.from(AVATAR_BUCKET).remove([path])
    return { success: false, error: 'Failed to save avatar' }
  }

  revalidatePath('/settings')
  return { success: true, data: { url } }
}

export async function updateProfile(input: ProfileInput): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const parsed = ProfileSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Validation failed" }

  const { error } = await ctx.supabase
    .from('profiles')
    .update({
      full_name: parsed.data.full_name.trim(),
      phone: parsed.data.phone?.trim() || null,
      language: parsed.data.language?.trim() || null,
    })
    .eq('id', ctx.userId)

  if (error) return { success: false, error: 'Failed to update profile' }

  revalidatePath('/settings')
  return { success: true, data: undefined }
}

const MEETING_PROVIDERS = ['google_meet', 'zoom', 'teams'] as const
export type DefaultMeetingProvider = (typeof MEETING_PROVIDERS)[number]

/** #6b — persist the user's preferred auto meeting link for video interviews.
 * `null` restores the built-in Google > Zoom > Teams precedence. */
export async function updateDefaultMeetingProvider(
  provider: DefaultMeetingProvider | null,
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  if (provider !== null && !MEETING_PROVIDERS.includes(provider)) {
    return { success: false, error: 'Invalid provider' }
  }

  const { error } = await ctx.supabase
    .from('profiles')
    .update({ default_meeting_provider: provider })
    .eq('id', ctx.userId)

  if (error) return { success: false, error: 'Failed to save preference' }

  revalidatePath('/settings')
  return { success: true, data: undefined }
}

export async function updateOrganization(
  orgId: string,
  input: OrganizationInput
): Promise<ActionResult<void>> {
  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  // Only owners can update organization details
  if (ctx.role !== 'owner') {
    return { success: false, error: 'Only organization owners can update these settings' }
  }

  // Verify the org ID matches the user's org (RBAC check)
  if (orgId !== ctx.orgId) {
    return { success: false, error: 'Unauthorized' }
  }

  const parsed = OrganizationSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Validation failed" }

  const updatePayload: Record<string, unknown> = { name: parsed.data.name.trim() }
  if ('logo_url' in parsed.data) {
    updatePayload.logo_url = parsed.data.logo_url ?? null
  }
  if (parsed.data.public_page_slug) {
    const newSlug = parsed.data.public_page_slug.trim()
    // Check uniqueness — another org must not already own this slug
    const { data: existing } = await ctx.supabase
      .from('organizations')
      .select('id')
      .eq('public_page_slug', newSlug)
      .neq('id', ctx.orgId)
      .maybeSingle()
    if (existing) {
      return { success: false, error: 'This public URL is already taken. Please choose another.' }
    }
    updatePayload.public_page_slug = newSlug
  }

  const { error } = await ctx.supabase
    .from('organizations')
    .update(updatePayload)
    .eq('id', ctx.orgId)

  if (error) return { success: false, error: 'Failed to update organization' }

  revalidatePath('/settings')
  return { success: true, data: undefined }
}
