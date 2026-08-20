import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    RESEND_API_KEY: z.string().min(1).optional(),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    ZOOM_CLIENT_ID: z.string().min(1).optional(),
    ZOOM_CLIENT_SECRET: z.string().min(1).optional(),
    // Zoom app "Secret Token" — verifies webhook signatures + the endpoint
    // URL-validation (CRC) challenge on the deauthorization webhook.
    ZOOM_SECRET_TOKEN: z.string().min(1).optional(),
    MICROSOFT_CLIENT_ID: z.string().min(1).optional(),
    MICROSOFT_CLIENT_SECRET: z.string().min(1).optional(),
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
    GOOGLE_GEMINI_API_KEY: z.string().min(1).optional(),
    CRON_SECRET: z.string().min(1).optional(),
    SENTRY_ORG: z.string().min(1).optional(),
    SENTRY_PROJECT: z.string().min(1).optional(),
    CALENDLY_CLIENT_ID: z.string().min(1).optional(),
    CALENDLY_CLIENT_SECRET: z.string().min(1).optional(),
    // Flitt payment gateway (portal.flitt.com). Server-only — the secret key
    // signs every checkout + verifies callbacks. Optional so an unconfigured
    // deployment builds fine and the checkout fails soft (see lib/flitt/client.ts).
    // MERCHANT_ID is numeric but kept as a string here; coerced in the client.
    FLITT_MERCHANT_ID: z.string().min(1).optional(),
    FLITT_SECRET_KEY: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
    // Deliberately NOT .url(): a malformed analytics host must never hard-fail
    // the production build. The provider defaults to the EU host, so a bad value
    // just degrades analytics silently. (A missing https:// here broke a prod deploy once.)
    NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
  },
  runtimeEnv: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    ZOOM_CLIENT_ID: process.env.ZOOM_CLIENT_ID,
    ZOOM_CLIENT_SECRET: process.env.ZOOM_CLIENT_SECRET,
    ZOOM_SECRET_TOKEN: process.env.ZOOM_SECRET_TOKEN,
    MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID,
    MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    GOOGLE_GEMINI_API_KEY: process.env.GOOGLE_GEMINI_API_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    CALENDLY_CLIENT_ID: process.env.CALENDLY_CLIENT_ID,
    CALENDLY_CLIENT_SECRET: process.env.CALENDLY_CLIENT_SECRET,
    FLITT_MERCHANT_ID: process.env.FLITT_MERCHANT_ID,
    FLITT_SECRET_KEY: process.env.FLITT_SECRET_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  },
  // Vercel often injects an empty string for unset env vars instead of leaving
  // them undefined. Without this, `z.string().min(1).optional()` rejects ''
  // (it's defined-but-too-short), and the build fails. With this on, '' is
  // treated as "absent" before validation runs — matching local-dev behaviour
  // where missing env vars are simply undefined.
  emptyStringAsUndefined: true,
})
