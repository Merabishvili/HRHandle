'use server'

import { headers } from 'next/headers'
import { createBrowserClient } from '@supabase/ssr'
import { z } from 'zod'

const MAX_RESET_REQUESTS_PER_IP_PER_HOUR = 5
const MAX_RESET_REQUESTS_PER_EMAIL_PER_HOUR = 5
const HOUR_MS = 60 * 60 * 1000

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkLimit(key: string, max: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + HOUR_MS })
    return true
  }
  if (entry.count >= max) return false
  entry.count++
  return true
}

const ResetSchema = z.object({
  email: z.string().email(),
  redirectTo: z.string().url(),
})

// The action returns a reason CODE, not a display string — the (client) page
// localizes it. Keeps all copy in the i18n catalog (see #14).
export type RequestPasswordResetResult =
  | { success: true }
  | { success: false; reason: 'invalid_email' | 'rate_limit' | 'captcha' }

export async function requestPasswordReset(
  email: string,
  redirectTo: string,
  captchaToken?: string | null,
): Promise<RequestPasswordResetResult> {
  const parsed = ResetSchema.safeParse({ email, redirectTo })
  if (!parsed.success) {
    return { success: false, reason: 'invalid_email' }
  }

  const normalisedEmail = parsed.data.email.trim().toLowerCase()

  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('x-real-ip') ||
    'unknown'

  if (ip !== 'unknown' && !checkLimit(`ip:${ip}`, MAX_RESET_REQUESTS_PER_IP_PER_HOUR)) {
    return { success: false, reason: 'rate_limit' }
  }
  if (!checkLimit(`email:${normalisedEmail}`, MAX_RESET_REQUESTS_PER_EMAIL_PER_HOUR)) {
    return { success: false, reason: 'rate_limit' }
  }

  // Implicit flow is required so the recovery email contains a plain OTP
  // (token_hash-verifiable server-side without a PKCE code verifier). See CLAUDE.md.
  //
  // This "browser" client runs inside a server action (a stateless HTTP wrapper,
  // not a real browser). @supabase/ssr's createBrowserClient needs cookie
  // methods and, in a non-browser runtime, THROWS
  // "createBrowserClient in non-browser runtimes … needs getAll/setAll" the
  // moment GoTrue's storage init reads cookies. Requesting a reset email needs
  // no existing session, so we pass STATELESS no-op cookie methods: read
  // nothing, persist nothing. Do not remove — without them this action crashes.
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { flowType: 'implicit' },
      cookies: { getAll: () => [], setAll: () => {} },
    },
  )

  // Supabase's CAPTCHA protection (enabled in the dashboard) guards the
  // /recover endpoint, so the Turnstile token must be forwarded HERE. A
  // Turnstile token is single-use, so we no longer verify it ourselves first
  // (that consumed it and made Supabase reject the reset → no email sent).
  const { error } = await supabase.auth.resetPasswordForEmail(normalisedEmail, {
    redirectTo: parsed.data.redirectTo,
    ...(captchaToken ? { captchaToken } : {}),
  })

  // Surface a real captcha failure so the user can retry — don't bury it under
  // the generic message (that's why "no email" looked like success before).
  if (error && /captcha/i.test(`${error.code ?? ''} ${error.message}`)) {
    return { success: false, reason: 'captcha' }
  }

  // Otherwise return the same response whether or not the email exists (and even
  // on other soft errors), to prevent account enumeration.
  return { success: true }
}
