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
