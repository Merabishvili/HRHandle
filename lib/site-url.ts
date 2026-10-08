/**
 * The site's base origin from `NEXT_PUBLIC_SITE_URL`, with any trailing
 * slash(es) removed so callers can safely append a path.
 *
 * A trailing slash in the env value is the classic cause of OAuth
 * `redirect_uri_mismatch`: `${base}/api/auth/.../callback` becomes
 * `https://host.com//api/...` (double slash), which providers reject because it
 * doesn't match the registered redirect URI. Centralized here so every
 * redirect-URI builder normalizes identically (see lib/google/calendar.ts,
 * lib/microsoft/graph.ts; mirrors the inline strip already in
 * lib/actions/billing.ts + calendly.ts).
 */
export function siteBaseUrl(): string {
  // `||` (not `??`) so an empty-string env value also falls back — otherwise the
  // builder would emit a bare relative path like "/api/auth/…" with no origin,
  // which every OAuth provider rejects as an invalid redirect_uri.
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '')
}

/**
 * Origin for URLs an external **server** calls back — payment callbacks
 * (Flitt) and webhooks (Calendly) — plus the matching browser return URL.
 *
 * Prefers the host actually serving this request over NEXT_PUBLIC_SITE_URL: in
 * production the apex `hrhandle.com` 307-redirects to `www.hrhandle.com` before
 * the app runs, and server-to-server callers don't follow redirects, so a
 * callback registered on the apex is silently lost (2026-10-09: paid, plan never
 * activated). Browser-facing links (OAuth, emails) are unaffected — browsers
 * follow the redirect — so they keep using siteBaseUrl().
 *
 * Takes the request headers so it stays pure/testable. Falls back to
 * siteBaseUrl() when there's no host.
 */
export function callbackOrigin(h: Pick<Headers, 'get'>): string {
  const host = (h.get('x-forwarded-host') ?? h.get('host'))?.split(',')[0]?.trim()
  if (!host) return siteBaseUrl()
  const isLocal = /^(localhost|127\.0\.0\.1)(:|$)/.test(host)
  const proto = h.get('x-forwarded-proto')?.split(',')[0]?.trim() || (isLocal ? 'http' : 'https')
  return `${proto}://${host}`
}
