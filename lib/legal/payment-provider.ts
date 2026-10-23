/**
 * Who processes card payments — named in one place so the legal pages, the
 * billing page and the disclosure register can't drift apart, and so the
 * provider's name can be changed or removed with one edit if the provider asks
 * (the merchant agreement lets them require it).
 *
 * Flitt is the brand payers see; TPAY LLC operates it in Georgia and is our
 * contracting party; TBC Bank is the acquiring bank that settles card payments.
 * The guide pages (content/guides/{en,ka,ru}/billing.mdx) name Flitt in prose —
 * edit those by hand.
 */
export const PAYMENT_PROVIDER_BRAND = 'Flitt'

export const PAYMENT_PROVIDER: Record<'en' | 'ka' | 'ru', { operator: string; acquirer: string }> = {
  en: { operator: 'TPAY LLC', acquirer: 'TBC Bank' },
  ka: { operator: 'შპს „თიფეი“', acquirer: 'სს „თიბისი ბანკი“' },
  ru: { operator: 'ООО «ТиПэй»', acquirer: 'АО «ТБС Банк»' },
}

/** How the register of disclosures names the payment recipient. */
export const PAYMENT_RECIPIENT_LABEL = `${PAYMENT_PROVIDER_BRAND} (${PAYMENT_PROVIDER.en.operator})`
