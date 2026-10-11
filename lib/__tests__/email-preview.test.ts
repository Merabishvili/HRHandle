import { describe, it, expect } from 'vitest'
import { fillPreview, previewSamples } from '@/lib/email-preview'

// A translator that returns the key, so the test shows which sample fills which placeholder.
const samples = previewSamples((key) => `<${key.replace('emailTpl.sample.', '')}>`)

describe('email template preview', () => {
  it('fills every occurrence of each placeholder with the sample in the interface language', () => {
    expect(fillPreview('{{role}} at {{company}} — the {{role}} team', samples)).toBe(
      '<role> at <company> — the <role> team',
    )
  })

  it('uses the interviewer sample for the sender of a rejection', () => {
    expect(fillPreview('{{sender_name}} ({{sender_email}})', samples)).toBe('<interviewerName> (<interviewerEmail>)')
  })

  it('leaves unknown placeholders as typed', () => {
    expect(fillPreview('Hi {{nickname}}', samples)).toBe('Hi {{nickname}}')
  })
})
