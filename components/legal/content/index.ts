import type { ComponentType } from 'react'
import type { Locale } from '@/lib/i18n/locales'
import type { LegalDoc } from '@/lib/legal/documents'
import { TermsEn } from './terms-en'
import { TermsKa } from './terms-ka'
import { TermsRu } from './terms-ru'
import { PrivacyEn } from './privacy-en'
import { PrivacyKa } from './privacy-ka'
import { PrivacyRu } from './privacy-ru'
import { RefundEn } from './refund-en'
import { RefundKa } from './refund-ka'
import { RefundRu } from './refund-ru'

/**
 * Every legal document in every language. English is the original; KA/RU are
 * translations ("English prevails" note shown by LegalPage). When the English
 * text changes, update all three and bump LEGAL_UPDATED (lib/legal/documents.ts).
 */
export const LEGAL_CONTENT: Record<LegalDoc, Record<Locale, ComponentType>> = {
  terms: { en: TermsEn, ka: TermsKa, ru: TermsRu },
  privacy: { en: PrivacyEn, ka: PrivacyKa, ru: PrivacyRu },
  refund: { en: RefundEn, ka: RefundKa, ru: RefundRu },
}
