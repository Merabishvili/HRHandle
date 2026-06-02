import { env } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'

const TOKEN_URL = 'https://zoom.us/oauth/token'
const REVOKE_URL = 'https://zoom.us/oauth/revoke'
const MEETINGS_API = 'https://api.zoom.us/v2/users/me/meetings'

export function getZoomRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return `${base}/api/auth/zoom/callback`
}

export function getZoomOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.ZOOM_CLIENT_ID ?? '',
    redirect_uri: getZoomRedirectUri(),
    state,
  })
  return `https://zoom.us/oauth/authorize?${params}`
}

function getBasicAuthHeader(): string {
  return Buffer.from(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`).toString('base64')
}

export async function exchangeZoomCode(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
} | null> {
  if (!env.ZOOM_CLIENT_ID || !env.ZOOM_CLIENT_SECRET) return null

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${getBasicAuthHeader()}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getZoomRedirectUri(),
    }),
  })

  if (!res.ok) return null
  return res.json()
}

/**
 * Revoke a Zoom OAuth token upstream. Per Zoom's docs the endpoint accepts an
 * access token (refresh tokens are not the right input here, unlike Google).
 *
 * Treats 200 and 400 as success: 200 confirms the revoke (Zoom returns
 * `{"status":"success"}`); 400 means the token was already invalid. Either way
 * the goal state — "this token is dead upstream" — is reached. Anything else
 * throws so the caller can log.
 *
 * Throws when client credentials are missing (the route's caller should not
 * call this in that case).
 */
export async function revokeZoomToken(token: string): Promise<void> {
  if (!env.ZOOM_CLIENT_ID || !env.ZOOM_CLIENT_SECRET) {
    throw new Error('zoom credentials not configured')
  }
  const res = await fetch(REVOKE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${getBasicAuthHeader()}`,
    },
    body: new URLSearchParams({ token }).toString(),
  })
  if (res.status === 200 || res.status === 400) return
  throw new Error(`zoom revoke failed: HTTP ${res.status}`)
}

async function refreshZoomToken(
  refreshToken: string
): Promise<{ access_token: string; expiry: number } | null> {
  if (!env.ZOOM_CLIENT_ID || !env.ZOOM_CLIENT_SECRET) return null

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${getBasicAuthHeader()}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) return null
  const data = await res.json()
  return {
    access_token: data.access_token,
    expiry: Date.now() + data.expires_in * 1000,
  }
}

export async function getValidZoomAccessToken(userId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('zoom_access_token, zoom_refresh_token, zoom_token_expiry')
    .eq('id', userId)
    .single()

  if (!profile?.zoom_refresh_token) return null

  const expiry = profile.zoom_token_expiry as number | null
  const isExpired = !expiry || Date.now() > expiry - 60_000

  if (!isExpired && profile.zoom_access_token) {
    return profile.zoom_access_token as string
  }

  const refreshed = await refreshZoomToken(profile.zoom_refresh_token as string)
  if (!refreshed) return null

  await supabase
    .from('profiles')
    .update({ zoom_access_token: refreshed.access_token, zoom_token_expiry: refreshed.expiry })
    .eq('id', userId)

  return refreshed.access_token
}

export async function createZoomMeeting(
  accessToken: string,
  {
    topic,
    startIso,
    durationMinutes,
  }: {
    topic: string
    startIso: string
    durationMinutes: number
  }
): Promise<{ joinUrl: string; meetingId: string } | null> {
  const res = await fetch(MEETINGS_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic,
      type: 2,
      start_time: startIso,
      duration: durationMinutes,
      settings: {
        join_before_host: true,
        waiting_room: false,
      },
    }),
  })

  if (!res.ok) return null
  const data = await res.json()
  return { joinUrl: data.join_url, meetingId: String(data.id) }
}

export async function deleteZoomMeeting(
  accessToken: string,
  meetingId: string
): Promise<boolean> {
  const res = await fetch(`${MEETINGS_API.replace('/users/me/meetings', '/meetings')}/${meetingId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  // 204 = deleted, 404 = already gone, treat both as success.
  return res.ok || res.status === 404
}

/**
 * Parse a Zoom meeting ID out of a join URL like
 * `https://us02web.zoom.us/j/82345678901?pwd=…`. Returns null if the URL is
 * not a recognisable Zoom join URL.
 */
export function parseZoomMeetingIdFromJoinUrl(joinUrl: string | null): string | null {
  if (!joinUrl) return null
  const match = joinUrl.match(/zoom\.us\/(?:j|s|w)\/(\d{9,12})/)
  return match ? match[1] : null
}
