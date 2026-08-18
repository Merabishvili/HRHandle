-- Migration 032: Add saved interview questions to vacancies
--
-- The AI interview-questions feature (G-011) lets recruiters generate and
-- save a set of suggested questions per vacancy. The questions are stored
-- as a JSONB blob shaped:
--
--   {
--     "behavioural":  ["...", "..."],
--     "technical":    ["...", "..."],
--     "situational":  ["...", "..."],
--     "closing":      ["...", "..."]
--   }
--
-- Nullable: vacancies created before this migration (and vacancies where the
-- recruiter never saved any questions) have NULL here, which the UI treats
-- as "no saved questions yet".
--
-- Apply in Supabase: Dashboard → SQL Editor → run this file on BOTH the
-- staging (quotchdymcnjlnwtjmgu) and production (fnpyfwhvgzoxgyjafbsg)
-- projects before/with the deploy. Safe to re-run (column existence check).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'vacancies'
      AND column_name  = 'interview_questions'
  ) THEN
    ALTER TABLE public.vacancies
      ADD COLUMN interview_questions JSONB DEFAULT NULL;

    RAISE NOTICE 'Added interview_questions to vacancies.';
  ELSE
    RAISE NOTICE 'interview_questions already exists on vacancies, skipping.';
  END IF;
END
$$;
