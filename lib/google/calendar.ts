import { env } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'

const OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const SCOPE_CALENDAR_EVENTS = 'https://www.googleapis.com/auth/calendar.events'
const SCOPE_USERINFO_EMAIL = 'https://www.googleapis.com/auth/userinfo.email'

export function getGoogleOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: `${SCOPE_CALENDAR_EVENTS} ${SCOPE_USERINFO_EMAIL}`,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${OAUTH_AUTH_URL}?${params}`
}

export function getRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return `${base}/api/auth/google/callback`
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
  scope?: string
} | null> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    console.error('[google/calendar] exchangeCodeForTokens: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured')
    return null
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: getRedirectUri(),
      code,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    let bodyExcerpt = ''
    try {
      bodyExcerpt = (await res.text()).slice(0, 500)
    } catch {
      /* swallow */
    }
    console.error(
      `[google/calendar] exchangeCodeForTokens failed: ${res.status} ${res.statusText} (redirect_uri=${getRedirectUri()})`,
      bodyExcerpt,
    )
    return null
  }
  return res.json()
}

/**
 * Returns true if the granted `scope` string from a token-exchange response
 * includes the scopes needed to create Calendar events with Meet conferences.
 */
export function hasRequiredCalendarScopes(scope: string | undefined | null): boolean {
  if (!scope) return false
  const granted = new Set(scope.split(/\s+/))
  return granted.has(SCOPE_CALENDAR_EVENTS) || granted.has('https://www.googleapis.com/auth/calendar')
}

/**
 * Revoke a Google OAuth token upstream. Per Google's docs, passing the refresh
 * token revokes the entire grant (including any issued access tokens), so pass
 * the refresh token in preference to an access token.
 *
 * Treats 200 and 400 as success: 200 is a real revoke, 400 means the token was
 * already invalid (revoked, expired, or unknown). Either way the goal state —
 * "this token is dead" — is reached. Anything else throws so the caller can log.
 */
export async function revokeGoogleToken(token: string): Promise<void> {
  const res = await fetch(REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }).toString(),
  })
  if (res.status === 200 || res.status === 400) return
  throw new Error(`google revoke failed: HTTP ${res.status}`)
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expiry: number } | null> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) return null
  const data = await res.json()
  return {
    access_token: data.access_token,
    expiry: Date.now() + data.expires_in * 1000,
  }
}

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('google_access_token, google_refresh_token, google_token_expiry')
    .eq('id', userId)
    .single()

  if (!profile?.google_refresh_token) return null

  const expiry = profile.google_token_expiry as number | null
  const isExpired = !expiry || Date.now() > expiry - 60_000

  if (!isExpired && profile.google_access_token) {
    return profile.google_access_token as string
  }

  const refreshed = await refreshAccessToken(profile.google_refresh_token as string)
  if (!refreshed) return null

  await supabase
    .from('profiles')
    .update({ google_access_token: refreshed.access_token, google_token_expiry: refreshed.expiry })
    .eq('id', userId)

  return refreshed.access_token
}

export async function createCalendarEventWithMeet(
  accessToken: string,
  {
    requestId,
    summary,
    description,
    startIso,
    endIso,
    attendeeEmails,
  }: {
    requestId: string
    summary: string
    description: string
    startIso: string
    endIso: string
    attendeeEmails: string[]
  }
): Promise<{ meetLink: string | null; eventId: string | null }> {
  const event = {
    summary,
    description,
    start: { dateTime: startIso, timeZone: 'UTC' },
    end: { dateTime: endIso, timeZone: 'UTC' },
    attendees: attendeeEmails.map((email) => ({ email })),
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  }

  const res = await fetch(`${CALENDAR_API}?conferenceDataVersion=1`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  })

  if (!res.ok) {
    // Log the Google API response so failures (auth, quota, malformed event)
    // are diagnosable in production. Body is best-effort — drop if it's not
    // parseable.
    let bodyExcerpt = ''
    try {
      bodyExcerpt = (await res.text()).slice(0, 500)
    } catch {
      /* swallow */
    }
    console.error(
      `[google/calendar] createCalendarEventWithMeet failed: ${res.status} ${res.statusText}`,
      bodyExcerpt,
    )
    return { meetLink: null, eventId: null }
  }

  const data = await res.json()
  const meetLink =
    data.conferenceData?.entryPoints?.find((ep: { entryPointType: string; uri: string }) => ep.entryPointType === 'video')?.uri ?? null

  return { meetLink, eventId: data.id ?? null }
}

export async function deleteCalendarEvent(accessToken: string, eventId: string): Promise<void> {
  await fetch(`${CALENDAR_API}/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}
