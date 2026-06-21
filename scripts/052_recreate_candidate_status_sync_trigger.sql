-- Migration 052: recreate the candidate-status sync trigger keyed on
-- pipeline_stage_id — Wave 2.6 follow-up.
--
-- Background. Migration 022 added `trg_sync_candidate_status` to flip a
-- candidate's `general_status_id` to `inactive` whenever every one of
-- their applications was in a closed bucket (rejected / withdrawn /
-- hired). The trigger keyed off `applications.status_id` + a JOIN to
-- `application_statuses`, so Migration 051 had to drop it when the
-- `status_id` column went away.
--
-- The "all closed → inactive" sweep was NOT duplicated in app code
-- (updateApplicationStatus / rejectApplication / offers handle the
-- per-app hired-to-active transitions, but not the org-wide "all
-- applications closed" case). That left a small UX regression: a
-- candidate with only closed apps stayed at `active` instead of
-- falling to `inactive` on the Candidates index filter.
--
-- This migration recreates the trigger on the new model:
--   - Fires on UPDATE OF pipeline_stage_id (the new column).
--   - Joins `pipeline_stages` and checks `is_terminal` instead of
--     reading codes off `application_statuses`. Custom rejection
--     stages ("Closed - not a fit") count as closed because they're
--     flagged terminal; the canonical seeded Hired/Rejected/Withdrawn
--     are also is_terminal=true.
--   - INSERT + DELETE branches kept so the count stays consistent when
--     a new application is added or one is hard-deleted.
--
-- Idempotent — `CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS`
-- + `CREATE TRIGGER` makes re-runs a no-op.

CREATE OR REPLACE FUNCTION public.sync_candidate_status_on_application_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_org_id             UUID;
  v_candidate_id       UUID;
  v_open_count         INT;
  v_inactive_status_id UUID;
BEGIN
  v_org_id       := COALESCE(NEW.organization_id, OLD.organization_id);
  v_candidate_id := COALESCE(NEW.candidate_id, OLD.candidate_id);

  -- Count applications still in a non-terminal stage. An application
  -- with NULL pipeline_stage_id counts as open (defensive — happens
  -- only between an insert and its first stage assignment).
  SELECT COUNT(*) INTO v_open_count
  FROM public.applications a
  LEFT JOIN public.pipeline_stages ps ON a.pipeline_stage_id = ps.id
  WHERE a.candidate_id    = v_candidate_id
    AND a.organization_id = v_org_id
    AND a.deleted_at IS NULL
    AND (ps.id IS NULL OR ps.is_terminal = FALSE);

  IF v_open_count = 0 THEN
    SELECT id INTO v_inactive_status_id
    FROM public.candidate_statuses
    WHERE code = 'inactive'
    LIMIT 1;

    IF v_inactive_status_id IS NOT NULL THEN
      UPDATE public.candidates
      SET general_status_id = v_inactive_status_id
      WHERE id              = v_candidate_id
        AND organization_id = v_org_id
        AND deleted_at IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.sync_candidate_status_on_application_change()
  SET search_path = pg_catalog, public;

DROP TRIGGER IF EXISTS trg_sync_candidate_status ON public.applications;
CREATE TRIGGER trg_sync_candidate_status
  AFTER INSERT OR UPDATE OF pipeline_stage_id OR DELETE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.sync_candidate_status_on_application_change();
