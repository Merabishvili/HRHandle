import { describe, it, expect } from 'vitest'
import {
  orgEnabledLocales,
  orgDefaultLocale,
  resolveOrgContentLocale,
  normalizeOrgLocales,
} from '@/lib/i18n/org-locale'

describe('orgEnabledLocales', () => {
  it('always includes en, in canonical order, deduped', () => {
    expect(orgEnabledLocales({ enabled_content_locales: ['ru', 'ka'] })).toEqual(['en', 'ka', 'ru'])
    expect(orgEnabledLocales({ enabled_content_locales: ['ka', 'ka'] })).toEqual(['en', 'ka'])
  })
  it('drops invalid locales and defaults to [en] when empty/null', () => {
    expect(orgEnabledLocales({ enabled_content_locales: ['xx', 'de'] })).toEqual(['en'])
    expect(orgEnabledLocales({ enabled_content_locales: [] })).toEqual(['en'])
    expect(orgEnabledLocales(null)).toEqual(['en'])
  })
})

describe('orgDefaultLocale', () => {
  it('returns the stored default when valid, else en', () => {
    expect(orgDefaultLocale({ default_content_locale: 'ka' })).toBe('ka')
    expect(orgDefaultLocale({ default_content_locale: 'xx' })).toBe('en')
    expect(orgDefaultLocale(null)).toBe('en')
  })
})

describe('resolveOrgContentLocale', () => {
  const org = { default_content_locale: 'ka', enabled_content_locales: ['en', 'ka'] }
  it('honors a requested locale only when the org enabled it', () => {
    expect(resolveOrgContentLocale(org, 'ka')).toBe('ka')
    expect(resolveOrgContentLocale(org, 'en')).toBe('en')
    expect(resolveOrgContentLocale(org, 'ru')).toBe('ka') // ru not enabled → org default
  })
  it('falls back to org default, then en', () => {
    expect(resolveOrgContentLocale(org)).toBe('ka')
    expect(resolveOrgContentLocale({ enabled_content_locales: ['en'] }, 'ka')).toBe('en')
    expect(resolveOrgContentLocale(null, 'ka')).toBe('en')
  })
})

describe('normalizeOrgLocales', () => {
  it('forces en into the enabled set and orders canonically', () => {
    expect(normalizeOrgLocales('ka', ['ka', 'ru'])).toEqual({ default: 'ka', enabled: ['en', 'ka', 'ru'] })
  })
  it('clamps an out-of-set default back to en', () => {
    expect(normalizeOrgLocales('ru', ['en', 'ka'])).toEqual({ default: 'en', enabled: ['en', 'ka'] })
  })
  it('drops invalid locales', () => {
    expect(normalizeOrgLocales('xx', ['de', 'ka'])).toEqual({ default: 'en', enabled: ['en', 'ka'] })
  })
})
