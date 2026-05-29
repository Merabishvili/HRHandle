# PostHog Product Analytics 🆕

_Last updated: 2026-05-29_

## Overview

PostHog captures product analytics — pageviews, clicks, and named product
events — so we can see how users move through the app. It is **optional**: it
only initializes when `NEXT_PUBLIC_POSTHOG_KEY` is set (same gating pattern as
Sentry's DSN). When unset — local dev, CI, or staging — every call is a no-op.

- Package: `posthog-js`
- Region: **EU cloud** (`https://eu.i.posthog.com`) — chosen for GDPR/data
  residency since the app stores candidate PII. (Sentry is on US cloud; the two
  are independent accounts. Sentry is acceptable on US because it scrubs PII
  before sending — see `docs/4-integrations/sentry.md`.)
- One project, used for **production only**. The free tier allows a single
  project, so there is no separate staging project; staging/local simply run
  without a key.

## Configuration Files

| File | Role |
|---|---|
| `app/providers.tsx` | `'use client'` provider. Inits PostHog when the key is present; captures `$pageview` on every App Router navigation via a Suspense-wrapped `PostHogPageView`. |
| `app/layout.tsx` | Wraps the app in `<PostHogProvider>`. |
| `components/analytics/posthog-identify.tsx` | Identifies the logged-in user (Supabase user id only). |
| `app/(dashboard)/layout.tsx` | Mounts `<PostHogIdentify>` — authenticated area only. |
| `lib/analytics.ts` | Typed `capture()` helper for named product events. |
| `lib/security-headers.ts` | CSP allow-list for PostHog EU hosts. |
| `lib/env.ts` | Validates the two env vars (optional). |

## What is captured

- **Autocapture** — pageviews, clicks, and form interactions, automatically.
- **`$pageview`** — captured manually on client-side navigation (App Router
  SPA navigations don't fire full page loads).
- **Named events** — via `capture()` from `lib/analytics.ts`. PII-free by
  convention (ids, counts, enums only).
- **Identify** — logged-in users are identified by **Supabase user id only**;
  no email or name is sent. `org_id` and `role` are attached as properties, and
  the user is associated with an `organization` group for B2B group analytics.
  Public `/apply` and `/jobs` visitors are never identified.

## Privacy posture

- `person_profiles: 'identified_only'` — anonymous visitors create no person
  profile (less PII, less quota).
- **Session recording is OFF.** It's controlled by the PostHog dashboard toggle
  (off by default for a new project), so it can be enabled later **without a
  code change** — but mind the candidate-PII exposure before doing so.
- No email/name is sent on identify (see above).

## Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | Project API key (`phc_...`). Public — needed by the browser. Empty/unset disables PostHog. |
| `NEXT_PUBLIC_POSTHOG_HOST` | Ingestion host. Defaults to `https://eu.i.posthog.com` when unset. |

Set both in **production Vercel only**. Leave them **unset in `.env.local`** so
local dev traffic doesn't pollute production analytics (to verify locally, add
the key temporarily, then remove it).

## Behaviour When Key Is Not Set

- PostHog never initializes; `capture()` / identify / pageview calls no-op.
- Safe for local development and CI without a PostHog account.

## Using PostHog for free

- **Free tier: ~1,000,000 events/month**, resets monthly, no credit card
  required. Overage is dropped (not charged) when no card is on file. A 3-user
  beta won't come close.
- **Free tier = one project.** Additional projects require a paid plan.
- Sign up at posthog.com and choose the **EU** region (permanent per account).
- Find the Project API key under **Settings → Project → Project API key**.

### Viewing your data

- **Activity** — live event stream (good for verifying events arrive).
- **Web Analytics** — traffic dashboard (visitors, pageviews, referrers).
- **Product Analytics → Insights / Funnels** — build charts and conversion
  funnels from events (e.g. signed up → created vacancy → received application).

## Notes

- Not to be confused with Sentry (errors) or Vercel Analytics (anonymous
  traffic). All three run side by side.
- CSP: PostHog EU hosts (`eu.i.posthog.com`, `eu-assets.i.posthog.com`) are
  allow-listed in `connect-src` (required for ingestion) and `script-src`
  (legacy-browser fallback) in `lib/security-headers.ts`.
