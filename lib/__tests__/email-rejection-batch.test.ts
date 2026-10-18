import { describe, it, expect, vi, beforeEach } from 'vitest'

const { batchSend } = vi.hoisted(() => ({ batchSend: vi.fn() }))
vi.mock('resend', () => ({
  Resend: class {
    batch = { send: batchSend }
    emails = { send: vi.fn() }
  },
}))

import { buildApplicationRejectionEmail, sendApplicationRejectionEmails } from '@/lib/email'

const input = (i: number, email = `c${i}@x.ge`) => ({
  to: email,
  candidateName: `Candidate ${i}`,
  vacancyTitle: 'Senior Engineer',
  organizationName: 'Acme',
  senderName: 'Emily Carter',
  senderEmail: 'emily@acme.ge',
  contentLocale: 'en' as const,
})

beforeEach(() => {
  process.env.RESEND_API_KEY = 'test'
  batchSend.mockReset()
})

describe('sendApplicationRejectionEmails', () => {
  it('sends up to 100 emails per request', async () => {
    batchSend.mockResolvedValue({ data: { data: [], errors: [] }, error: null })
    const result = await sendApplicationRejectionEmails(Array.from({ length: 205 }, (_, i) => input(i)))
    expect(batchSend.mock.calls.map((c) => (c[0] as unknown[]).length)).toEqual([100, 100, 5])
    expect(batchSend.mock.calls[0]![1]).toEqual({ batchValidation: 'permissive' })
    expect(result).toEqual({ sent: 205, failed: 0 })
  })

  it('counts the emails Resend rejects, and a failed request as all failed', async () => {
    batchSend
      .mockResolvedValueOnce({ data: { data: [{ id: 'a' }], errors: [{ index: 1, message: 'bad address' }] }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'rate limited' } })
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const first = await sendApplicationRejectionEmails([input(1), input(2)])
    const second = await sendApplicationRejectionEmails([input(3)])
    err.mockRestore()
    expect(first).toEqual({ sent: 1, failed: 1 })
    expect(second).toEqual({ sent: 0, failed: 1 })
  })

  it('makes no request for an empty list', async () => {
    expect(await sendApplicationRejectionEmails([])).toEqual({ sent: 0, failed: 0 })
    expect(batchSend).not.toHaveBeenCalled()
  })
})

describe('buildApplicationRejectionEmail', () => {
  it('personalizes the default text and replies to the sender', () => {
    const email = buildApplicationRejectionEmail(input(7))
    expect(email.to).toBe('c7@x.ge')
    expect(email.replyTo).toBe('emily@acme.ge')
    expect(email.subject).toBe('An update from Acme — Senior Engineer')
    expect(email.html).toContain('Candidate 7')
    expect(email.html).toContain('Senior Engineer role at Acme')
  })

  it('leaves out reply-to when the sender has no email', () => {
    expect('replyTo' in buildApplicationRejectionEmail({ ...input(1), senderEmail: '' })).toBe(false)
  })
})
