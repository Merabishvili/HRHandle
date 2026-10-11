import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LEGAL_CONTENT } from '../content'
import { LOCALES } from '@/lib/i18n/locales'
import { BUSINESS_ID, SUPPORT_EMAIL } from '@/lib/legal/contact'
import {
  formatLegalDate,
  REFUND_LIMIT_MONTHS,
  REFUND_PAYOUT_BUSINESS_DAYS,
  REFUND_REQUEST_DAYS,
  type LegalDoc,
} from '@/lib/legal/documents'

const DOCS: LegalDoc[] = ['terms', 'privacy', 'refund']
const render = (doc: LegalDoc, locale: (typeof LOCALES)[number]) => {
  const Content = LEGAL_CONTENT[doc][locale]
  return renderToStaticMarkup(<Content />)
}
const sections = (html: string) => (html.match(/<h2/g) ?? []).length

describe('legal documents', () => {
  for (const doc of DOCS) {
    for (const locale of LOCALES) {
      it(`${doc} (${locale}) renders with the legal entity and contact`, () => {
        const html = render(doc, locale)
        expect(html).toContain(BUSINESS_ID)
        expect(html).toContain(SUPPORT_EMAIL)
        expect(html).not.toMatch(/undefined|NaN|\[object Object\]/)
      })
    }

    it(`${doc}: every translation has the same sections as the English original`, () => {
      const en = sections(render(doc, 'en'))
      expect(en).toBeGreaterThan(5)
      for (const locale of LOCALES) expect(sections(render(doc, locale))).toBe(en)
    })
  }

  it('every refund policy states the request window, payout deadline and refund limit', () => {
    for (const locale of LOCALES) {
      const html = render('refund', locale)
      for (const n of [REFUND_REQUEST_DAYS, REFUND_PAYOUT_BUSINESS_DAYS, REFUND_LIMIT_MONTHS]) {
        expect(html).toContain(String(n))
      }
    }
  })

  it('formats the last-updated date in each language', () => {
    expect(formatLegalDate('terms', 'en')).toBe('October 9, 2026')
    expect(formatLegalDate('terms', 'ru')).toContain('октября 2026')
    expect(formatLegalDate('terms', 'ka')).toContain('2026')
  })
})
