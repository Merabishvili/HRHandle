import { describe, it, expect } from 'vitest'
import { buildTeamInviteEmail } from '@/lib/email'

const base = {
  inviterName: 'Ana',
  organizationName: 'Acme',
  role: 'admin' as const,
  joinUrl: 'https://hrhandle.com/join?token=abc',
}

describe('buildTeamInviteEmail', () => {
  it('renders English by default', () => {
    const { subject, html } = buildTeamInviteEmail(base)
    expect(subject).toBe('Ana invited you to join Acme on HRHandle')
    expect(html).toContain("You've been invited")
    expect(html).toContain('Accept Invitation')
    expect(html).toContain('Admin')
    expect(html).toContain(base.joinUrl)
  })

  it('renders Georgian when the org content locale is ka', () => {
    const { subject, html } = buildTeamInviteEmail({ ...base, locale: 'ka' })
    expect(subject).toContain('მოგიწვიათ')
    expect(html).toContain('თქვენ მიწვეული ხართ')
    expect(html).toContain('მოწვევის მიღება')
    expect(html).toContain('ადმინისტრატორი') // localized role label
  })

  it('renders Russian when the org content locale is ru', () => {
    const { subject, html } = buildTeamInviteEmail({ ...base, locale: 'ru' })
    expect(subject).toContain('приглашает')
    expect(html).toContain('Вас пригласили')
    expect(html).toContain('Принять приглашение')
  })

  it('localizes the member role label', () => {
    expect(buildTeamInviteEmail({ ...base, role: 'member', locale: 'ka' }).html).toContain('წევრი')
    expect(buildTeamInviteEmail({ ...base, role: 'member', locale: 'ru' }).html).toContain('Участник')
  })

  it('HTML-escapes the org/inviter names to prevent injection', () => {
    const { html } = buildTeamInviteEmail({
      ...base,
      inviterName: '<script>x</script>',
      organizationName: 'A & B',
    })
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('A &amp; B')
  })

  it('does not misfire String.replace $-patterns from a name', () => {
    // A name containing `$&` must appear literally, not re-inject the match.
    const { html } = buildTeamInviteEmail({ ...base, organizationName: 'Foo $& Bar' })
    expect(html).toContain('Foo $&amp; Bar')
    expect(html).not.toContain('{org}')
  })
})
