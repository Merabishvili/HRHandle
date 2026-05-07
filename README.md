# HRHandle

Applicant Tracking System (ATS) built with Next.js, Supabase, and Tailwind CSS.

## Tech Stack

Next.js 16 (App Router) · Supabase (PostgreSQL + Auth) · Tailwind CSS 4 · Radix UI · TypeScript 5 · Vercel

## Quick Start

```bash
git clone <repo-url>
cd HRHandle-staging
npm install
cp .env.example .env.local   # fill in Supabase keys
npm run dev
```

See [docs/5-environment/local.md](docs/5-environment/local.md) for full setup instructions including Supabase config, Turnstile CAPTCHA, and running tests.

## Documentation

| Section | Path |
|---|---|
| Product overview & features | `docs/1-product/` |
| Architecture & database | `docs/3-architecture/` |
| Third-party integrations | `docs/4-integrations/` |
| Environment variables | `docs/5-environment/` |
| Deployment & CI/CD | `docs/6-deployment/` |
| API endpoints | `docs/7-api/` |
| Key decisions | `docs/8-decisions.md` |

## Contributing

1. Work on the `staging` branch
2. Run `npm run lint && npm run build` locally before pushing
3. Open a PR — CI runs lint and tests automatically
