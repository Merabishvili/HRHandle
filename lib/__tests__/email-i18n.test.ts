import { describe, it, expect } from 'vitest'
import { emailChrome } from '@/lib/email-i18n'
import { LOCALES } from '@/lib/i18n/locales'

describe('emailChrome', () => {
  it('returns localized chrome for each locale', () => {
    expect(emailChrome('en').thanksForApplying).toBe('Thanks for Applying!')
    expect(emailChrome('ka').thanksForApplying).toBe('გმადლობთ განაცხადისთვის!')
    expect(emailChrome('ru').thanksForApplying).toBe('Спасибо за отклик!')
  })

  it('builds a greeting that embeds the (already-escaped) name', () => {
    expect(emailChrome('en').dear('<b>Ana</b>')).toBe('Dear <b>Ana</b>,')
    expect(emailChrome('ka').dear('<b>Ana</b>')).toContain('<b>Ana</b>')
  })

  it('defaults to English for an unknown locale', () => {
    // @ts-expect-error — exercising the runtime fallback for a bad value
    expect(emailChrome('xx').sentViaNoReply).toBe(emailChrome('en').sentViaNoReply)
  })

  it('every locale defines every chrome field (no missing translations)', () => {
    for (const loc of LOCALES) {
      const c = emailChrome(loc)
      expect(c.thanksForApplying).toBeTruthy()
      expect(c.trackApplication).toBeTruthy()
      expect(c.keepLinkPrivate).toBeTruthy()
      expect(c.sentViaNoReply).toBeTruthy()
      expect(c.dear('X')).toContain('X')
    }
  })
})
