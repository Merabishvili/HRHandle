import { describe, it, expect } from 'vitest'
import type { Event } from '@sentry/nextjs'
import { scrubPii } from '@/lib/sentry-scrub'

describe('scrubPii', () => {
  it('redacts user.email + user.username + user.ip_address', () => {
    const event: Event = {
      user: { id: 'abc', email: 'alice@example.com', username: 'alice', ip_address: '1.2.3.4' },
    }
    const out = scrubPii(event)
    expect(out.user?.id).toBe('abc')
    expect(out.user?.email).toBe('[REDACTED]')
    expect(out.user?.username).toBe('[REDACTED]')
    expect(out.user?.ip_address).toBeUndefined()
  })

  it('redacts cookie/authorization headers but keeps benign ones', () => {
    const event: Event = {
      request: {
        headers: {
          cookie: 'sb-access=xxx',
          authorization: 'Bearer abc',
          'content-type': 'application/json',
        },
      },
    }
    const out = scrubPii(event)
    const headers = out.request!.headers as Record<string, string>
    expect(headers.cookie).toBe('[REDACTED]')
    expect(headers.authorization).toBe('[REDACTED]')
    expect(headers['content-type']).toBe('application/json')
  })

  it('redacts PII-keyed fields nested in request.data', () => {
    const event: Event = {
      request: {
        data: {
          payload: {
            first_name: 'Alice',
            last_name: 'Smith',
            email: 'a@b.com',
            phone: '555',
            note: 'sensitive',
            description: 'covered too',
            vacancy_id: 'keep-me',
          },
        },
      },
    }
    const out = scrubPii(event)
    const data = out.request!.data as Record<string, Record<string, string>>
    const p = data.payload!
    expect(p.first_name).toBe('[REDACTED]')
    expect(p.last_name).toBe('[REDACTED]')
    expect(p.email).toBe('[REDACTED]')
    expect(p.phone).toBe('[REDACTED]')
    expect(p.note).toBe('[REDACTED]')
    expect(p.description).toBe('[REDACTED]')
    expect(p.vacancy_id).toBe('keep-me')
  })

  it('redacts breadcrumb data', () => {
    const event: Event = {
      breadcrumbs: [
        {
          type: 'http',
          data: { email: 'a@b.com', url: '/api/x' },
        },
      ],
    }
    const out = scrubPii(event)
    expect(out.breadcrumbs?.[0]?.data?.email).toBe('[REDACTED]')
    expect(out.breadcrumbs?.[0]?.data?.url).toBe('/api/x')
  })

  it('handles deeply-nested arrays of PII without crashing', () => {
    const event: Event = {
      extra: {
        candidates: [
          { email: 'a@b.com', vacancy_id: 'v1' },
          { email: 'c@d.com', vacancy_id: 'v2' },
        ],
      },
    }
    const out = scrubPii(event)
    const extra = out.extra as { candidates: Array<{ email: string; vacancy_id: string }> }
    expect(extra.candidates[0]!.email).toBe('[REDACTED]')
    expect(extra.candidates[0]!.vacancy_id).toBe('v1')
    expect(extra.candidates[1]!.email).toBe('[REDACTED]')
  })

  it('replaces request.cookies entirely', () => {
    const event: Event = {
      request: { cookies: { 'sb-access': 'xxx', 'sb-refresh': 'yyy' } },
    }
    const out = scrubPii(event)
    expect(out.request?.cookies).toBe('[REDACTED]')
  })

  it('returns the event (never null) so observability is preserved', () => {
    const event: Event = { message: 'something failed' }
    expect(scrubPii(event)).toBe(event)
  })
})
