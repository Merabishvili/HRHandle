# CI/CD

## Overview

Continuous deployment is handled by Vercel. There is no separate CI workflow file (e.g. GitHub Actions) in the repository — Vercel's build serves as the CI gate.

## Vercel Auto-Deploy

- Push to `staging` branch → deploys to `staging.hrhandle.com`
- Merge to `main` branch (via PR) → deploys to `hrhandle.com`
- Preview deployments are created for all other branches/PRs

## Build Process

Vercel runs `next build` which:
1. Runs TypeScript type checking (`tsc`) — fails on any type error (`ignoreBuildErrors: false`)
2. Bundles the application using the Next.js bundler
3. Generates static pages where possible
4. Runs `withSentryConfig` to wrap the Next.js config (source maps uploaded if `NEXT_PUBLIC_SENTRY_DSN` is set)

## ESLint

ESLint is **not run during the CI build**. It was removed due to incompatibilities with ESLint 9. The `eslint` and `eslint-config-next` packages are still in `devDependencies` and `npm run lint` can be run locally, but it is not part of the build pipeline.

## Hardcoded Placeholder Env Vars

The Vercel build environment uses hardcoded placeholder values for env vars that are required at build time but not needed for static analysis. This allows the build to pass without real secrets being available in every CI context. The actual values are set as Vercel environment secrets and used at runtime.

## TypeScript

TypeScript version: `^5.7.3`. All `.ts`/`.tsx` files are checked. No `// @ts-ignore` or `ts-nocheck` patterns should be introduced.

## No Test Run in CI

Tests (`npm test` via Vitest) are not run as part of the Vercel build. Tests should be run locally before pushing. A dedicated CI workflow for tests (e.g. GitHub Actions) would need to be added separately.

## Next.js Version

Next.js `^16.2.0` as declared in `package.json`. The exact version installed is resolved by npm at install time. Build logs from Vercel show the resolved version.
