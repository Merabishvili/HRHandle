-- Migration 031: Add soft-delete support to organizations
--
-- The self-serve "Delete Organization" flow (G-007) marks an org for
-- deletion by setting deleted_at; the daily purge cron
-- (app/api/cron/purge-deleted/route.ts) hard-deletes the row after the
-- 30-day grace period promised in Privacy Policy §7, cascading to all
-- child tables via existing FK CASCADE rules.
--
-- Apply in Supabase: Dashboard → SQL Editor → run this file.
-- Safe to run multiple times (checks column existence first).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'organizations'
      AND column_name  = 'deleted_at'
  ) THEN
    ALTER TABLE public.organizations
      ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

    -- Partial index: same shape as other deleted_at columns in this schema
    -- (vacancies, candidates, applications). Speeds up the common
    -- "active orgs" filter; the purge cron does a full scan once per day
    -- and doesn't need an index over the non-null side.
    CREATE INDEX IF NOT EXISTS idx_organizations_deleted_at
      ON public.organizations (deleted_at)
      WHERE deleted_at IS NULL;

    RAISE NOTICE 'Added deleted_at to organizations.';
  ELSE
    RAISE NOTICE 'deleted_at already exists on organizations, skipping.';
  END IF;
END
$$;
