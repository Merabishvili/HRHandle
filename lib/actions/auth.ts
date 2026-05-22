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

const GENERIC_SUCCESS_MESSAGE =
  'If an account exists for that email, a reset link has been sent.'

const RATE_LIMIT_ERROR =
  'Too many password-reset requests. Please try again in an hour.'

export type RequestPasswordResetResult =
  | { success: true; message: string }
  | { success: false; error: string }

export async function requestPasswordReset(
  email: string,
  redirectTo: string,
): Promise<RequestPasswordResetResult> {
  const parsed = ResetSchema.safeParse({ email, redirectTo })
  if (!parsed.success) {
    return { success: false, error: 'Please enter a valid email address.' }
  }

  const normalisedEmail = parsed.data.email.trim().toLowerCase()

  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('x-real-ip') ||
    'unknown'

  if (ip !== 'unknown' && !checkLimit(`ip:${ip}`, MAX_RESET_REQUESTS_PER_IP_PER_HOUR)) {
    return { success: false, error: RATE_LIMIT_ERROR }
  }
  if (!checkLimit(`email:${normalisedEmail}`, MAX_RESET_REQUESTS_PER_EMAIL_PER_HOUR)) {
    return { success: false, error: RATE_LIMIT_ERROR }
  }

  // Implicit flow is required so the recovery email contains a plain OTP
  // (token_hash-verifiable server-side without a PKCE code verifier). See CLAUDE.md.
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: 'implicit' } },
  )

  await supabase.auth.resetPasswordForEmail(normalisedEmail, {
    redirectTo: parsed.data.redirectTo,
  })

  // Return the same response whether or not the email exists, to prevent enumeration.
  return { success: true, message: GENERIC_SUCCESS_MESSAGE }
}
