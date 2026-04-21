-- Migration 002: Add soft-delete support to vacancies
-- Vacancies previously used archived_at for archiving but had no deleted_at,
-- inconsistent with candidates and applications. This adds deleted_at so all
-- three entities share the same soft-delete pattern.
--
-- Apply in Supabase: Dashboard → SQL Editor → run this file.
-- Safe to run multiple times (checks column existence first).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'vacancies'
      AND column_name  = 'deleted_at'
  ) THEN
    ALTER TABLE public.vacancies
      ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

    -- Index to keep soft-delete filter fast
    CREATE INDEX IF NOT EXISTS idx_vacancies_deleted_at
      ON public.vacancies (deleted_at)
      WHERE deleted_at IS NULL;

    RAISE NOTICE 'Added deleted_at to vacancies.';
  ELSE
    RAISE NOTICE 'deleted_at already exists on vacancies, skipping.';
  END IF;
END
$$;
