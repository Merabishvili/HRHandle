-- =====================================================================
-- Main pipeline ↔ per-vacancy stage origin link
-- =====================================================================
--
-- Part of "Main pipeline drives the cross-vacancy board". The org-level
-- `org_pipeline_stage_templates` ("Main pipeline") now renders the
-- columns of the cross-vacancy /pipeline board, and every new vacancy is
-- seeded from it. To bucket an application onto the right main-board
-- column, each per-vacancy `pipeline_stages` row records the Main-
-- pipeline row it was copied from via `origin_template_id`.
--
--   - Seeded (inherited) stages carry the link → deterministic roll-up.
--   - Vacancy-only stages a recruiter adds have NULL origin → the board
--     falls back to type-based bucketing for them.
--
-- No backfill: existing data is being wiped before relaunch, so this
-- only needs to serve stages created from here on.
--
-- Apply on BOTH Supabase projects (staging + production). Idempotent.

BEGIN;

ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS origin_template_id UUID
    REFERENCES public.org_pipeline_stage_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_origin
  ON public.pipeline_stages (origin_template_id);

COMMENT ON COLUMN public.pipeline_stages.origin_template_id IS
  'The org_pipeline_stage_templates ("Main pipeline") row this stage was seeded from. NULL for vacancy-only stages added directly on a vacancy. Drives the cross-vacancy board column mapping.';

-- Re-define the seeder so template-copied stages carry the origin link.
-- The hardcoded fallback branch (org with no Main pipeline) leaves origin
-- NULL — the board falls back to its canonical columns for that org.
CREATE OR REPLACE FUNCTION public.seed_default_pipeline_stages(
  p_vacancy_id UUID,
  p_org_id     UUID,
  p_created_by UUID DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_template_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_template_count
    FROM public.org_pipeline_stage_templates
   WHERE organization_id = p_org_id;

  IF v_template_count > 0 THEN
    -- Copy the org's Main pipeline, carrying the origin link on each row.
    INSERT INTO public.pipeline_stages
      (organization_id, vacancy_id, name, type, sort_order, is_terminal, created_by, origin_template_id)
    SELECT
      p_org_id, p_vacancy_id, t.name, t.type, t.sort_order, t.is_terminal, p_created_by, t.id
      FROM public.org_pipeline_stage_templates t
     WHERE t.organization_id = p_org_id
     ORDER BY t.sort_order;
  ELSE
    -- Hardcoded fallback when no Main pipeline is defined (origin NULL).
    INSERT INTO public.pipeline_stages
      (organization_id, vacancy_id, name,        type,        sort_order, is_terminal, created_by)
    VALUES
      (p_org_id, p_vacancy_id, 'Applied',    'standard',  1, FALSE, p_created_by),
      (p_org_id, p_vacancy_id, 'Screening',  'review',    2, FALSE, p_created_by),
      (p_org_id, p_vacancy_id, 'Interview',  'interview', 3, FALSE, p_created_by),
      (p_org_id, p_vacancy_id, 'Offer',      'offer',     4, FALSE, p_created_by),
      (p_org_id, p_vacancy_id, 'Hired',      'standard',  5, TRUE,  p_created_by),
      (p_org_id, p_vacancy_id, 'Rejected',   'standard',  6, TRUE,  p_created_by),
      (p_org_id, p_vacancy_id, 'Withdrawn',  'standard',  7, TRUE,  p_created_by);
  END IF;
END $$;

COMMIT;
