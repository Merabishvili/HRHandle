-- =============================================================================
-- 030_add_restored_audit_columns.sql
--
-- Adds `restored_at` + `restored_by` columns to `candidates` and `vacancies`
-- so that un-deletes (soft-restore) can be audited the same way `deleted_at`
-- captures soft-deletes.
--
-- Audit ref: F-011. Prior to this script, restoring a soft-deleted row simply
-- nulled `deleted_at` with no record of who restored it or when.
--
-- IMPORTANT: this script is **idempotent** — safe to re-run. Apply via Supabase
-- SQL Editor on both staging and production.
-- =============================================================================

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS restored_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS restored_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.vacancies
  ADD COLUMN IF NOT EXISTS restored_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS restored_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Comments document the lifecycle so future readers don't need to dig through
-- audit notes.
COMMENT ON COLUMN public.candidates.restored_at IS 'Set when a soft-deleted candidate is restored (deleted_at cleared). NULL otherwise.';
COMMENT ON COLUMN public.candidates.restored_by IS 'Profile that restored the candidate, if any.';
COMMENT ON COLUMN public.vacancies.restored_at IS 'Set when a soft-deleted vacancy is restored (deleted_at cleared). NULL otherwise.';
COMMENT ON COLUMN public.vacancies.restored_by IS 'Profile that restored the vacancy, if any.';
