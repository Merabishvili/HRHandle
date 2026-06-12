import 'server-only'

const API_BASE = 'https://api.calendly.com'

export interface CalendlyTokens {
  access_token: string
  refresh_token: string
  expires_in: number // seconds
  token_type: string
}

export interface CalendlyUser {
  uri: string // e.g. https://api.calendly.com/users/AAA...
  name: string
  email: string
  scheduling_url: string
  current_organization: string
}

export interface CalendlyEventType {
  uri: string
  name: string
  active: boolean
  scheduling_url: string
  duration: number
  slug: string
}

export interface CalendlyWebhookSubscription {
  uri: string
  signing_key: string
}

async function callApi<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Calendly API ${path} → HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  return (await res.json()) as T
}

/** GET /users/me — current user info. */
export async function getCurrentUser(accessToken: string): Promise<CalendlyUser> {
  const data = await callApi<{ resource: CalendlyUser }>('/users/me', accessToken)
  return data.resource
}

/** GET /event_types?user=<uri>&active=true — list user's event types. */
export async function listEventTypes(
  accessToken: string,
  userUri: string
): Promise<CalendlyEventType[]> {
  const qs = new URLSearchParams({ user: userUri, active: 'true' }).toString()
  const data = await callApi<{ collection: CalendlyEventType[] }>(
    `/event_types?${qs}`,
    accessToken
  )
  return data.collection
}

export async function createUserWebhookSubscription(
  accessToken: string,
  input: {
    url: string
    userUri: string
    organizationUri: string
    events: string[] // e.g. ['invitee.created', 'invitee.canceled']
  }
): Promise<CalendlyWebhookSubscription> {
  const data = await callApi<{ resource: CalendlyWebhookSubscription }>(
    '/webhook_subscriptions',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        url: input.url,
        events: input.events,
        organization: input.organizationUri,
        user: input.userUri,
        scope: 'user',
      }),
    }
  )
  return data.resource
}

export async function deleteWebhookSubscription(
  accessToken: string,
  subscriptionUri: string
): Promise<void> {
  // subscriptionUri is the full URI; we only need the path tail.
  const path = subscriptionUri.replace(API_BASE, '')
  await callApi<void>(path, accessToken, { method: 'DELETE' })
}

/** GET an arbitrary URI (for hydrating webhook payload event_type / scheduled_event). */
export async function getResourceByUri<T>(accessToken: string, uri: string): Promise<T> {
  const path = uri.replace(API_BASE, '')
  return callApi<T>(path, accessToken)
}
