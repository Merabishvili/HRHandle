# Sentry Error Monitoring

_Last updated: 2026-05-08_

## Changelog

- 🔄 CSP whitelist updated to include Pusher (wss://*.pusher.com) — unrelated to Sentry but worth noting in any CSP review
- 🆕 No `beforeSend` PII filter is configured. Candidate names, emails, application bodies, etc. can leak into Sentry events. Tracked as `S-sentry-pii`.

---

## Overview

Sentry is used for error monitoring and performance tracing. The `@sentry/nextjs` package (v10.49.0) is integrated via `withSentryConfig` in `next.config.mjs`. Sentry is optional — it only initializes if `NEXT_PUBLIC_SENTRY_DSN` is set.

## Configuration Files

All three config files follow the same guard pattern: only initialize if `process.env.NEXT_PUBLIC_SENTRY_DSN` is set.

### `sentry.client.config.ts` (Browser)

```ts
Sentry.init({
  dsn,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.05,
  integrations: [Sentry.replayIntegration()],
})
```

- Session Replay is enabled: captures video-like session recordings
- 100% replay on error, 5% sampling for general sessions
- Traces: 10% in production, 100% in development

### `sentry.server.config.ts` (Node.js server)

```ts
Sentry.init({
  dsn,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
})
```

No session replay on server.

### `sentry.edge.config.ts` (Edge runtime — middleware)

```ts
Sentry.init({
  dsn,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
})
```

Same as server config.

## `next.config.mjs` Integration

```ts
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  sourcemaps: {
    disable: !process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  telemetry: false,
})
```

Source maps are only uploaded to Sentry when `NEXT_PUBLIC_SENTRY_DSN` is configured. The `SENTRY_AUTH_TOKEN` (not listed in `lib/env.ts` but required by Sentry CLI for source map upload) must be set in the build environment.

## Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry Data Source Name — enables Sentry if present. Public because needed by client-side Sentry. |
| `SENTRY_ORG` | Sentry organization slug (used for source map upload in `next.config.mjs`) |
| `SENTRY_PROJECT` | Sentry project slug (used for source map upload in `next.config.mjs`) |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source map upload (⚠️ not in `lib/env.ts` — set in Vercel build env) |

## Behaviour When DSN Is Not Set

- No errors are sent to Sentry
- Source maps are not uploaded during build
- The `withSentryConfig` wrapper still wraps the Next.js config but Sentry is effectively disabled
- Safe for local development without a Sentry account
