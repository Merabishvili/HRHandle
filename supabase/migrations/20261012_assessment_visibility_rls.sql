-- Assessment visibility, enforced by the database (2026-10-12)
--
-- The app shows a colleague's submitted assessment only once you've submitted
-- your own for that application — owners and admins see every one — but the
-- tables let any org member read and change every assessment and its answers
-- straight through the API. From now on the database enforces it:
--
--   candidate_evaluations
--     read   your own cards (draft or submitted); every card if you're an
--            owner/admin; a colleague's SUBMITTED card once you've submitted
--            your own card for the same application
--     write  your own cards; owners/admins any card in the organization
--   candidate_evaluation_answers
--     read and write follow the assessment they belong to
--
-- merge_candidates() runs as the caller, so it now moves assessments through a
-- definer helper (a member merging two candidates has to move colleagues'
-- cards they can't see). The app reads the pipeline "Fit" average and the
-- "N teammates have submitted" count with the service role (numbers only), so
-- deploy the code before applying this — before that, members would see the
-- Fit average of their own assessments only.
--
-- Apply in Supabase: Dashboard → SQL Editor → run this file on BOTH the
-- staging (quotchdymcnjlnwtjmgu) and production (fnpyfwhvgzoxgyjafbsg)
-- projects. Safe to re-run.

BEGIN;

-- 1. Checks used by the policies. SECURITY DEFINER, so looking at the
--    caller's own cards doesn't re-enter these policies (no recursion).
CREATE OR REPLACE FUNCTION public.auth_is_org_admin(p_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND organization_id = p_org AND role IN ('owner', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_evaluation(
  p_org uuid,
  p_application uuid,
  p_reviewer uuid,
  p_submitted boolean
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.organization_id = p_org
      AND (
        p_reviewer = me.id
        OR me.role IN ('owner', 'admin')
        OR (
          p_submitted
          AND EXISTS (
            SELECT 1 FROM public.candidate_evaluations mine
            WHERE mine.application_id = p_application
              AND mine.reviewer_id = me.id
              AND mine.submitted
          )
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION public.auth_is_org_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_evaluation(uuid, uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_evaluation(uuid, uuid, uuid, boolean) TO authenticated;

-- 2. Replace every policy on the two tables. They're looked up rather than
--    dropped by name: the live databases carry policies that aren't in the
--    repo, and one leftover permissive policy would keep everything readable.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('candidate_evaluations', 'candidate_evaluation_answers')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

ALTER TABLE public.candidate_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_evaluation_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evaluations_select_visible" ON public.candidate_evaluations
  FOR SELECT TO authenticated
  USING (public.can_view_evaluation(organization_id, application_id, reviewer_id, submitted));

CREATE POLICY "evaluations_insert_own_or_admin" ON public.candidate_evaluations
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_org_id()
    AND (reviewer_id = auth.uid() OR public.auth_is_org_admin(organization_id))
  );

CREATE POLICY "evaluations_update_own_or_admin" ON public.candidate_evaluations
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_org_id()
    AND (reviewer_id = auth.uid() OR public.auth_is_org_admin(organization_id))
  )
  WITH CHECK (
    organization_id = public.get_user_org_id()
    AND (reviewer_id = auth.uid() OR public.auth_is_org_admin(organization_id))
  );

CREATE POLICY "evaluations_delete_own_or_admin" ON public.candidate_evaluations
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_user_org_id()
    AND (reviewer_id = auth.uid() OR public.auth_is_org_admin(organization_id))
  );

-- Answers follow their assessment. The sub-select runs under the policies
-- above, so it only finds assessments the caller may see.
CREATE POLICY "evaluation_answers_select_visible" ON public.candidate_evaluation_answers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.candidate_evaluations ce WHERE ce.id = evaluation_id));

CREATE POLICY "evaluation_answers_insert_own_or_admin" ON public.candidate_evaluation_answers
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.candidate_evaluations ce
      WHERE ce.id = evaluation_id
        AND (ce.reviewer_id = auth.uid() OR public.auth_is_org_admin(ce.organization_id))
    )
  );

CREATE POLICY "evaluation_answers_update_own_or_admin" ON public.candidate_evaluation_answers
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.candidate_evaluations ce
      WHERE ce.id = evaluation_id
        AND (ce.reviewer_id = auth.uid() OR public.auth_is_org_admin(ce.organization_id))
    )
  )
  WITH CHECK (
    organization_id = public.get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.candidate_evaluations ce
      WHERE ce.id = evaluation_id
        AND (ce.reviewer_id = auth.uid() OR public.auth_is_org_admin(ce.organization_id))
    )
  );

CREATE POLICY "evaluation_answers_delete_own_or_admin" ON public.candidate_evaluation_answers
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.candidate_evaluations ce
      WHERE ce.id = evaluation_id
        AND (ce.reviewer_id = auth.uid() OR public.auth_is_org_admin(ce.organization_id))
    )
  );

-- 3. Merging candidates moves every assessment, including ones the caller
--    can't see. Only candidates in the caller's own organization.
CREATE OR REPLACE FUNCTION public.repoint_candidate_evaluations(p_loser_id uuid, p_winner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := public.get_user_org_id();
BEGIN
  IF v_org IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.candidates WHERE id = p_winner_id AND organization_id = v_org)
     OR NOT EXISTS (SELECT 1 FROM public.candidates WHERE id = p_loser_id AND organization_id = v_org)
  THEN
    RAISE EXCEPTION 'candidates not found in your organization';
  END IF;

  UPDATE public.candidate_evaluations
     SET candidate_id = p_winner_id
   WHERE candidate_id = p_loser_id AND organization_id = v_org;
  UPDATE public.candidate_evaluation_answers
     SET candidate_id = p_winner_id
   WHERE candidate_id = p_loser_id AND organization_id = v_org;
END;
$$;

REVOKE ALL ON FUNCTION public.repoint_candidate_evaluations(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repoint_candidate_evaluations(uuid, uuid) TO authenticated;

-- merge_candidates() exactly as in scripts/053_candidate_merges.sql, except the
-- two assessment UPDATEs now go through the helper above.
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
  -- Assessments: moved by a definer helper, because the caller may not be
  -- allowed to see colleagues' cards (20261012_assessment_visibility_rls.sql).
  PERFORM public.repoint_candidate_evaluations(p_loser_id, p_winner_id);
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

GRANT EXECUTE ON FUNCTION public.merge_candidates(UUID, UUID, JSONB) TO authenticated;

COMMIT;

-- Check afterwards — 4 policies on each table, all named *_visible / *_own_or_admin:
--   select tablename, policyname, cmd from pg_policies
--   where tablename in ('candidate_evaluations', 'candidate_evaluation_answers')
--   order by 1, 2;
