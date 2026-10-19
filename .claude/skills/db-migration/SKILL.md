---
name: db-migration
description: Write and apply a HRHandle Supabase migration safely - dated file, RLS, staging first, production only with approval, docs and release state updated. Use for any schema, RLS, grant, function, trigger or view change.
---

# Database migration

Migrations are applied by hand in the Supabase SQL editor (or the Supabase connector) on two separate projects. The repo SQL is not guaranteed to match either live database, so always look at the live schema first.

| | Staging | Production |
|---|---|---|
| Project ID | `quotchdymcnjlnwtjmgu` | `fnpyfwhvgzoxgyjafbsg` |
| Claude may | Read, apply migrations | Read only with the owner's go-ahead; apply only with explicit approval |

## 1. Look at the live schema first

Use the Supabase connector on staging: `list_tables`, or `execute_sql` against `information_schema` / `pg_policies` / `pg_proc` for the objects you touch. Live policy names often differ from the repo; drop policies by lookup, not by name.

## 2. Write the file

- Path: `supabase/migrations/YYYYMMDD_short_name.sql` (today's date). Older numbered files in `scripts/0*.sql` are history; don't add new ones there.
- Header comment, like the existing files: what changes and why, whether to apply **before** or **after** the code deploys, "Apply on BOTH staging (quotchdymcnjlnwtjmgu) and production (fnpyfwhvgzoxgyjafbsg)", "Safe to re-run".
- Idempotent: `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`, guarded `DO $$ … $$` blocks.
- Every new table: `ENABLE ROW LEVEL SECURITY` plus org-scoped policies. Secret columns: column grants so `authenticated` can't select them (see `20261010_organization_integrations_fixes.sql`).
- `SECURITY DEFINER` functions: `SET search_path = public`, `REVOKE ALL … FROM PUBLIC, anon`, grant only to `authenticated`.
- A new FK between `profiles` and `organizations` (or another pair that already has one) makes PostgREST embeds ambiguous: grep for embeds of that pair and hint them (`organizations!organization_id ( … )`).

## 3. Apply on staging and verify

Apply with the connector (`apply_migration` on staging only). Then verify with a read-only query that the objects exist, and run `get_advisors` (security and performance) on staging. Run the app's tests: `npm test`.

## 4. Update the code, docs and tests in the same change

- TypeScript types that describe the changed rows (search the code for the table name).
- `docs/3-architecture/database.md`: the table section and changelog.
- `docs/1-product/roadmap.md`: under the feature, "migrations to apply on both projects".
- Tests for any new RLS-dependent logic.

## 5. Production

Do not apply it yourself unless the owner says so in the thread. Add it to `/mnt/project-files/kb/release-state.md` with "staging: applied <date>, production: pending (before|after deploy)". The `release-to-production` skill picks it up.
