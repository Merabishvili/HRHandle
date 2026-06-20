-- Migration 049: applications.pipeline_stage_id — Wave 2.6 Slice 1
--
-- Adds the new FK column that future code will read instead of
-- applications.status_id, and backfills both sides of the relationship so
-- the dataset is consistent before any read-side cutover.
--
-- Sequencing (per docs/redesign/tech-debt.md §1):
--   - Slice 1 (this migration + write-side wiring): both columns stay
--     populated. Reads still go to status_id. Safe — no behavior change.
--   - Slice 2: flips reads from status_id → pipeline_stage_id, removes
--     the legacy joins.
--   - Slice 3: Stage Manager UI + cross-vacancy bucket-mapper.
--   - Slice 4 (Migration 050): drop status_id.
--
-- IMPORTANT: this migration is idempotent. The backfill blocks check for
-- existing rows before inserting, so re-running it is a no-op.

-- ─────────────────────────────────────────────────────────────────────
-- 1. Add the new column
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS pipeline_stage_id UUID
  REFERENCES public.pipeline_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_applications_pipeline_stage
  ON public.applications (pipeline_stage_id);

COMMENT ON COLUMN public.applications.pipeline_stage_id IS
  'Wave 2.6 — replaces status_id once the cutover completes. References '
  'the per-vacancy pipeline_stages row. Nullable during the transition '
  'so Slice 1 ships without breaking inserts that pre-date the seeder.';

-- ─────────────────────────────────────────────────────────────────────
-- 2. Backfill pipeline_stages for every vacancy that doesn't have any
--
-- The seeder (added in Migration 046) creates the default 7-stage set:
-- Applied · Screening · Interview · Offer · Hired · Rejected · Withdrawn.
-- This block runs the seeder for every existing vacancy that doesn't
-- have any pipeline_stages yet — including soft-deleted ones, because
-- their applications still need a valid FK.
-- ─────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v RECORD;
BEGIN
  FOR v IN
    SELECT vac.id, vac.organization_id, vac.created_by
    FROM public.vacancies vac
    WHERE NOT EXISTS (
      SELECT 1 FROM public.pipeline_stages ps WHERE ps.vacancy_id = vac.id
    )
  LOOP
    PERFORM public.seed_default_pipeline_stages(v.id, v.organization_id, v.created_by);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Backfill applications.pipeline_stage_id from the legacy
--    status_id → application_statuses.code → pipeline_stages.name map.
--
-- Every existing application carries a status_id pointing at one of the
-- seven global application_statuses rows. The seeder writes pipeline_
-- stages rows with the SAME human-readable names (Applied / Screening /
-- Interview / Offer / Hired / Rejected / Withdrawn) per vacancy, so we
-- match on name within the application's vacancy.
--
-- Applications with NULL status_id (rare — only the linked-vacancy path
-- before Slice 1's writer wiring landed) stay NULL here too. Slice 2's
-- read path treats NULL pipeline_stage_id as "fall back to status_id".
-- ─────────────────────────────────────────────────────────────────────

-- PostgreSQL note: in `UPDATE x FROM y, z WHERE …` the target table `x`
-- is not visible from inside JOIN-clause predicates, only from the
-- top-level WHERE. So we flatten the two source tables into a comma
-- FROM list and put every predicate (including the join condition that
-- references `app`) into the WHERE clause.
UPDATE public.applications app
SET pipeline_stage_id = ps.id
FROM public.application_statuses ast,
     public.pipeline_stages ps
WHERE app.status_id = ast.id
  AND ps.vacancy_id = app.vacancy_id
  AND lower(ps.name) = lower(
        CASE ast.code
          WHEN 'applied'    THEN 'Applied'
          WHEN 'screening'  THEN 'Screening'
          WHEN 'interview'  THEN 'Interview'
          WHEN 'offer'      THEN 'Offer'
          WHEN 'hired'      THEN 'Hired'
          WHEN 'rejected'   THEN 'Rejected'
          WHEN 'withdrawn'  THEN 'Withdrawn'
          ELSE ast.name
        END
      )
  AND app.pipeline_stage_id IS NULL;
