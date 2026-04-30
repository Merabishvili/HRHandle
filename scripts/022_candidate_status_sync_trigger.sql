-- Migration 022: Auto-sync candidate general_status when all their applications are closed/rejected
-- Run in Supabase SQL editor

CREATE OR REPLACE FUNCTION sync_candidate_status_on_application_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_org_id        UUID;
  v_candidate_id  UUID;
  v_closed_code   TEXT;
  v_open_count    INT;
  v_inactive_status_id UUID;
BEGIN
  v_org_id       := COALESCE(NEW.organization_id, OLD.organization_id);
  v_candidate_id := COALESCE(NEW.candidate_id, OLD.candidate_id);

  -- Count applications that are still in an "active pipeline" state
  SELECT COUNT(*) INTO v_open_count
  FROM applications a
  JOIN application_statuses s ON a.status_id = s.id
  WHERE a.candidate_id    = v_candidate_id
    AND a.organization_id = v_org_id
    AND a.deleted_at IS NULL
    AND s.code NOT IN ('rejected', 'withdrawn', 'hired');

  -- If no active applications remain, mark candidate as inactive
  IF v_open_count = 0 THEN
    SELECT id INTO v_inactive_status_id
    FROM candidate_statuses
    WHERE code = 'inactive'
    LIMIT 1;

    IF v_inactive_status_id IS NOT NULL THEN
      UPDATE candidates
      SET general_status_id = v_inactive_status_id
      WHERE id            = v_candidate_id
        AND organization_id = v_org_id
        AND deleted_at IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_candidate_status ON applications;
CREATE TRIGGER trg_sync_candidate_status
  AFTER INSERT OR UPDATE OF status_id OR DELETE ON applications
  FOR EACH ROW EXECUTE FUNCTION sync_candidate_status_on_application_change();
