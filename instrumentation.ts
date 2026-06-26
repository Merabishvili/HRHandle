import * as Sentry from '@sentry/nextjs'

/**
 * Next.js instrumentation hook — the ONLY place the server/edge Sentry SDKs get
 * loaded. Next.js 13.4+ stopped auto-loading `sentry.server.config.ts` /
 * `sentry.edge.config.ts`; they now have to be imported from `register()` here,
 * picked by runtime. Without this file the server, route-handler, server-action,
 * and middleware errors are never sent to Sentry — which is why nothing showed
 * up. (The browser SDK loads separately from `instrumentation-client.ts`.)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

/**
 * App Router error hook (Next.js 15+/16). Forwards errors thrown inside nested
 * React Server Components, route handlers, and server actions to Sentry —
 * these do NOT flow through `register()`'s init alone.
 */
export const onRequestError = Sentry.captureRequestError
