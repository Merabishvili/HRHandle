import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales'

/**
 * Localized "chrome" for candidate-facing emails — the heading, greeting, CTA
 * and footer text that wraps the per-template subject/body (those come localized
 * from messages/emails.source.json via defaultTemplate). Emails render server-
 * side outside React, so this is a plain locale-keyed table rather than next-intl.
 *
 * Language = the ORG content locale (candidate-facing), same as the template body.
 */
export interface EmailChrome {
  /** Full greeting line; `nameHtml` is the already-escaped (and usually bold) name. */
  dear: (nameHtml: string) => string
  thanksForApplying: string
  trackApplication: string
  keepLinkPrivate: string
  sentViaNoReply: string
}

const CHROME: Record<Locale, EmailChrome> = {
  en: {
    dear: (n) => `Dear ${n},`,
    thanksForApplying: 'Thanks for Applying!',
    trackApplication: 'Track your application',
    keepLinkPrivate:
      "Keep this link private — it's the only way to view your status without contacting the recruiter.",
    sentViaNoReply: 'Sent via HRHandle · Please do not reply to this email.',
  },
  ka: {
    dear: (n) => `ძვირფასო ${n},`,
    thanksForApplying: 'გმადლობთ განაცხადისთვის!',
    trackApplication: 'თვალი ადევნეთ თქვენს განაცხადს',
    keepLinkPrivate:
      'შეინახეთ ეს ბმული პირადად — ეს ერთადერთი გზაა თქვენი სტატუსის სანახავად რეკრუტერთან დაკავშირების გარეშე.',
    sentViaNoReply: 'გაგზავნილია HRHandle-ით · გთხოვთ, არ უპასუხოთ ამ წერილს.',
  },
  ru: {
    dear: (n) => `Здравствуйте, ${n}!`,
    thanksForApplying: 'Спасибо за отклик!',
    trackApplication: 'Отслеживать заявку',
    keepLinkPrivate:
      'Сохраните эту ссылку в тайне — это единственный способ увидеть статус, не связываясь с рекрутером.',
    sentViaNoReply: 'Отправлено через HRHandle · Пожалуйста, не отвечайте на это письмо.',
  },
}

export function emailChrome(locale: Locale = DEFAULT_LOCALE): EmailChrome {
  return CHROME[locale] ?? CHROME[DEFAULT_LOCALE]
}
