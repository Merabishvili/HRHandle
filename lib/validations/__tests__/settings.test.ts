import { describe, it, expect } from 'vitest'
import { ProfileSchema, OrganizationSchema } from '@/lib/validations/settings'

describe('ProfileSchema', () => {
  it('accepts a minimal valid profile (full_name only)', () => {
    expect(ProfileSchema.safeParse({ full_name: 'Jane Smith' }).success).toBe(true)
  })

  it('accepts full_name + phone', () => {
    expect(
      ProfileSchema.safeParse({ full_name: 'Jane Smith', phone: '+1 555 0100' }).success
    ).toBe(true)
  })

  it('accepts null phone', () => {
    expect(ProfileSchema.safeParse({ full_name: 'Jane', phone: null }).success).toBe(true)
  })

  it('rejects empty full_name', () => {
    const r = ProfileSchema.safeParse({ full_name: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]!.message).toBe('Full name is required')
  })

  it('rejects full_name longer than 100 chars', () => {
    expect(ProfileSchema.safeParse({ full_name: 'x'.repeat(101) }).success).toBe(false)
  })

  it('accepts full_name at exactly 100 chars', () => {
    expect(ProfileSchema.safeParse({ full_name: 'x'.repeat(100) }).success).toBe(true)
  })

  it('rejects phone longer than 30 chars', () => {
    expect(ProfileSchema.safeParse({ full_name: 'Jane', phone: 'x'.repeat(31) }).success).toBe(false)
  })
})

describe('OrganizationSchema', () => {
  it('accepts minimal valid org (name only)', () => {
    expect(OrganizationSchema.safeParse({ name: 'Acme' }).success).toBe(true)
  })

  it('accepts a fully populated org', () => {
    expect(
      OrganizationSchema.safeParse({
        name: 'Acme Inc',
        logo_url: 'https://cdn.example.com/logo.png',
        public_page_slug: 'acme-inc',
      }).success
    ).toBe(true)
  })

  it('rejects empty name', () => {
    const r = OrganizationSchema.safeParse({ name: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]!.message).toBe('Organization name is required')
  })

  it('rejects name longer than 200 chars', () => {
    expect(OrganizationSchema.safeParse({ name: 'x'.repeat(201) }).success).toBe(false)
  })

  it('rejects invalid logo_url', () => {
    expect(
      OrganizationSchema.safeParse({ name: 'Acme', logo_url: 'not a url' }).success
    ).toBe(false)
  })

  it('allows null logo_url', () => {
    expect(OrganizationSchema.safeParse({ name: 'Acme', logo_url: null }).success).toBe(true)
  })

  describe('public_page_slug', () => {
    it('accepts a valid slug', () => {
      expect(
        OrganizationSchema.safeParse({ name: 'Acme', public_page_slug: 'acme-inc-2' }).success
      ).toBe(true)
    })

    it('rejects slugs shorter than 3 chars', () => {
      const r = OrganizationSchema.safeParse({ name: 'Acme', public_page_slug: 'ab' })
      expect(r.success).toBe(false)
    })

    it('rejects slugs longer than 60 chars', () => {
      expect(
        OrganizationSchema.safeParse({ name: 'Acme', public_page_slug: 'a'.repeat(61) }).success
      ).toBe(false)
    })

    it('rejects slug starting with a hyphen', () => {
      expect(
        OrganizationSchema.safeParse({ name: 'Acme', public_page_slug: '-acme' }).success
      ).toBe(false)
    })

    it('rejects slug ending with a hyphen', () => {
      expect(
        OrganizationSchema.safeParse({ name: 'Acme', public_page_slug: 'acme-' }).success
      ).toBe(false)
    })

    it('rejects uppercase letters', () => {
      expect(
        OrganizationSchema.safeParse({ name: 'Acme', public_page_slug: 'Acme' }).success
      ).toBe(false)
    })

    it('rejects underscores', () => {
      expect(
        OrganizationSchema.safeParse({ name: 'Acme', public_page_slug: 'acme_inc' }).success
      ).toBe(false)
    })

    it('accepts slug starting and ending with a digit', () => {
      expect(
        OrganizationSchema.safeParse({ name: 'Acme', public_page_slug: '1-acme-1' }).success
      ).toBe(true)
    })
  })
})
