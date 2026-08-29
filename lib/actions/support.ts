'use server'

import { headers } from 'next/headers'
import { getLocale } from 'next-intl/server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from './index'
import { validateSupportInput, type SupportError } from '@/lib/support/validation'
import { verifyCaptcha } from '@/lib/turnstile'
import { sendSupportTicketEmails } from '@/lib/email'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n/locales'

const BUCKET = 'support-attachments'
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB
const ATTACHMENT_TTL_SECONDS = 7 * 24 * 3600 // signed link lives a week for the admin email

/** Accepted attachment types → canonical extension. */
const ALLOWED_TYPES = new Map<string, string>([
  ['application/pdf', 'pdf'],
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['application/msword', 'doc'],
])

const MAGIC_NUMBERS = [
  [0x25, 0x50, 0x44, 0x46], // %PDF
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // PNG
  [0xff, 0xd8, 0xff], // JPEG
  [0x50, 0x4b, 0x03, 0x04], // PK (ZIP / DOCX)
  [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], // OLE2 (DOC)
]

function hasValidMagicNumber(buf: ArrayBuffer): boolean {
  const view = new Uint8Array(buf, 0, Math.min(8, buf.byteLength))
  return MAGIC_NUMBERS.some((bytes) => bytes.every((b, i) => view[i] === b))
}

// Light in-memory rate limit (per feedback: generous, no external store).
const HOUR_MS = 60 * 60 * 1000
const MAX_PER_HOUR = 5
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function underLimit(key: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + HOUR_MS })
    return true
  }
  if (entry.count >= MAX_PER_HOUR) return false
  entry.count += 1
  return true
}

function fail(code: SupportError): ActionResult<{ id: string }> {
  return { success: false, error: code }
}

/**
 * Handles both the in-app (logged-in) and the public support form. Logged-in
 * submissions derive the email + org from the session; public submissions must
 * supply an email and pass Turnstile. Optional attachment is validated by
 * MIME + magic number + size, stored in a private bucket, and linked (signed)
 * in the admin notification. Writes go through the admin client (the table is
 * RLS-locked). Errors are returned as machine CODES, localized in the form.
 */
export async function submitSupportTicket(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const subject = String(formData.get('subject') ?? '')
  const message = String(formData.get('message') ?? '')
  const emailField = formData.get('email') ? String(formData.get('email')) : null
  const captchaToken = formData.get('cf_turnstile_token')
    ? String(formData.get('cf_turnstile_token'))
    : null
  const file = formData.get('file')

  // Resolve the session (may be absent → public path).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let organizationId: string | null = null
  let userId: string | null = null
  let source: 'app' | 'public' = 'public'
  let submitterEmail: string | null = null

  if (user) {
    userId = user.id
    submitterEmail = user.email ?? null
    source = 'app'
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()
    organizationId = (profile?.organization_id as string | undefined) ?? null
  } else {
    submitterEmail = emailField
  }

  const requireEmail = !user
  const validationError = validateSupportInput({ subject, message, email: submitterEmail, requireEmail })
  if (validationError) return fail(validationError)
  // validateSupportInput guarantees a non-empty email when requireEmail; for
  // logged-in users the session email is present.
  if (!submitterEmail) return fail('email_required')
  const email = submitterEmail.trim()

  // Rate limit — keyed by user, or IP+email for the public form.
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  if (!underLimit(userId ?? `${ip ?? 'anon'}:${email}`)) return fail('rate_limited')

  // Public form must pass captcha (fails open only if TURNSTILE_SECRET_KEY unset).
  if (!user) {
    const ok = await verifyCaptcha(captchaToken, ip)
    if (!ok) return fail('captcha_failed')
  }

  const admin = createAdminClient()

  // Optional attachment.
  let attachmentPath: string | null = null
  let attachmentName: string | null = null
  if (file instanceof File && file.size > 0) {
    const ext = ALLOWED_TYPES.get(file.type)
    if (!ext) return fail('file_type')
    if (file.size > MAX_FILE_BYTES) return fail('file_size')
    const bytes = await file.arrayBuffer()
    if (!hasValidMagicNumber(bytes)) return fail('file_type')
    const path = `${organizationId ?? 'public'}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: false })
    if (uploadError) {
      console.error('[support] attachment upload failed:', uploadError.message)
      return fail('upload_failed')
    }
    attachmentPath = path
    attachmentName = file.name
  }

  const { data, error: dbError } = await admin
    .from('support_tickets')
    .insert({
      organization_id: organizationId,
      user_id: userId,
      email,
      subject: subject.trim(),
      message: message.trim(),
      attachment_path: attachmentPath,
      attachment_name: attachmentName,
      source,
    })
    .select('id')
    .single()

  if (dbError || !data) {
    console.error('[support] ticket insert failed:', dbError?.message)
    if (attachmentPath) await admin.storage.from(BUCKET).remove([attachmentPath])
    return fail('save_failed')
  }

  // Emails are best-effort — a mail hiccup must not lose a saved ticket.
  const localeRaw = await getLocale()
  const locale: Locale = isLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE
  let attachmentUrl: string | null = null
  if (attachmentPath) {
    const { data: signed } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(attachmentPath, ATTACHMENT_TTL_SECONDS)
    attachmentUrl = signed?.signedUrl ?? null
  }
  try {
    await sendSupportTicketEmails({
      ticketId: data.id,
      subject: subject.trim(),
      message: message.trim(),
      submitterEmail: email,
      source,
      organizationId,
      attachmentName,
      attachmentUrl,
      locale,
    })
  } catch (err) {
    console.error('[support] email send failed (ticket saved):', err)
  }

  return { success: true, data: { id: data.id } }
}
