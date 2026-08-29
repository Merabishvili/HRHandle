// Pure validation for the support-ticket form, shared by the server action and
// unit tests. Returns a machine error CODE (localized client-side) or null.

export const SUBJECT_MIN = 3
export const SUBJECT_MAX = 200
export const MESSAGE_MIN = 10
export const MESSAGE_MAX = 5000
export const MAX_ATTACHMENTS = 3

export type SupportError =
  | 'subject_required'
  | 'subject_too_long'
  | 'message_required'
  | 'message_too_long'
  | 'email_required'
  | 'email_invalid'
  | 'file_type'
  | 'file_size'
  | 'too_many_files'
  | 'rate_limited'
  | 'captcha_failed'
  | 'upload_failed'
  | 'save_failed'

export interface SupportInput {
  subject: string
  message: string
  /** Submitter email — required for public (logged-out) submissions. */
  email?: string | null
  /** True for the public form (no session to derive the email from). */
  requireEmail?: boolean
}

// Deliberately loose — just enough to catch obvious typos, not RFC-5322 strict.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateSupportInput(input: SupportInput): SupportError | null {
  const subject = (input.subject ?? '').trim()
  const message = (input.message ?? '').trim()

  if (subject.length < SUBJECT_MIN) return 'subject_required'
  if (subject.length > SUBJECT_MAX) return 'subject_too_long'
  if (message.length < MESSAGE_MIN) return 'message_required'
  if (message.length > MESSAGE_MAX) return 'message_too_long'

  if (input.requireEmail) {
    const email = (input.email ?? '').trim()
    if (!email) return 'email_required'
    if (email.length > 254 || !EMAIL_RE.test(email)) return 'email_invalid'
  }

  return null
}
