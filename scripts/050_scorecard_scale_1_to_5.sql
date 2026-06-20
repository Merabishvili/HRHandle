-- Migration 050: scorecard scale 1–10 → 1–5 (fidelity-audit fix)
--
-- The redesigned Vacancy Detail Scorecard tab specifies a 1–5 rating
-- scale ("Attributes every interviewer rates 1–5") but the implementation
-- shipped on a 1–10 scale because the pre-design code already used it.
-- This migration brings the data layer in line with the spec.
--
-- Order is intentional:
--   1. Remap existing answers BEFORE swapping the CHECK constraint —
--      otherwise the new constraint would reject any row that still
--      carried a 6–10 value mid-migration.
--   2. Drop + recreate the CHECK constraint.
--
-- Remap formula: ceil(score / 2). This collapses 1–10 to 1–5 evenly:
--   1–2 → 1   3–4 → 2   5–6 → 3   7–8 → 4   9–10 → 5
-- Halfway points (2,4,6,8) round up so a "borderline 4" doesn't lose its
-- positive lean. The overall percentage on `candidate_evaluations.score`
-- (0–100) doesn't need a migration — it's calculated from per-attribute
-- scores at save time and recalculated on the next edit.
--
-- Idempotent — re-running this is a no-op once the new constraint is in
-- place (no row remains above 5 to remap, and DROP CONSTRAINT IF EXISTS
-- + ADD CONSTRAINT IF NOT EXISTS are guarded).

-- ── 1. Remap any existing answers above 5 ────────────────────────────
UPDATE public.candidate_evaluation_answers
SET score_value = CEIL(score_value::numeric / 2)::smallint
WHERE score_value IS NOT NULL
  AND score_value > 5;

-- ── 2. Swap the CHECK constraint ─────────────────────────────────────
ALTER TABLE public.candidate_evaluation_answers
  DROP CONSTRAINT IF EXISTS candidate_evaluation_answers_score_value_check;

ALTER TABLE public.candidate_evaluation_answers
  ADD CONSTRAINT candidate_evaluation_answers_score_value_check
  CHECK (score_value IS NULL OR (score_value >= 1 AND score_value <= 5));

COMMENT ON COLUMN public.candidate_evaluation_answers.score_value IS
  'Per-attribute interviewer score, 1–5 (Wave 2.5 fidelity fix). Aligns '
  'with Vacancy Detail.dc.html "Attributes every interviewer rates 1–5". '
  'Migration 050 remapped any prior 1–10 values via ceil(n/2).';
