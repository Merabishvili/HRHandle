-- #3 — Multi-reviewer scorecards.
--
-- candidate_evaluations was one-per-application (UNIQUE (application_id)) with a
-- binary recommendation. This moves to one-per-reviewer-per-application, a
-- 4-value recommendation, and a submitted flag (draft vs submitted) so the UI
-- can hide other reviewers' cards until you submit yours (anti-anchoring).
--
-- Existing rows are kept as legacy anonymous (reviewer_id NULL), marked
-- submitted = true; their yes/no recommendations remain valid. The pipeline
-- fit score becomes the average of *submitted* rows per application.
--
-- Apply on staging now; apply on production with the deploy.

BEGIN;

ALTER TABLE public.candidate_evaluations
  ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted   BOOLEAN NOT NULL DEFAULT false;

-- Treat pre-existing single-per-application rows as submitted (they were final).
UPDATE public.candidate_evaluations
  SET submitted = true
  WHERE reviewer_id IS NULL;

-- One evaluation per reviewer per application (was one per application).
ALTER TABLE public.candidate_evaluations
  DROP CONSTRAINT IF EXISTS candidate_evaluations_application_id_key;
ALTER TABLE public.candidate_evaluations
  DROP CONSTRAINT IF EXISTS candidate_evaluations_app_reviewer_key;
ALTER TABLE public.candidate_evaluations
  ADD CONSTRAINT candidate_evaluations_app_reviewer_key UNIQUE (application_id, reviewer_id);

-- 4-value recommendation (was binary yes/no). Existing yes/no stay valid.
ALTER TABLE public.candidate_evaluations
  DROP CONSTRAINT IF EXISTS candidate_evaluations_recommendation_check;
ALTER TABLE public.candidate_evaluations
  ADD CONSTRAINT candidate_evaluations_recommendation_check
    CHECK (recommendation IS NULL OR recommendation IN ('strong_yes', 'yes', 'lean_no', 'no'));

COMMENT ON COLUMN public.candidate_evaluations.reviewer_id IS
  '#3 — the reviewer who submitted this card. NULL = legacy anonymous row.';
COMMENT ON COLUMN public.candidate_evaluations.submitted IS
  '#3 — false = draft (hidden from other reviewers); true = submitted.';

COMMIT;
