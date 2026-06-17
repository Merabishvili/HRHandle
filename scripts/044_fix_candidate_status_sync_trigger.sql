-- Migration 044: Fix candidate status sync trigger (Phase 0.1 of redesign work)
--
-- Bug: Migration 022 (`scripts/022_candidate_status_sync_trigger.sql`) introduced
-- a trigger that syncs `candidates.general_status_id` when all of a candidate's
-- applications close (rejected/withdrawn). It looks for `candidate_statuses.code
-- = 'inactive'`. But Migration 009 (`scripts/009_simplify_candidate_statuses.sql`)
-- simplified the candidate statuses to `'active' | 'hired' | 'archived'` only —
-- 'inactive' was removed.
--
-- Result: the trigger is silently a no-op for the common "all-apps-rejected"
-- case. It fires correctly when an offer is accepted (the `hired` code still
-- exists), but does nothing on close-out.
--
-- This migration replaces the lookup with `'archived'`, which is the correct
-- modern equivalent.
--
-- Discovered: 2026-06-15 during redesign audit
-- (`docs/redesign/audit.md` §2.4 / RR-01 / Phase 0.1).
--
-- Apply in Supabase: Dashboard → SQL Editor → run this file on BOTH the
-- staging (quotchdymcnjlnwtjmgu) and production (fnpyfwhvgzoxgyjafbsg)
-- projects. Idempotent (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION sync_candidate_status_on_application_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_org_id              UUID;
  v_candidate_id        UUID;
  v_open_count          INT;
  v_archived_status_id  UUID;
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

  -- If no active applications remain, mark candidate as archived
  --
  -- Migration 022 looked for code = 'inactive', which Migration 009 removed.
  -- 'archived' is the correct modern equivalent.
  IF v_open_count = 0 THEN
    SELECT id INTO v_archived_status_id
    FROM candidate_statuses
    WHERE code = 'archived'
    LIMIT 1;

    IF v_archived_status_id IS NOT NULL THEN
      UPDATE candidates
      SET general_status_id = v_archived_status_id
      WHERE id              = v_candidate_id
        AND organization_id = v_org_id
        AND deleted_at IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END $$;

-- The trigger itself doesn't need re-creating — Migration 022 already wired
-- `applications_status_sync_trigger` to call this function. Updating the
-- function body via CREATE OR REPLACE is enough.
