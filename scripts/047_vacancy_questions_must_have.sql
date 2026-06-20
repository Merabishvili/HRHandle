-- 047_vacancy_questions_must_have.sql
--
-- Wave 2.5 Slice 1 — Scorecard attribute must-have flag.
--
-- The redesigned vacancy wizard (Wave 2.7) added a "must-have ★" toggle to
-- each scorecard attribute so interviewers can see which attributes are
-- hard requirements vs nice-to-haves before they rate. The column is added
-- with a default of FALSE so existing rows keep their semantics (all
-- previous questions become "nice-to-have"), and downstream scoring code
-- that doesn't yet know about must_have continues to work.
--
-- This migration is idempotent — re-running it is a no-op.

ALTER TABLE public.vacancy_questions
  ADD COLUMN IF NOT EXISTS must_have BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.vacancy_questions.must_have IS
  'Wave 2.5 — Marks an attribute as a hard requirement on the interview scorecard. '
  'UI surfaces this with a star; future scoring logic may treat the overall '
  'evaluation as failing if any must_have attribute scores below threshold.';
