-- =====================================================================
-- A-3b — Split-back a candidate merge within 30 days
-- =====================================================================
--
-- Migration 053 captured each merge in `candidate_merges` with a JSONB
-- snapshot of the loser's pre-merge state. This migration adds the
-- `split_merge()` function the Settings UI calls when a recruiter
-- realises the merge was a mistake.
--
-- WHAT SPLIT-BACK DOES:
--   - Restores the loser row (clears deleted_at, merged_into_id,
--     merged_at) so the old ID stops redirecting and the row is
--     visible again.
--   - Marks the audit row as reverted (`reverted_at` + `reverted_by`)
--     so split-back can only happen once.
--   - Writes an activity log entry on the winner.
--
-- WHAT SPLIT-BACK DOES NOT DO (documented limitation):
--   - Does not un-fold child rows. Applications, notes, documents,
--     interviews, evaluations, custom_field_values etc. that were
--     re-pointed onto the winner during the merge STAY on the winner.
--     The restored loser comes back empty; the recruiter must
--     manually re-attach work if needed.
--   - Does not revert the field overrides applied to the winner
--     during merge — the winner keeps the values chosen at the time.
--
-- This trade-off keeps the implementation simple (no per-child-row
-- origin tracking) and is acceptable for the "undo a mistake within
-- 30 days" affordance the design calls for. Full bidirectional split
-- would require a much bigger schema change tracked separately.
--
-- 30-day window: enforced by the function so a stale merge can't be
-- reversed even if the audit row remains (no cleanup job needed —
-- the rows stay around for forensics).
--
-- Idempotent; re-running this is a no-op.

BEGIN;

CREATE OR REPLACE FUNCTION public.split_merge(p_merge_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_org_id    UUID;
  v_winner_id UUID;
  v_loser_id  UUID;
  v_merged_at TIMESTAMPTZ;
  v_reverted  TIMESTAMPTZ;
  v_loser_name TEXT;
  v_user_id   UUID := auth.uid();
BEGIN
  IF p_merge_id IS NULL THEN
    RAISE EXCEPTION 'merge_id is required';
  END IF;

  SELECT organization_id, winner_id, loser_id, merged_at, reverted_at
    INTO v_org_id, v_winner_id, v_loser_id, v_merged_at, v_reverted
    FROM public.candidate_merges
   WHERE id = p_merge_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'merge not found';
  END IF;
  IF v_reverted IS NOT NULL THEN
    RAISE EXCEPTION 'merge has already been split back';
  END IF;
  IF v_merged_at < NOW() - INTERVAL '30 days' THEN
    RAISE EXCEPTION 'split window has expired (30 day limit)';
  END IF;

  -- Restore the loser row in place. We don't touch the winner.
  UPDATE public.candidates SET
    deleted_at      = NULL,
    merged_into_id  = NULL,
    merged_at       = NULL,
    updated_at      = NOW()
  WHERE id = v_loser_id;

  -- Pull the loser's first + last name from the snapshot for the
  -- activity log entry on the winner.
  SELECT TRIM(COALESCE(loser_snapshot->>'first_name', '') || ' ' || COALESCE(loser_snapshot->>'last_name', ''))
    INTO v_loser_name
    FROM public.candidate_merges
   WHERE id = p_merge_id;

  UPDATE public.candidate_merges SET
    reverted_at = NOW(),
    reverted_by = v_user_id
  WHERE id = p_merge_id;

  INSERT INTO public.activity_log (
    organization_id, user_id, entity_type, entity_id, action, message, details
  ) VALUES (
    v_org_id,
    v_user_id,
    'candidate',
    v_winner_id,
    'candidate_merge_split',
    'Split back from ' || COALESCE(NULLIF(v_loser_name, ''), 'a candidate'),
    jsonb_build_object('merge_id', p_merge_id, 'loser_id', v_loser_id)
  );

  RETURN v_loser_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.split_merge(UUID) TO authenticated;

COMMIT;
