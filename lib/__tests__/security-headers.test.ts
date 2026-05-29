import { describe, it, expect } from 'vitest'
import { buildCsp, generateNonce } from '@/lib/security-headers'

function directive(csp: string, name: string): string {
  return csp.split('; ').find((d) => d.startsWith(name)) ?? ''
}

describe('buildCsp', () => {
  const csp = buildCsp('test-nonce')

  it('embeds the per-request nonce in script-src', () => {
    expect(directive(csp, 'script-src')).toContain("'nonce-test-nonce'")
  })

  it('allow-lists PostHog EU hosts in connect-src (required for ingestion)', () => {
    const connectSrc = directive(csp, 'connect-src')
    expect(connectSrc).toContain('https://eu.i.posthog.com')
    expect(connectSrc).toContain('https://eu-assets.i.posthog.com')
  })

  it('allow-lists the PostHog assets host in script-src (legacy fallback)', () => {
    expect(directive(csp, 'script-src')).toContain('https://eu-assets.i.posthog.com')
  })

  it('preserves existing Sentry and Supabase hosts in connect-src', () => {
    const connectSrc = directive(csp, 'connect-src')
    expect(connectSrc).toContain('https://*.sentry.io')
    expect(connectSrc).toContain('https://*.supabase.co')
  })
})

describe('generateNonce', () => {
  it('returns a non-empty, unique value per call', () => {
    const a = generateNonce()
    const b = generateNonce()
    expect(a.length).toBeGreaterThan(0)
    expect(a).not.toBe(b)
  })
})
