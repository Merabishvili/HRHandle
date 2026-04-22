# HRHandle

Applicant Tracking System (ATS) built with Next.js, Supabase, and Tailwind CSS.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (email/password)
- **Styling:** Tailwind CSS 4 + Radix UI
- **Language:** TypeScript 5 (strict)
- **Hosting:** Vercel

## Local Setup

### 1. Prerequisites

- Node.js 20+
- npm 10+
- A Supabase project (free tier works)

### 2. Clone and install

```bash
git clone <repo-url>
cd hrhandle
npm install
```

### 3. Environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` with your Supabase project credentials from the Supabase dashboard → Settings → API.

> **Never commit `.env.local`.** It is gitignored. The service role key bypasses all database security — rotate it immediately if it leaks.

### 4. Database

Apply the schema to your Supabase project. Migration files are in `supabase/migrations/`.

```bash
npx supabase db push
```

### 5. Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
app/                   Next.js App Router pages
  (dashboard)/         Protected routes (requires auth)
  auth/                Login, sign-up, password reset
  api/                 API route handlers
components/
  ui/                  Radix UI primitives (shadcn/ui)
  candidates/          Candidate feature components
  vacancies/           Vacancy feature components
  interviews/          Interview feature components
  settings/            Settings feature components
lib/
  supabase/            Supabase client helpers (browser, server, admin)
  types/               TypeScript types per domain
  validations/         Zod schemas per domain
  actions/             Next.js Server Actions per domain
supabase/
  migrations/          Database migration SQL files
```

## Key Concepts

- **Organization isolation:** Every DB row is scoped to `organization_id`. Supabase RLS policies enforce this at the database level.
- **Server Actions:** All data mutations go through `lib/actions/` (server-side) — never directly from client components.
- **Subscriptions:** Trial (7 days, 5 vacancies, 100 candidates) → Professional ($49/month). Stripe handles billing.

## Deployment

Deployed on Vercel. Set the same environment variables in Vercel dashboard → Settings → Environment Variables.

## Contributing

1. Create a feature branch
2. Make changes
3. Run `npm run lint` and `npm run build` locally before pushing
4. Open a PR
