import { describe, it, expect } from 'vitest'
import { buildCalendlyLink, applicationIdFromTracking } from '@/lib/calendly/link-builder'

describe('buildCalendlyLink', () => {
  it('appends UTM tracking with the application id', () => {
    const url = buildCalendlyLink({
      schedulingUrl: 'https://calendly.com/jane/intro',
      applicationId: '11111111-1111-4111-8111-111111111111',
    })
    const u = new URL(url)
    expect(u.searchParams.get('utm_source')).toBe('hrhandle')
    expect(u.searchParams.get('utm_medium')).toBe('recruiter_link')
    expect(u.searchParams.get('utm_content')).toBe('11111111-1111-4111-8111-111111111111')
  })

  it('pre-fills candidate name and email when provided', () => {
    const url = buildCalendlyLink({
      schedulingUrl: 'https://calendly.com/jane/intro',
      applicationId: '11111111-1111-4111-8111-111111111111',
      candidateName: 'Alex Doe',
      candidateEmail: 'alex@example.com',
    })
    const u = new URL(url)
    expect(u.searchParams.get('name')).toBe('Alex Doe')
    expect(u.searchParams.get('email')).toBe('alex@example.com')
  })

  it('omits name/email when null', () => {
    const url = buildCalendlyLink({
      schedulingUrl: 'https://calendly.com/jane/intro',
      applicationId: '11111111-1111-4111-8111-111111111111',
      candidateName: null,
      candidateEmail: null,
    })
    const u = new URL(url)
    expect(u.searchParams.has('name')).toBe(false)
    expect(u.searchParams.has('email')).toBe(false)
  })

  it('throws on malformed scheduling URL', () => {
    expect(() =>
      buildCalendlyLink({ schedulingUrl: 'not-a-url', applicationId: 'x' })
    ).toThrow()
  })

  it('preserves an existing query string', () => {
    const url = buildCalendlyLink({
      schedulingUrl: 'https://calendly.com/jane/intro?foo=bar',
      applicationId: '11111111-1111-4111-8111-111111111111',
    })
    const u = new URL(url)
    expect(u.searchParams.get('foo')).toBe('bar')
  })
})

describe('applicationIdFromTracking', () => {
  it('returns null for missing tracking', () => {
    expect(applicationIdFromTracking(null)).toBe(null)
    expect(applicationIdFromTracking(undefined)).toBe(null)
    expect(applicationIdFromTracking({})).toBe(null)
    expect(applicationIdFromTracking({ utm_content: null })).toBe(null)
  })

  it('returns the utm_content value when it looks like a UUID', () => {
    expect(
      applicationIdFromTracking({ utm_content: '11111111-1111-4111-8111-111111111111' })
    ).toBe('11111111-1111-4111-8111-111111111111')
  })

  it('returns null for utm_content that does not look like an ID', () => {
    expect(applicationIdFromTracking({ utm_content: 'short' })).toBe(null)
  })
})
