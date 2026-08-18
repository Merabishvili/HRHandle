import { env } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'

const AUTH_BASE = 'https://login.microsoftonline.com/common/oauth2/v2.0'
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
const SCOPES = 'Calendars.ReadWrite OnlineMeetings.ReadWrite offline_access'

export function getMicrosoftRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return `${base}/api/auth/microsoft/callback`
}

export function getMicrosoftOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID ?? '',
    response_type: 'code',
    redirect_uri: getMicrosoftRedirectUri(),
    scope: SCOPES,
    response_mode: 'query',
    state,
  })
  return `${AUTH_BASE}/authorize?${params}`
}

export async function exchangeMicrosoftCode(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
} | null> {
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
    console.error('[microsoft/graph] exchangeMicrosoftCode: MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET not configured')
    return null
  }

  const res = await fetch(`${AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID,
      client_secret: env.MICROSOFT_CLIENT_SECRET,
      redirect_uri: getMicrosoftRedirectUri(),
      code,
      grant_type: 'authorization_code',
      scope: SCOPES,
    }),
  })

  if (!res.ok) {
    // Surface the real Azure error (AADSTS…) instead of swallowing it — the
    // most common causes here are an invalid/expired client secret and a
    // redirect_uri that isn't registered on the Azure app. See the operator
    // checklist in docs/4-integrations/microsoft.md.
    let bodyExcerpt = ''
    try {
      bodyExcerpt = (await res.text()).slice(0, 500)
    } catch {
      /* swallow */
    }
    console.error(
      `[microsoft/graph] exchangeMicrosoftCode failed: ${res.status} ${res.statusText} (redirect_uri=${getMicrosoftRedirectUri()})`,
      bodyExcerpt,
    )
    return null
  }
  return res.json()
}

async function refreshMicrosoftToken(
  refreshToken: string
): Promise<{ access_token: string; expiry: number } | null> {
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) return null

  const res = await fetch(`${AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID,
      client_secret: env.MICROSOFT_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: SCOPES,
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
      `[microsoft/graph] refreshMicrosoftToken failed: ${res.status} ${res.statusText}`,
      bodyExcerpt,
    )
    return null
  }
  const data = await res.json()
  return {
    access_token: data.access_token,
    expiry: Date.now() + data.expires_in * 1000,
  }
}

export async function getValidMicrosoftAccessToken(userId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('microsoft_access_token, microsoft_refresh_token, microsoft_token_expiry')
    .eq('id', userId)
    .single()

  if (!profile?.microsoft_refresh_token) return null

  const expiry = profile.microsoft_token_expiry as number | null
  const isExpired = !expiry || Date.now() > expiry - 60_000

  if (!isExpired && profile.microsoft_access_token) {
    return profile.microsoft_access_token as string
  }

  const refreshed = await refreshMicrosoftToken(profile.microsoft_refresh_token as string)
  if (!refreshed) return null

  await supabase
    .from('profiles')
    .update({
      microsoft_access_token: refreshed.access_token,
      microsoft_token_expiry: refreshed.expiry,
    })
    .eq('id', userId)

  return refreshed.access_token
}

export async function createTeamsMeeting(
  accessToken: string,
  {
    summary,
    description,
    startIso,
    endIso,
    attendeeEmails,
  }: {
    summary: string
    description: string
    startIso: string
    endIso: string
    attendeeEmails: string[]
  }
): Promise<{ teamsLink: string | null; eventId: string | null }> {
  const event = {
    subject: summary,
    body: { contentType: 'text', content: description },
    start: { dateTime: startIso, timeZone: 'UTC' },
    end: { dateTime: endIso, timeZone: 'UTC' },
    attendees: attendeeEmails.map((email) => ({
      emailAddress: { address: email },
      type: 'required',
    })),
    isOnlineMeeting: true,
    onlineMeetingProvider: 'teamsForBusiness',
  }

  const res = await fetch(`${GRAPH_BASE}/me/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  })

  if (!res.ok) return { teamsLink: null, eventId: null }

  const data = await res.json()
  const teamsLink = data.onlineMeeting?.joinUrl ?? null

  return { teamsLink, eventId: data.id ?? null }
}

export async function deleteMicrosoftEvent(accessToken: string, eventId: string): Promise<void> {
  await fetch(`${GRAPH_BASE}/me/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}
