-- =====================================================================
-- A-3 Merge candidates — soft-merge with audit + 30-day reversibility
-- =====================================================================
--
-- Adds:
--   1. candidates.merged_into_id / merged_at — soft-merge markers so old
--      IDs redirect to the surviving record. Loser's deleted_at is set
--      the same moment, so list queries filtering on deleted_at IS NULL
--      already hide the merged row.
--   2. candidate_merges — append-only audit. Captures the loser's
--      pre-merge state as JSONB so a future split-back (A-3b) can
--      restore the row verbatim. UNIQUE(loser_id) means a candidate
--      can only be merged once.
--   3. merge_candidates() — SECURITY INVOKER function that performs the
--      whole merge in a single transaction so a mid-write failure
--      rolls back atomically. Caller passes (winner_id, loser_id,
--      field_choices) — field_choices is a JSONB object of column
--      overrides applied to the winner.
--
-- Same-org enforcement: SELECT goes through RLS on candidates so a user
-- who can't see a candidate physically can't pass it in either. The
-- function double-checks org parity for defence in depth.
--
-- Same-vacancy application collision: when the loser has an application
-- on a vacancy that the winner also has an application on, the loser's
-- duplicate is soft-deleted with a marker note. The winner's stays.

BEGIN;

-- 1. Soft-merge markers on candidates
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS merged_into_id UUID
    REFERENCES public.candidates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at      TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_candidates_merged_into
  ON public.candidates (merged_into_id)
  WHERE merged_into_id IS NOT NULL;

-- 2. Audit table
CREATE TABLE IF NOT EXISTS public.candidate_merges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  winner_id       UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  loser_id        UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  merged_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  merged_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  loser_snapshot  JSONB NOT NULL,
  field_choices   JSONB NOT NULL DEFAULT '{}'::jsonb,
  reverted_at     TIMESTAMPTZ,
  reverted_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (loser_id)
);

ALTER TABLE public.candidate_merges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can view candidate_merges" ON public.candidate_merges;
CREATE POLICY "org members can view candidate_merges"
  ON public.candidate_merges FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "org members can insert candidate_merges" ON public.candidate_merges;
CREATE POLICY "org members can insert candidate_merges"
  ON public.candidate_merges FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "org members can update candidate_merges" ON public.candidate_merges;
CREATE POLICY "org members can update candidate_merges"
  ON public.candidate_merges FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

