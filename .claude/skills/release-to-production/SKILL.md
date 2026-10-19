---
name: release-to-production
description: Prepare a HRHandle production release - diff staging vs main, list migrations and config steps in the right order, open the staging to main PR with a checklist. Use when the owner asks to release, ship to production, or "promote staging".
---

# Release staging to production

Claude prepares the release; the owner merges. Never merge the PR, push to `main`, deploy or promote on Vercel, or apply a production migration without the owner's explicit approval in the thread.

## 1. See what is waiting

```bash
git fetch origin main staging
git log --oneline origin/main..origin/staging
git diff --stat origin/main origin/staging
git diff --name-only origin/main origin/staging -- supabase/migrations scripts/*.sql
```

Group the commits into: user-facing changes, fixes, internal (docs, tests, tooling). If nothing user-facing is waiting, say so and stop.

## 2. Find everything outside the code

For every changed area, check:

| Look for | Where | Release step |
|---|---|---|
| New or changed migration | `supabase/migrations/`, `scripts/0*.sql` | Apply on production in the order below; read the file header for "deploy code first" |
| New env var | `lib/env.ts`, `.env.example`, `docs/5-environment/variables.md` | Owner sets it on Vercel production before merging |
| Supabase dashboard config | Email templates, redirect URLs, OAuth, SMTP (see `docs/6-deployment/process.md`) | Owner applies on the production project too |
| New cron | `vercel.json` | Check the Hobby plan cron limit |
| External callback URL | Flitt, Calendly, webhooks | Must use the `www.hrhandle.com` host |
| Legal text | `components/legal/content/` | `LEGAL_UPDATED` bumped |

## 3. Check the migrations' state on both databases

Use the Supabase connector. Staging (`quotchdymcnjlnwtjmgu`) may be read freely; production (`fnpyfwhvgzoxgyjafbsg`) only with the owner's go-ahead in this thread. Write a read-only query that detects each migration's objects (a function, policy, column or grant it creates) and run it on both. Never run DDL on production.

Order rules:
- A migration the new code needs (new column, table) goes **before** merging.
- A migration that restricts access the old code relies on (RLS tightening, dropped column) goes **after** the deploy is live. The file header usually says which.

## 4. Verify staging is green

- CI on the latest `staging` commit is green (GitHub connector: check runs on the head commit).
- `npm run lint && npm test` locally if anything is in doubt.
- Sentry `hrhandle-staging`: no new issues since the last staging deploy.

## 5. Open the PR

Open `staging` → `main` with the repo PR template (`.github/pull_request_template.md`). In **Notes**, put the release checklist in order:

```
Before merge:  [ ] env vars set on Vercel production: …
               [ ] migrations to apply first: …
Merge
After deploy:  [ ] migrations to apply after: …
               [ ] Supabase dashboard changes on production: …
               [ ] smoke test: log in, open /pipeline, open one candidate, public /jobs page
```

Assign the owner and request their review. Subscribe to the PR and drive CI green.

## 6. After the owner merges

- Check the production deploy finished (Vercel connector) and Sentry `hrhandle-production` shows no new errors in the first hour.
- Update `/mnt/project-files/kb/release-state.md`: both heads, each migration's state, date.
