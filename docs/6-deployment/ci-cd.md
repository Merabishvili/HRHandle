# CI/CD

_Last updated: 2026-07-20_

## Changelog

- 🔄 **(2026-07-20 audit) Corrected: a GitHub Actions CI workflow now exists** (`.github/workflows/ci.yml`) and runs **lint + tests + build** on every push/PR to `main` and `staging`. The previous version of this doc claimed there was no CI workflow and that lint/tests were not run in CI — both are now false.
- 🔄 Added note that `vercel.json` defines the daily expire-vacancies cron (`0 1 * * *`).

---

## Overview

- **CI** — GitHub Actions (`.github/workflows/ci.yml`) gates every push/PR to `main` and `staging` on lint + tests + build.
- **CD** — Vercel auto-deploys: `main` → `hrhandle.com`, `staging` → `staging.hrhandle.com`.

## GitHub Actions CI (`.github/workflows/ci.yml`)

Triggers: `push` and `pull_request` on `main` and `staging`. Node.js `20`, npm cache. Two jobs:

1. **`lint-and-test` (Lint & Test)** — `npm ci` → `npm run lint` → `npm run test` (Vitest). A lint error or a failing test fails the job.
2. **`build` (Build check)** — `needs: lint-and-test`. `npm ci` → `npm run build`. Runs with **placeholder** Supabase env vars (falls back to `https://placeholder.supabase.co` / placeholder keys when the repo secrets aren't set) and `NEXT_PUBLIC_SITE_URL=https://hrhandle.com`, so the build validates without real secrets.

This matches the deploy process in `CLAUDE.md`: open a PR `staging → main`, CI must pass (lint + tests + build), then merge.

## Vercel Auto-Deploy (CD)

- Push to `staging` → deploys to `staging.hrhandle.com`
- Merge to `main` (via PR) → deploys to `hrhandle.com`
- Preview deployments are created for other branches/PRs

## Build Process

Vercel (and the CI `build` job) runs `next build`, which:
1. Runs TypeScript type checking (`tsc`) — fails on any type error (`ignoreBuildErrors: false`).
2. Bundles via the Next.js bundler; generates static pages where possible.
3. Runs `withSentryConfig` (source maps uploaded when `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN` are set).

## Lint & Tests in CI

- **ESLint** — `npm run lint` runs in the `lint-and-test` job. (It is **not** part of `next build`, so the Vercel build itself doesn't lint; the GitHub Actions job does.)
- **Tests** — `npm run test` (Vitest) runs in the `lint-and-test` job. Still worth running locally before pushing.

## TypeScript

TypeScript `^5.7.3`. All `.ts`/`.tsx` files are checked (`strict`, `noUncheckedIndexedAccess`, and — since the 2026-07 tech-debt pass — `exactOptionalPropertyTypes`). No `@ts-ignore` / `ts-nocheck` should be introduced.

## Next.js Version

Next.js `^16.2.0` (per `package.json`); exact installed version resolved by npm at install time.
