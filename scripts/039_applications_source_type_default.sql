-- Migration 039: applications.source_type backfill + default (G-029, Phase 4)
--
-- The source-effectiveness report groups applications by `source_type`. Today
-- only the public apply form sets it (`'public_form'`); recruiter-created
-- applications (via the candidate form's linked-vacancy path or
-- `addApplicationToCandidate`) leave it NULL. Without this migration the
-- source-effectiveness report would show every recruiter-created row as
-- "Unknown" forever.
--
-- This migration:
--   1. Sets `source_type = 'manual'` on every existing NULL row.
--   2. Adds a DEFAULT 'manual' so future inserts without an explicit value
--      get tagged automatically. Callers that DO know the source
--      (public_form, csv_import, etc.) still pass it explicitly.
--
-- Apply in Supabase: Dashboard → SQL Editor → run this file on BOTH the
-- staging (quotchdymcnjlnwtjmgu) and production (fnpyfwhvgzoxgyjafbsg)
-- projects. Safe to re-run.

UPDATE public.applications
   SET source_type = 'manual'
 WHERE source_type IS NULL;

ALTER TABLE public.applications
  ALTER COLUMN source_type SET DEFAULT 'manual';
