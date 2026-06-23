-- =====================================================================
-- A-4 — Scorecard recommendation columns
-- =====================================================================
--
-- Per `Candidate Profile A Refined.dc.html`, the recruiter's verdict on
-- the contextual block (Move to interview? / Hire?) is binary — Yes or
-- No — with a required one-line reason. We persist that on
-- `candidate_evaluations` so it travels with the scorecard:
--
--   recommendation        TEXT  — 'yes' | 'no' | NULL
--   recommendation_reason TEXT  — one-line justification (nullable in DB;
--                                 form enforces non-empty before save)
--
-- The matching `must_have` flag on attributes already shipped in
-- Migration 047 (Wave 2.5 Slice 1), so the original A-4 scope is now
-- complete with this migration.
--
-- Idempotent — re-running this is a no-op.

BEGIN;

ALTER TABLE public.candidate_evaluations
  ADD COLUMN IF NOT EXISTS recommendation        TEXT,
  ADD COLUMN IF NOT EXISTS recommendation_reason TEXT;

-- Constraint: only 'yes' / 'no' or NULL. Drop-then-add so re-runs reset
-- the check if its definition changes in the future.
ALTER TABLE public.candidate_evaluations
  DROP CONSTRAINT IF EXISTS candidate_evaluations_recommendation_check;
ALTER TABLE public.candidate_evaluations
  ADD CONSTRAINT candidate_evaluations_recommendation_check
    CHECK (recommendation IS NULL OR recommendation IN ('yes', 'no'));

COMMENT ON COLUMN public.candidate_evaluations.recommendation IS
  'A-4 / Wave 2.3 — Binary advance-or-reject recommendation captured from '
  'the candidate profile per Candidate Profile A Refined.dc.html. The UI '
  'label varies by stage ("Move to interview?", "Hire?") but the data is '
  'always yes / no.';

COMMENT ON COLUMN public.candidate_evaluations.recommendation_reason IS
  'A-4 — Required one-line justification accompanying the recommendation. '
  'Nullable in the DB; the form enforces non-empty before save.';

COMMIT;
