import * as Sentry from '@sentry/nextjs'
import { scrubPii } from '@/lib/sentry-scrub'

/**
 * Browser Sentry init. In Next.js 15+/16 (Turbopack) the browser SDK is loaded
 * from `instrumentation-client.ts`, NOT the legacy `sentry.client.config.ts`
 * (which was silently ignored — another reason no client errors were logged).
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.05,
    integrations: [
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    beforeSend: (event) => scrubPii(event),
  })
}

// Instruments client-side navigations so route changes are tied to traces.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
