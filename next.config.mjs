import { withSentryConfig } from '@sentry/nextjs'
import { withAxiom } from '@axiomhq/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
}

export default withAxiom(withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  // Only upload source maps when DSN is configured
  sourcemaps: {
    disable: !process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  telemetry: false,
}))