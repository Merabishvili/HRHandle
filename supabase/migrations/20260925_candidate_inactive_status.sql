-- =====================================================================
-- Candidate status: introduce "inactive" (არააქტიური)
-- =====================================================================
--
-- The candidate general-status model is auto-derived:
--   • active   (მიმდინარე)   — candidate has ≥1 open (non-terminal) application
--   • inactive (არააქტიური)  — candidate has NO open application
--                              (never had one — e.g. bulk-imported / manually
--                              added without a vacancy — or all applications
--                              have closed)
--   • hired    (დაქირავებული) — settled; left as-is
--
-- The "all applications closed → inactive" sweep already exists as a trigger
-- (Migration 052, `sync_candidate_status_on_application_change`) but it targets
-- `candidate_statuses.code = 'inactive'`, which was NEVER seeded — only
-- active/hired/archived existed (Migration 009). So the sweep was a silent
-- no-op. This migration converts the vestigial, unused `archived` status into
-- `inactive` (nothing sets `archived` in app code — it was dead after the
-- Wave 1.1 "status is no longer user-editable" change), which both fixes the
-- trigger and gives imports/manual-adds a real "inactive" status to use.
--
-- No backfill of existing candidates is needed (data is wiped before relaunch).
-- Idempotent. Apply on BOTH Supabase projects (staging + production).

DO $$
DECLARE
  v_archived UUID;
  v_inactive UUID;
BEGIN
  SELECT id INTO v_inactive FROM public.candidate_statuses WHERE code = 'inactive';
  SELECT id INTO v_archived FROM public.candidate_statuses WHERE code = 'archived';

  IF v_inactive IS NULL THEN
    IF v_archived IS NOT NULL THEN
      -- Repurpose the dead 'archived' row → 'inactive' (keeps its id/FKs).
      UPDATE public.candidate_statuses
        SET code = 'inactive', name = 'Inactive'
        WHERE id = v_archived;
    ELSE
      INSERT INTO public.candidate_statuses (name, code, sort_order)
        VALUES ('Inactive', 'inactive', 2);
    END IF;
  ELSIF v_archived IS NOT NULL THEN
    -- Both exist (shouldn't normally): move any archived candidates to
    -- inactive, then drop the leftover archived row.
    UPDATE public.candidates SET general_status_id = v_inactive
      WHERE general_status_id = v_archived;
    DELETE FROM public.candidate_statuses WHERE id = v_archived;
  END IF;

  -- Normalize display order: Active → Inactive → Hired.
  UPDATE public.candidate_statuses SET sort_order = 1 WHERE code = 'active';
  UPDATE public.candidate_statuses SET sort_order = 2 WHERE code = 'inactive';
  UPDATE public.candidate_statuses SET sort_order = 3 WHERE code = 'hired';
END $$;
