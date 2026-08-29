import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales'

/**
 * Localized "chrome" for candidate-facing emails — the headings, greeting, CTAs,
 * table labels and footer that wrap the per-template subject/body (those come
 * localized from messages/emails.source.json via defaultTemplate). Emails render
 * server-side outside React, so this is a plain locale-keyed table.
 *
 * Language = the ORG content locale (candidate-facing), same as the template body.
 */
export interface EmailChrome {
  /** Full greeting line; `nameHtml` is the already-escaped (and usually bold) name. */
  dear: (nameHtml: string) => string
  sentVia: string
  sentViaNoReply: string
  /** CTA label on the generic team-notification email. */
  openInApp: string

  // Application confirmation
  thanksForApplying: string
  trackApplication: string
  keepLinkPrivate: string

  // Status change
  underReview: string
  movingToInterview: string

  // Offer
  youHaveOffer: string
  viewOffer: string
  keepLinkPrivateOffer: string

  // Rejection
  hiringUpdate: string

  // Interview invitation
  interviewInvitation: string
  interviewRescheduled: string
  interviewRescheduledSubject: (title: string) => string
  joinMeeting: string
  labelDate: string
  labelTime: string
  labelDuration: string
  labelFormat: string
  labelMeetingLink: string
  minutes: (n: number) => string
  typeVideo: string
  typePhone: string
  typeOnsite: string

  /** Contact lines — `nameHtml`/`emailHtml` are pre-built (bold name + mailto link). */
  contactReply: (nameHtml: string, emailHtml: string) => string
  contactWelcome: (nameHtml: string, emailHtml: string) => string

  /** BCP-47 tag for Intl date/time formatting. */
  dateTag: string
}

