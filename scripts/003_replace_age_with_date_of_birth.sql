-- Migration 003: Replace candidates.age with date_of_birth
-- age is a GDPR/EEOC risk — storing it directly enables discrimination claims.
-- date_of_birth lets us derive age at read time and satisfies data minimisation.
--
-- Apply in Supabase: Dashboard → SQL Editor → run this file.
-- Safe to run multiple times (checks column existence at each step).

DO $$
BEGIN
  -- Step 1: add date_of_birth column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'candidates'
      AND column_name  = 'date_of_birth'
  ) THEN
    ALTER TABLE public.candidates
      ADD COLUMN date_of_birth DATE DEFAULT NULL;

    RAISE NOTICE 'Added date_of_birth to candidates.';
  ELSE
    RAISE NOTICE 'date_of_birth already exists on candidates, skipping add.';
  END IF;

  -- Step 2: drop age column (no backfill — existing age values are too imprecise
  -- to convert to a birth date and storing them would perpetuate the risk)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'candidates'
      AND column_name  = 'age'
  ) THEN
    ALTER TABLE public.candidates DROP COLUMN age;

    RAISE NOTICE 'Dropped age from candidates.';
  ELSE
    RAISE NOTICE 'age column not found on candidates, skipping drop.';
  END IF;
END
$$;
