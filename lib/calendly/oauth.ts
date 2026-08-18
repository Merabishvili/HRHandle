import 'server-only'
import { env } from '@/lib/env'
import type { CalendlyTokens } from './client'

const AUTH_URL = 'https://auth.calendly.com/oauth/authorize'
const TOKEN_URL = 'https://auth.calendly.com/oauth/token'
const REVOKE_URL = 'https://auth.calendly.com/oauth/revoke'

export function isCalendlyConfigured(): boolean {
  return Boolean(env.CALENDLY_CLIENT_ID && env.CALENDLY_CLIENT_SECRET)
}

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  if (!env.CALENDLY_CLIENT_ID) throw new Error('CALENDLY_CLIENT_ID not configured')
  const params = new URLSearchParams({
    client_id: env.CALENDLY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
  })
  return `${AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<CalendlyTokens> {
  if (!env.CALENDLY_CLIENT_ID || !env.CALENDLY_CLIENT_SECRET) {
    throw new Error('Calendly OAuth secrets not configured')
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: env.CALENDLY_CLIENT_ID,
      client_secret: env.CALENDLY_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Calendly token exchange failed: HTTP ${res.status} ${text.slice(0, 200)}`)
  }
  return (await res.json()) as CalendlyTokens
}

export async function refreshAccessToken(refreshToken: string): Promise<CalendlyTokens> {
  if (!env.CALENDLY_CLIENT_ID || !env.CALENDLY_CLIENT_SECRET) {
    throw new Error('Calendly OAuth secrets not configured')
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.CALENDLY_CLIENT_ID,
      client_secret: env.CALENDLY_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Calendly token refresh failed: HTTP ${res.status} ${text.slice(0, 200)}`)
  }
  return (await res.json()) as CalendlyTokens
}

/** Best-effort token revoke. Errors are swallowed (we still NULL local row). */
export async function revokeToken(token: string): Promise<void> {
  if (!env.CALENDLY_CLIENT_ID || !env.CALENDLY_CLIENT_SECRET) return
  try {
    await fetch(REVOKE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.CALENDLY_CLIENT_ID,
        client_secret: env.CALENDLY_CLIENT_SECRET,
        token,
      }),
    })
  } catch (err) {
    console.error('[calendly] revoke failed (best-effort):', err)
  }
}