const CHROME: Record<Locale, EmailChrome> = {
  en: {
    dear: (n) => `Dear ${n},`,
    sentVia: 'Sent via HRHandle',
    sentViaNoReply: 'Sent via HRHandle · Please do not reply to this email.',
    openInApp: 'Open in HRHandle',
    thanksForApplying: 'Thanks for Applying!',
    trackApplication: 'Track your application',
    keepLinkPrivate:
      "Keep this link private — it's the only way to view your status without contacting the recruiter.",
    underReview: 'Your application is under review',
    movingToInterview: 'Moving to the interview stage',
    youHaveOffer: 'You have an offer',
    viewOffer: 'View your offer',
    keepLinkPrivateOffer:
      "Keep this link private — it's the only way to view and respond to this offer.",
    hiringUpdate: 'Hiring Update',
    interviewInvitation: 'Interview Invitation',
    interviewRescheduled: 'Interview Rescheduled',
    interviewRescheduledSubject: (title) => `Interview Rescheduled: ${title}`,
    joinMeeting: 'Join Meeting',
    labelDate: 'Date',
    labelTime: 'Time',
    labelDuration: 'Duration',
    labelFormat: 'Format',
    labelMeetingLink: 'Meeting link',
    minutes: (n) => `${n} minutes`,
    typeVideo: 'Video Call',
    typePhone: 'Phone Call',
    typeOnsite: 'On-site',
    contactReply: (name, email) =>
      `If you have any questions, please reply to this email or contact ${name} at ${email}.`,
    contactWelcome: (name, email) =>
      `If you have any questions, you are welcome to contact ${name} at ${email}.`,
    dateTag: 'en-US',
  },
  ka: {
    dear: (n) => `ძვირფასო ${n},`,
    sentVia: 'გაგზავნილია HRHandle-ით',
    sentViaNoReply: 'გაგზავნილია HRHandle-ით · გთხოვთ, არ უპასუხოთ ამ წერილს.',
    openInApp: 'გახსენით HRHandle-ში',
    thanksForApplying: 'გმადლობთ განაცხადისთვის!',
    trackApplication: 'თვალი ადევნეთ თქვენს განაცხადს',
    keepLinkPrivate:
      'შეინახეთ ეს ბმული პირადად — ეს ერთადერთი გზაა თქვენი სტატუსის სანახავად რეკრუტერთან დაკავშირების გარეშე.',
    underReview: 'თქვენი განაცხადი განიხილება',
    movingToInterview: 'გადადის გასაუბრების ეტაპზე',
    youHaveOffer: 'თქვენ გაქვთ შეთავაზება',
    viewOffer: 'შეთავაზების ნახვა',
    keepLinkPrivateOffer:
      'შეინახეთ ეს ბმული პირადად — ეს ერთადერთი გზაა შეთავაზების სანახავად და საპასუხოდ.',
    hiringUpdate: 'სიახლე დაქირავების პროცესში',
    interviewInvitation: 'გასაუბრების მოწვევა',
    interviewRescheduled: 'გასაუბრება გადაიდო',
    interviewRescheduledSubject: (title) => `გასაუბრება გადაიდო: ${title}`,
    joinMeeting: 'შეხვედრაზე შესვლა',
    labelDate: 'თარიღი',
    labelTime: 'დრო',
    labelDuration: 'ხანგრძლივობა',
    labelFormat: 'ფორმატი',
    labelMeetingLink: 'შეხვედრის ბმული',
    minutes: (n) => `${n} წუთი`,
    typeVideo: 'ვიდეო ზარი',
    typePhone: 'სატელეფონო ზარი',
    typeOnsite: 'ადგილზე',
    contactReply: (name, email) =>
      `თუ გაქვთ შეკითხვები, უპასუხეთ ამ წერილს ან დაუკავშირდით ${name}-ს: ${email}.`,
    contactWelcome: (name, email) =>
      `თუ გაქვთ შეკითხვები, შეგიძლიათ დაუკავშირდეთ ${name}-ს: ${email}.`,
    dateTag: 'ka-GE',
  },
  ru: {
    dear: (n) => `Здравствуйте, ${n}!`,
    sentVia: 'Отправлено через HRHandle',
    sentViaNoReply: 'Отправлено через HRHandle · Пожалуйста, не отвечайте на это письмо.',
    openInApp: 'Открыть в HRHandle',
    thanksForApplying: 'Спасибо за отклик!',
    trackApplication: 'Отслеживать заявку',
    keepLinkPrivate:
      'Сохраните эту ссылку в тайне — это единственный способ увидеть статус, не связываясь с рекрутером.',
    underReview: 'Ваша заявка на рассмотрении',
    movingToInterview: 'Переход на этап собеседования',
    youHaveOffer: 'У вас есть предложение',
    viewOffer: 'Посмотреть предложение',
    keepLinkPrivateOffer:
      'Сохраните эту ссылку в тайне — это единственный способ увидеть предложение и ответить на него.',
    hiringUpdate: 'Обновление по вакансии',
    interviewInvitation: 'Приглашение на собеседование',
    interviewRescheduled: 'Собеседование перенесено',
    interviewRescheduledSubject: (title) => `Собеседование перенесено: ${title}`,
    joinMeeting: 'Присоединиться к встрече',
    labelDate: 'Дата',
    labelTime: 'Время',
    labelDuration: 'Длительность',
    labelFormat: 'Формат',
    labelMeetingLink: 'Ссылка на встречу',
    minutes: (n) => `${n} мин.`,
    typeVideo: 'Видеозвонок',
    typePhone: 'Телефонный звонок',
    typeOnsite: 'Очно',
    contactReply: (name, email) =>
      `Если у вас есть вопросы, ответьте на это письмо или свяжитесь с ${name}: ${email}.`,
    contactWelcome: (name, email) =>
      `Если у вас есть вопросы, вы можете связаться с ${name}: ${email}.`,
    dateTag: 'ru-RU',
  },
}

export function emailChrome(locale: Locale = DEFAULT_LOCALE): EmailChrome {
  return CHROME[locale] ?? CHROME[DEFAULT_LOCALE]
}