-- 3. The merge function — single transaction, all-or-nothing
CREATE OR REPLACE FUNCTION public.merge_candidates(
  p_winner_id     UUID,
  p_loser_id      UUID,
  p_field_choices JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_winner_org    UUID;
  v_loser_org     UUID;
  v_loser_snap    JSONB;
  v_loser_name    TEXT;
  v_user_id       UUID := auth.uid();
BEGIN
  IF p_winner_id IS NULL OR p_loser_id IS NULL THEN
    RAISE EXCEPTION 'winner_id and loser_id are required';
  END IF;
  IF p_winner_id = p_loser_id THEN
    RAISE EXCEPTION 'cannot merge a candidate with itself';
  END IF;

  -- Both must exist and be in the user's org (RLS enforces visibility)
  SELECT organization_id INTO v_winner_org FROM public.candidates WHERE id = p_winner_id AND deleted_at IS NULL;
  SELECT organization_id INTO v_loser_org  FROM public.candidates WHERE id = p_loser_id  AND deleted_at IS NULL;

  IF v_winner_org IS NULL THEN
    RAISE EXCEPTION 'winner candidate not found or already deleted';
  END IF;
  IF v_loser_org IS NULL THEN
    RAISE EXCEPTION 'loser candidate not found or already deleted';
  END IF;
  IF v_winner_org <> v_loser_org THEN
    RAISE EXCEPTION 'cross-org merge is not allowed';
  END IF;

  -- Snapshot the loser so split-back can restore it
  SELECT to_jsonb(c.*) INTO v_loser_snap FROM public.candidates c WHERE id = p_loser_id;
  v_loser_name := COALESCE(v_loser_snap->>'first_name', '') || ' ' || COALESCE(v_loser_snap->>'last_name', '');

  -- Apply chosen field overrides to the winner. JSONB key absent → keep
  -- winner's current value; key present (even '') → overwrite.
  UPDATE public.candidates SET
    first_name           = CASE WHEN p_field_choices ? 'first_name'           THEN p_field_choices->>'first_name'           ELSE first_name END,
    last_name            = CASE WHEN p_field_choices ? 'last_name'            THEN p_field_choices->>'last_name'            ELSE last_name END,
    email                = CASE WHEN p_field_choices ? 'email'                THEN NULLIF(p_field_choices->>'email', '')    ELSE email END,
    phone                = CASE WHEN p_field_choices ? 'phone'                THEN NULLIF(p_field_choices->>'phone', '')    ELSE phone END,
    current_company      = CASE WHEN p_field_choices ? 'current_company'      THEN NULLIF(p_field_choices->>'current_company', '')      ELSE current_company END,
    current_position     = CASE WHEN p_field_choices ? 'current_position'     THEN NULLIF(p_field_choices->>'current_position', '')     ELSE current_position END,
    linkedin_profile_url = CASE WHEN p_field_choices ? 'linkedin_profile_url' THEN NULLIF(p_field_choices->>'linkedin_profile_url', '') ELSE linkedin_profile_url END,
    source               = CASE WHEN p_field_choices ? 'source'               THEN NULLIF(p_field_choices->>'source', '')               ELSE source END,
    location             = CASE WHEN p_field_choices ? 'location'             THEN NULLIF(p_field_choices->>'location', '')             ELSE location END,
    updated_at           = NOW()
  WHERE id = p_winner_id;

  -- Re-point children. Same-vacancy applications: archive the loser's
  -- duplicate before the bulk re-point so the live one stays on the
  -- winner.
  UPDATE public.applications
     SET deleted_at = NOW(), updated_at = NOW()
   WHERE candidate_id = p_loser_id
     AND deleted_at IS NULL
     AND vacancy_id IN (
       SELECT vacancy_id FROM public.applications
        WHERE candidate_id = p_winner_id AND deleted_at IS NULL
     );

  UPDATE public.applications              SET candidate_id = p_winner_id WHERE candidate_id = p_loser_id;
  UPDATE public.candidate_documents       SET candidate_id = p_winner_id WHERE candidate_id = p_loser_id;
  UPDATE public.candidate_notes           SET candidate_id = p_winner_id WHERE candidate_id = p_loser_id;
  UPDATE public.candidate_experience      SET candidate_id = p_winner_id WHERE candidate_id = p_loser_id;
  UPDATE public.candidate_education       SET candidate_id = p_winner_id WHERE candidate_id = p_loser_id;
  UPDATE public.candidate_evaluations     SET candidate_id = p_winner_id WHERE candidate_id = p_loser_id;
  UPDATE public.candidate_evaluation_answers SET candidate_id = p_winner_id WHERE candidate_id = p_loser_id;
  UPDATE public.interviews                SET candidate_id = p_winner_id WHERE candidate_id = p_loser_id;

  -- custom_field_values has UNIQUE(field_id, entity_id). Resolve
  -- collisions by keeping the winner's row and discarding the loser's,
  -- then re-point the rest.
  DELETE FROM public.custom_field_values
   WHERE entity_id = p_loser_id
     AND field_id IN (
       SELECT field_id FROM public.custom_field_values WHERE entity_id = p_winner_id
     );
  UPDATE public.custom_field_values
     SET entity_id = p_winner_id, updated_at = NOW()
   WHERE entity_id = p_loser_id;

  -- Polymorphic activity_log
  UPDATE public.activity_log
     SET entity_id = p_winner_id
   WHERE entity_type = 'candidate' AND entity_id = p_loser_id;

  -- Soft-delete the loser with merge markers
  UPDATE public.candidates SET
    deleted_at      = NOW(),
    merged_into_id  = p_winner_id,
    merged_at       = NOW(),
    updated_at      = NOW()
  WHERE id = p_loser_id;

  -- Audit
  INSERT INTO public.candidate_merges (
    organization_id, winner_id, loser_id, merged_by, loser_snapshot, field_choices
  ) VALUES (
    v_winner_org, p_winner_id, p_loser_id, v_user_id, v_loser_snap, p_field_choices
  );

  -- Surface in the winner's activity feed
  INSERT INTO public.activity_log (
    organization_id, user_id, entity_type, entity_id, action, message, details
  ) VALUES (
    v_winner_org,
    v_user_id,
    'candidate',
    p_winner_id,
    'candidate_merged',
    'Merged with ' || TRIM(v_loser_name),
    jsonb_build_object('loser_id', p_loser_id, 'field_choices', p_field_choices)
  );

  RETURN p_winner_id;
END;
$$;

-- Granted to authenticated users so server actions invoked via the
-- supabase-js client (which runs as the signed-in user) can call it.
GRANT EXECUTE ON FUNCTION public.merge_candidates(UUID, UUID, JSONB) TO authenticated;

COMMIT;
