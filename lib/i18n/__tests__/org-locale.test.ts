import { describe, it, expect } from 'vitest'
import {
  orgEnabledLocales,
  orgDefaultLocale,
  resolveOrgContentLocale,
  normalizeOrgContentLocale,
} from '@/lib/i18n/org-locale'

describe('orgDefaultLocale', () => {
  it('returns the stored default when valid, else en', () => {
    expect(orgDefaultLocale({ default_content_locale: 'ka' })).toBe('ka')
    expect(orgDefaultLocale({ default_content_locale: 'xx' })).toBe('en')
    expect(orgDefaultLocale(null)).toBe('en')
  })
})

describe('orgEnabledLocales', () => {
  it('is always the single default locale as a one-element list', () => {
    expect(orgEnabledLocales({ default_content_locale: 'ka' })).toEqual(['ka'])
    // A stale multi-value array can never resurface two languages — reads
    // derive from the single default.
    expect(orgEnabledLocales({ default_content_locale: 'ru', enabled_content_locales: ['en', 'ka', 'ru'] })).toEqual(['ru'])
    expect(orgEnabledLocales({ default_content_locale: 'xx' })).toEqual(['en'])
    expect(orgEnabledLocales(null)).toEqual(['en'])
  })
})

describe('resolveOrgContentLocale', () => {
  it('is the org default, ignoring any requested locale', () => {
    const org = { default_content_locale: 'ka', enabled_content_locales: ['ka'] }
    expect(resolveOrgContentLocale(org)).toBe('ka')
    expect(resolveOrgContentLocale(org, 'en')).toBe('ka')
    expect(resolveOrgContentLocale(org, 'ru')).toBe('ka')
    expect(resolveOrgContentLocale(null, 'ka')).toBe('en')
  })
})

describe('normalizeOrgContentLocale', () => {
  it('passes through a valid locale', () => {
    expect(normalizeOrgContentLocale('ka')).toBe('ka')
    expect(normalizeOrgContentLocale('ru')).toBe('ru')
    expect(normalizeOrgContentLocale('en')).toBe('en')
  })
  it('clamps an invalid locale to en', () => {
    expect(normalizeOrgContentLocale('xx')).toBe('en')
    expect(normalizeOrgContentLocale('')).toBe('en')
  })
})
