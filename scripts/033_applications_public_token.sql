-- Migration 033: Add a per-application public token for the candidate status page
--
-- G-016 ships a token-based public URL at /status/<token> where a candidate can
-- check the abstracted status of their own application (Applied / In review /
-- Interview / Decision / Closed) without an account. The token is a 32-char
-- hex string (UUID-without-hyphens), mirrors the `application_form_token` on
-- vacancies, and is generated server-side at application INSERT time. Looked
-- up via the admin client; no RLS opening required.
--
-- Existing applications are backfilled so historic candidates can also be sent
-- a link (e.g. by a recruiter manually clicking "Copy status link"). The
-- backfill uses the same shape as the new code path: `replace(gen_random_uuid()::text, '-', '')`.
--
-- Apply in Supabase: Dashboard → SQL Editor → run this file on BOTH the
-- staging (quotchdymcnjlnwtjmgu) and production (fnpyfwhvgzoxgyjafbsg)
-- projects before/with the deploy. Safe to re-run (column existence check
-- + idempotent backfill on NULLs only).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'applications'
      AND column_name  = 'public_token'
  ) THEN
    ALTER TABLE public.applications
      ADD COLUMN public_token TEXT UNIQUE;

    RAISE NOTICE 'Added public_token to applications.';
  ELSE
    RAISE NOTICE 'public_token already exists on applications, skipping ADD COLUMN.';
  END IF;
END
$$;

-- Backfill any rows still missing a token. Done in a single UPDATE statement —
-- one transaction; cheap at current scale. Re-running this script is a no-op
-- because the WHERE clause excludes already-backfilled rows.
UPDATE public.applications
SET public_token = replace(gen_random_uuid()::text, '-', '')
WHERE public_token IS NULL;

-- Index for the only access pattern: token → application lookup.
CREATE INDEX IF NOT EXISTS idx_applications_public_token
  ON public.applications (public_token)
  WHERE public_token IS NOT NULL;
