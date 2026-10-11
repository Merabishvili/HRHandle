/**
 * Calendly API stand-in for the guide-screenshot server — preloaded with
 * `node --import` by scripts/guide-start.mjs, never by the real app.
 *
 * Answers GET /users/me and GET /event_types only for the demo tokens the seed
 * stores (calendly-demo.mjs); every other request goes to the real fetch.
 */
import { GUIDE_CALENDLY, GUIDE_CALENDLY_API, GUIDE_CALENDLY_TOKEN, guideCalendlyEventTypeUri, guideCalendlyUserUri } from './calendly-demo.mjs'

const realFetch = globalThis.fetch

function demoLocale(init) {
  const auth = new Headers(init?.headers ?? {}).get('authorization') ?? ''
  const m = auth.match(new RegExp(`^Bearer ${GUIDE_CALENDLY_TOKEN}-(\\w+)$`))
  return m && GUIDE_CALENDLY[m[1]] ? m[1] : null
}

globalThis.fetch = async function guideFetch(input, init) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const locale = url.startsWith(`${GUIDE_CALENDLY_API}/`) ? demoLocale(init) : null
  if (!locale) return realFetch(input, init)

  const demo = GUIDE_CALENDLY[locale]
  const { pathname } = new URL(url)
  const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  if (pathname === '/users/me') {
    return json({ resource: { uri: guideCalendlyUserUri(locale), name: 'Calendly', email: `guide.${locale}.owner@example.com`, scheduling_url: `https://calendly.com/${demo.slug}` } })
  }
  if (pathname === '/event_types') {
    return json({
      collection: demo.eventTypes.map((et) => ({
        uri: guideCalendlyEventTypeUri(locale, et.id),
        name: et.name,
        active: true,
        slug: et.id,
        duration: et.duration,
        scheduling_url: `https://calendly.com/${demo.slug}/${et.id}`,
      })),
    })
  }
  return new Response(JSON.stringify({ message: 'not mocked' }), { status: 404 })
}
