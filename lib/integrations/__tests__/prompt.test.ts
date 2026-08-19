import { describe, it, expect } from 'vitest'
import { resolveIntegrationPrompt } from '@/lib/integrations/prompt'

const base = { hasGoogle: false, hasMicrosoft: false, dismissed: false }

describe('resolveIntegrationPrompt', () => {
  it('prompts Google for a Google signup with no Google connection', () => {
    expect(resolveIntegrationPrompt({ ...base, provider: 'google' })).toBe('google')
  })

  it('prompts Microsoft for an azure signup with no Microsoft connection', () => {
    expect(resolveIntegrationPrompt({ ...base, provider: 'azure' })).toBe('microsoft')
  })

  it('returns null once the matching integration is connected', () => {
    expect(resolveIntegrationPrompt({ ...base, provider: 'google', hasGoogle: true })).toBeNull()
    expect(resolveIntegrationPrompt({ ...base, provider: 'azure', hasMicrosoft: true })).toBeNull()
  })

  it('returns null when dismissed regardless of connection state', () => {
    expect(resolveIntegrationPrompt({ ...base, provider: 'google', dismissed: true })).toBeNull()
    expect(resolveIntegrationPrompt({ ...base, provider: 'azure', dismissed: true })).toBeNull()
  })

  it('never prompts email signups or unknown providers', () => {
    expect(resolveIntegrationPrompt({ ...base, provider: 'email' })).toBeNull()
    expect(resolveIntegrationPrompt({ ...base, provider: undefined })).toBeNull()
    expect(resolveIntegrationPrompt({ ...base, provider: null })).toBeNull()
  })

  it('does not cross providers (Google signup ignores Microsoft connection)', () => {
    // A Google user who happens to have Microsoft linked should still be nudged
    // to connect Google.
    expect(resolveIntegrationPrompt({ ...base, provider: 'google', hasMicrosoft: true })).toBe('google')
  })
})
