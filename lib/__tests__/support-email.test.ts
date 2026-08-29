import { describe, it, expect } from 'vitest'

import {
  ticketRef,
  buildSupportConfirmationEmail,
  buildSupportNotificationEmail,
} from '@/lib/email'

const TICKET_ID = 'a1b2c3d4-0000-0000-0000-000000000000'

describe('ticketRef', () => {
  it('takes the first UUID block, uppercased', () => {
    expect(ticketRef(TICKET_ID)).toBe('A1B2C3D4')
  })
})

describe('buildSupportConfirmationEmail', () => {
  it('localizes the subject + heading (ka) and echoes the message', () => {
    const { subject, html } = buildSupportConfirmationEmail({
      ticketId: TICKET_ID,
      subject: 'Cannot log in',
      message: 'Password reset never arrives.',
      locale: 'ka',
    })
    expect(subject).toContain('A1B2C3D4')
    expect(subject).toContain('მიღებულია')
    expect(html).toContain('Cannot log in')
    expect(html).toContain('Password reset never arrives.')
  })

  it('falls back to English for an unset locale', () => {
    const { subject } = buildSupportConfirmationEmail({
      ticketId: TICKET_ID,
      subject: 'x',
      message: 'y',
    })
    expect(subject).toContain('We received your request')
  })

  it('HTML-escapes user content (no injection)', () => {
    const { html } = buildSupportConfirmationEmail({
      ticketId: TICKET_ID,
      subject: '<script>alert(1)</script>',
      message: 'hi',
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('buildSupportNotificationEmail', () => {
  it('includes sender, source, subject and the ticket ref in the subject line', () => {
    const { subject, html } = buildSupportNotificationEmail({
      ticketId: TICKET_ID,
      subject: 'Billing question',
      message: 'When am I charged?',
      submitterEmail: 'user@example.com',
      source: 'public',
      organizationId: null,
    })
    expect(subject).toBe('[Support #A1B2C3D4] Billing question')
    expect(html).toContain('user@example.com')
    expect(html).toContain('Public form')
    expect(html).toContain('When am I charged?')
  })

  it('renders an attachment link only when both name + url are present', () => {
    const withAttachment = buildSupportNotificationEmail({
      ticketId: TICKET_ID,
      subject: 's',
      message: 'm',
      submitterEmail: 'a@b.com',
      source: 'app',
      organizationId: 'org-1',
      attachmentName: 'log.pdf',
      attachmentUrl: 'https://signed.example/log.pdf',
    })
    expect(withAttachment.html).toContain('log.pdf')
    expect(withAttachment.html).toContain('https://signed.example/log.pdf')

    const without = buildSupportNotificationEmail({
      ticketId: TICKET_ID,
      subject: 's',
      message: 'm',
      submitterEmail: 'a@b.com',
      source: 'app',
      organizationId: 'org-1',
    })
    expect(without.html).not.toContain('Attachment')
  })
})
