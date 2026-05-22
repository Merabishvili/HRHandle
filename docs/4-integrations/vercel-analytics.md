# Vercel Analytics 🆕

_Last updated: 2026-05-08_

## Purpose

Anonymous client-side page-view + event tracking, used purely for traffic
analytics. No PII collected.

## SDK

- Package: `@vercel/analytics` v1.6.1
- Component: `<Analytics />` mounted once in `app/layout.tsx`

## Environment Variables

None. Vercel Analytics auto-detects the deployment via the Vercel runtime.
Locally it is a no-op.

## Code Locations

| File | Role |
|---|---|
| `app/layout.tsx` | Mounts `<Analytics />` so every page records a view |

## Notes

- Data is visible only to Vercel project members in the Vercel dashboard.
- Free tier covers limited events per month — check the dashboard if you start
  seeing throttling messages.
- Not to be confused with Sentry (errors) or Google Analytics (we do **not**
  use GA).
