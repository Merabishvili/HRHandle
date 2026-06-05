// Per-request Content-Security-Policy with a nonce. Built in middleware on
// every navigation; static `next.config.mjs` headers cover the non-CSP fields.
//
// Audit ref: S-014 / C-015.
//
// Phase 1 (this commit): nonce infrastructure is live, `'strict-dynamic'` is
// added. Modern browsers honour `'strict-dynamic'` and ignore the
// `'unsafe-inline'` / `'unsafe-eval'` fallbacks; legacy browsers fall back to
// them. Net effect: real hardening for modern browsers without breaking
// anything that hasn't been retested on a stricter policy.
//
// Phase 2 (deferred): once production has been observed clean for a release
// cycle, drop `'unsafe-inline'` (and possibly `'unsafe-eval'`) from
// `script-src`. The nonce path is already in place; only the fallback
// directives need removing.

export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // 'strict-dynamic' trusts scripts loaded by a nonced script. Modern
    // browsers ignore the trailing `'unsafe-inline'` / `'unsafe-eval'` when
    // `'strict-dynamic'` is present — they're kept here as a legacy fallback
    // for older browsers that don't recognise `'strict-dynamic'`.
    // PostHog (EU) ships its recorder/array assets from eu-assets; under
    // 'strict-dynamic' modern browsers trust them via the nonced bundle, but the
    // host is listed for legacy-browser fallback.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' 'unsafe-eval' https://js.sentry-cdn.com https://*.sentry.io https://vercel.live https://*.vercel.live https://challenges.cloudflare.com https://eu-assets.i.posthog.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    // PostHog (EU) event ingestion + asset fetch — required in connect-src;
    // 'strict-dynamic' does not apply to connect-src so these must be explicit.
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://vercel.live https://*.vercel.live wss://*.pusher.com https://*.pusher.com https://challenges.cloudflare.com https://eu.i.posthog.com https://eu-assets.i.posthog.com",
    "frame-src https://vercel.live https://*.vercel.live https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
  ].join('; ')
}

export function generateNonce(): string {
  // Web Crypto API works in the Next.js middleware runtime (Edge). 16 random
  // bytes → base64 yields ~22 chars, plenty for CSP nonce uniqueness.
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}
