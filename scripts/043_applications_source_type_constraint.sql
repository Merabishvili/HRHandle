-- Migration 043: expand applications.source_type CHECK constraint (G-034)
--
-- Migration 039 set `applications.source_type` DEFAULT 'manual' and backfilled
-- existing NULL rows with 'manual' so the source-effectiveness report had
-- recruiter-created applications tagged. But it didn't touch the existing
-- CHECK constraint, which still restricted the column to ('internal',
-- 'public_form') only. Result: every recruiter-created application after the
-- code-side update (lib/actions/candidates.ts createCandidate's linked-vacancy
-- path + lib/actions/applications.ts addApplicationToCandidate) hit
-- `applications_source_type_check` and failed with "Failed to create
-- application." The bug was masked locally because the createCandidate
-- silently ignores the application insert error.
--
-- This migration drops the old constraint and replaces it with one that
-- accepts the full set of source codes the code actually emits today —
-- 'manual', 'public_form', 'csv_import', 'linkedin' — plus the legacy
-- 'internal' value (kept for backwards compatibility with rows created
-- before 039).
--
-- Apply in Supabase: Dashboard → SQL Editor → run this file on BOTH the
-- staging (quotchdymcnjlnwtjmgu) and production (fnpyfwhvgzoxgyjafbsg)
-- projects. Safe to re-run.

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_source_type_check;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_source_type_check
  CHECK (source_type = ANY (ARRAY[
    'manual'::text,
    'public_form'::text,
    'csv_import'::text,
    'linkedin'::text,
    'internal'::text
  ]));
