/**
 * The demo organizations' "connected" Calendly account (guide screenshots).
 *
 * The seed stores a Calendly connection whose token is GUIDE_CALENDLY_TOKEN-<locale>;
 * the walkthrough server answers Calendly's API for exactly those tokens
 * (calendly-api.mjs), so the connected screens and the booking link look real
 * without a Calendly account. Plain JS so the server preload can import it too.
 */
export const GUIDE_CALENDLY_API = 'https://api.calendly.com'
export const GUIDE_CALENDLY_TOKEN = 'guide-demo-calendly'

/** Per language: the booking page slug and the owner's event types (the first one is selected). */
export const GUIDE_CALENDLY = {
  en: {
    slug: 'acme-hiring',
    eventTypes: [
      { id: 'interview', name: 'Interview', duration: 30 },
      { id: 'intro', name: 'Intro call', duration: 15 },
    ],
  },
  ka: {
    slug: 'akme-hiring',
    eventTypes: [
      { id: 'interview', name: 'გასაუბრება', duration: 30 },
      { id: 'intro', name: 'გაცნობითი ზარი', duration: 15 },
    ],
  },
  ru: {
    slug: 'akme-hiring-ru',
    eventTypes: [
      { id: 'interview', name: 'Собеседование', duration: 30 },
      { id: 'intro', name: 'Знакомство', duration: 15 },
    ],
  },
}

export const guideCalendlyUserUri = (locale) => `${GUIDE_CALENDLY_API}/users/guide-${locale}`
export const guideCalendlyEventTypeUri = (locale, id) => `${GUIDE_CALENDLY_API}/event_types/guide-${locale}-${id}`
