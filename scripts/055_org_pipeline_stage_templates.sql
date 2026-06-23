-- =====================================================================
-- A-5 — Org-level pipeline-stage templates
-- =====================================================================
--
-- Wave 2.6 shipped per-vacancy `pipeline_stages` (Migration 046). Every
-- new vacancy gets the hardcoded default set (Applied / Screening /
-- Interview / Offer / Hired / Rejected / Withdrawn) seeded by
-- `seed_default_pipeline_stages()`.
--
-- A-5 lets an org-admin customize that default once at the org level
-- per `Custom Stages.dc.html`. The name is free-text (any language);
-- behavior is keyed off the stage `type` enum, never the name. New
-- vacancies copy the org's template; if no template exists, the
-- hardcoded fallback runs.
--
-- Same cap-10 invariant as `pipeline_stages`. Idempotent — re-running
-- the migration is a no-op.

BEGIN;

-- 1. Org-level templates table
CREATE TABLE IF NOT EXISTS public.org_pipeline_stage_templates (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID         NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT         NOT NULL,
  type            TEXT         NOT NULL CHECK (type IN ('standard', 'interview', 'offer', 'review')),
  sort_order      INTEGER      NOT NULL,
  is_terminal     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_by      UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Two templates can't share a sort_order within an org — keeps the
-- ordered list atomic during drag-reorder.
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_pipeline_stage_templates_sort
  ON public.org_pipeline_stage_templates (organization_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_org_pipeline_stage_templates_org
  ON public.org_pipeline_stage_templates (organization_id);

-- 2. Cap-10 enforcement (mirrors pipeline_stages cap)
CREATE OR REPLACE FUNCTION public.enforce_org_pipeline_stage_templates_cap()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.org_pipeline_stage_templates WHERE organization_id = NEW.organization_id) >= 10 THEN
    RAISE EXCEPTION 'Pipeline stage templates capped at 10 per organization';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS org_pipeline_stage_templates_cap_trigger ON public.org_pipeline_stage_templates;
CREATE TRIGGER org_pipeline_stage_templates_cap_trigger
  BEFORE INSERT ON public.org_pipeline_stage_templates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_org_pipeline_stage_templates_cap();

-- 3. RLS — org-scoped read; owners + admins manage
ALTER TABLE public.org_pipeline_stage_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can view org_pipeline_stage_templates" ON public.org_pipeline_stage_templates;
CREATE POLICY "org members can view org_pipeline_stage_templates"
  ON public.org_pipeline_stage_templates FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "admins manage org_pipeline_stage_templates" ON public.org_pipeline_stage_templates;
CREATE POLICY "admins manage org_pipeline_stage_templates"
  ON public.org_pipeline_stage_templates FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
       WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles
       WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- 4. Override seed_default_pipeline_stages — copy the org's template
--    when it exists; fall back to the hardcoded default set otherwise.
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
    -- Copy the org's template
    INSERT INTO public.pipeline_stages
      (organization_id, vacancy_id, name, type, sort_order, is_terminal, created_by)
    SELECT
      p_org_id, p_vacancy_id, t.name, t.type, t.sort_order, t.is_terminal, p_created_by
      FROM public.org_pipeline_stage_templates t
     WHERE t.organization_id = p_org_id
     ORDER BY t.sort_order;
  ELSE
    -- Hardcoded fallback when no org template is defined
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

GRANT EXECUTE ON FUNCTION public.seed_default_pipeline_stages(UUID, UUID, UUID) TO authenticated;

-- 5. Helper: seed an org's template from the hardcoded defaults. Called
--    from the Settings UI's empty-state "Use defaults" CTA.
CREATE OR REPLACE FUNCTION public.seed_org_pipeline_stage_template_defaults(
  p_org_id     UUID,
  p_created_by UUID DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  -- Defence in depth: only run when the org has no template rows yet.
  IF EXISTS (SELECT 1 FROM public.org_pipeline_stage_templates WHERE organization_id = p_org_id) THEN
    RAISE EXCEPTION 'Organization already has pipeline stage templates';
  END IF;

  INSERT INTO public.org_pipeline_stage_templates
    (organization_id, name, type, sort_order, is_terminal, created_by)
  VALUES
    (p_org_id, 'Applied',    'standard',  1, FALSE, p_created_by),
    (p_org_id, 'Screening',  'review',    2, FALSE, p_created_by),
    (p_org_id, 'Interview',  'interview', 3, FALSE, p_created_by),
    (p_org_id, 'Offer',      'offer',     4, FALSE, p_created_by),
    (p_org_id, 'Hired',      'standard',  5, TRUE,  p_created_by),
    (p_org_id, 'Rejected',   'standard',  6, TRUE,  p_created_by),
    (p_org_id, 'Withdrawn',  'standard',  7, TRUE,  p_created_by);
END $$;

GRANT EXECUTE ON FUNCTION public.seed_org_pipeline_stage_template_defaults(UUID, UUID) TO authenticated;

COMMIT;
