import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the env module so revokeZoomToken can read fake credentials without
// involving t3-oss validation at module load time.
vi.mock('@/lib/env', () => ({
  env: {
    ZOOM_CLIENT_ID: 'test-zoom-client-id',
    ZOOM_CLIENT_SECRET: 'test-zoom-client-secret',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
  },
}))

// Mock the admin client — revokeGoogleToken/revokeZoomToken don't use it,
// but the modules they live in (calendar.ts / meetings.ts) import it, and we
// don't want any accidental Supabase URL/keys validation during the test.
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({}),
}))

import { revokeGoogleToken } from '@/lib/google/calendar'
import { revokeZoomToken } from '@/lib/zoom/meetings'

const originalFetch = global.fetch

function mockFetchOnce(status: number, body: unknown = {}) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch
}

describe('revokeGoogleToken', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('resolves silently on 200 (real revoke)', async () => {
    mockFetchOnce(200)
    await expect(revokeGoogleToken('refresh-tok')).resolves.toBeUndefined()
  })

  it('treats 400 as success (token already revoked / unknown)', async () => {
    mockFetchOnce(400, { error: 'invalid_token' })
    await expect(revokeGoogleToken('stale-tok')).resolves.toBeUndefined()
  })

  it('throws on any other status (caller logs and continues)', async () => {
    mockFetchOnce(500)
    await expect(revokeGoogleToken('any')).rejects.toThrow(/google revoke failed: HTTP 500/)
  })

  it('POSTs to Google revoke endpoint with token in body', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({}) })
    global.fetch = fetchMock as unknown as typeof fetch
    await revokeGoogleToken('the-token')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://oauth2.googleapis.com/revoke')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(init.body).toBe('token=the-token')
  })

  it('propagates network exceptions so the caller can log them', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('boom')) as unknown as typeof fetch
    await expect(revokeGoogleToken('tok')).rejects.toThrow('boom')
  })
})

describe('revokeZoomToken', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('resolves silently on 200 (real revoke)', async () => {
    mockFetchOnce(200, { status: 'success' })
    await expect(revokeZoomToken('access-tok')).resolves.toBeUndefined()
  })

  it('treats 400 as success (token already revoked)', async () => {
    mockFetchOnce(400, { error: 'invalid_token' })
    await expect(revokeZoomToken('stale-tok')).resolves.toBeUndefined()
  })

  it('throws on other failure statuses', async () => {
    mockFetchOnce(503)
    await expect(revokeZoomToken('any')).rejects.toThrow(/zoom revoke failed: HTTP 503/)
  })

  it('POSTs to Zoom revoke endpoint with Basic auth + token in body', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ status: 'success' }) })
    global.fetch = fetchMock as unknown as typeof fetch
    await revokeZoomToken('the-token')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://zoom.us/oauth/revoke')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(init.headers['Authorization']).toMatch(/^Basic /)
    // The Basic header should be Base64(client_id:client_secret).
    const expected = 'Basic ' + Buffer.from('test-zoom-client-id:test-zoom-client-secret').toString('base64')
    expect(init.headers['Authorization']).toBe(expected)
    expect(init.body).toBe('token=the-token')
  })

  it('propagates network exceptions', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('boom')) as unknown as typeof fetch
    await expect(revokeZoomToken('tok')).rejects.toThrow('boom')
  })
})
