-- =====================================================================
-- A-5b — Drag-reorder + safe apply-to-empty-vacancies for pipeline-
-- stage templates
-- =====================================================================
--
-- Two helpers on top of the A-5 templates:
--
-- 1. reorder_org_pipeline_stage_templates(template_ids)
--    Atomic rewrite of sort_order from a client-supplied ordered list
--    of template ids. The UNIQUE(org, sort_order) index would collide
--    with naïve per-row updates, so the function uses a two-pass
--    pattern: first push every row to a negative scratch range, then
--    write the final positive values. That way the unique index is
--    never violated mid-flight.
--
-- 2. apply_template_to_empty_vacancies(org_id)
--    Replaces the pipeline_stages of every vacancy in the org that has
--    NO live applications. Vacancies with applications are skipped —
--    re-pointing application.pipeline_stage_id across schema changes is
--    genuinely risky (loses data context, can break terminal-state
--    logic), and the safe behavior is "new vacancies pick up the new
--    template via seed_default_pipeline_stages; existing populated
--    vacancies stay put". This bulk action just sweeps the no-load
--    vacancies that were created before the template was set up.
--
-- Both functions are SECURITY INVOKER so RLS applies; both grant
-- EXECUTE to authenticated. Idempotent.

BEGIN;

CREATE OR REPLACE FUNCTION public.reorder_org_pipeline_stage_templates(
  p_template_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_org_id    UUID;
  v_count     INTEGER;
  v_distinct  INTEGER;
BEGIN
  IF p_template_ids IS NULL OR array_length(p_template_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'template_ids array is required';
  END IF;

  -- Validate every row exists, comes from the same org, and the array
  -- has no duplicates / missing rows. We do all this with one SELECT
  -- to fail fast before touching anything.
  SELECT COUNT(*), COUNT(DISTINCT organization_id)
    INTO v_count, v_distinct
    FROM public.org_pipeline_stage_templates
   WHERE id = ANY (p_template_ids);

  IF v_count <> array_length(p_template_ids, 1) THEN
    RAISE EXCEPTION 'reorder list does not cover the full template set or contains unknown ids';
  END IF;
  IF v_distinct <> 1 THEN
    RAISE EXCEPTION 'reorder list mixes multiple organizations';
  END IF;

  SELECT organization_id INTO v_org_id
    FROM public.org_pipeline_stage_templates
   WHERE id = p_template_ids[1];

  -- Pass 1: move every row to a negative scratch sort_order to dodge
  -- the UNIQUE(org, sort_order) index during the write.
  UPDATE public.org_pipeline_stage_templates t
     SET sort_order = -1 * (
           SELECT idx FROM unnest(p_template_ids) WITH ORDINALITY AS u(id, idx)
            WHERE u.id = t.id
         ),
         updated_at = NOW()
   WHERE t.id = ANY (p_template_ids);

  -- Pass 2: rewrite to the positive 1..N target ordering
  UPDATE public.org_pipeline_stage_templates t
     SET sort_order = ABS(t.sort_order),
         updated_at = NOW()
   WHERE t.id = ANY (p_template_ids);

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_org_pipeline_stage_templates(UUID[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_template_to_empty_vacancies(
  p_org_id     UUID,
  p_actor_id   UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_vacancy RECORD;
  v_updated INTEGER := 0;
BEGIN
  -- Iterate the org's vacancies that have zero applications (live or
  -- soft-deleted both count — a vacancy with archived applications
  -- still has live history we don't want to detach).
  FOR v_vacancy IN
    SELECT v.id
      FROM public.vacancies v
     WHERE v.organization_id = p_org_id
       AND v.deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.applications a
          WHERE a.vacancy_id = v.id
       )
  LOOP
    DELETE FROM public.pipeline_stages WHERE vacancy_id = v_vacancy.id;
    PERFORM public.seed_default_pipeline_stages(v_vacancy.id, p_org_id, p_actor_id);
    v_updated := v_updated + 1;
  END LOOP;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_template_to_empty_vacancies(UUID, UUID) TO authenticated;

COMMIT;
