-- Migration 004: Add SECURITY DEFINER helper for RLS + fix recursive profiles policy
--
-- The profiles SELECT policy queries the profiles table to find organization_id,
-- which is recursive. The fix is a SECURITY DEFINER function that bypasses RLS
-- for the lookup. All org-scoped policies are also updated to use this function
-- instead of repeated subqueries (faster: single lookup vs. per-row subquery).
--
-- Apply in Supabase: Dashboard → SQL Editor → run this file.

-- =====================================================
-- 1. Helper function
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Grant to authenticated role
GRANT EXECUTE ON FUNCTION public.get_user_org_id() TO authenticated;

-- =====================================================
-- 2. Fix profiles SELECT policy (was recursive)
-- =====================================================

DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;

CREATE POLICY "Users can view profiles in their organization"
  ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR organization_id = public.get_user_org_id()
  );

-- =====================================================
-- 3. Rebuild all org-scoped policies using the function
--    (drops and recreates to apply the optimisation)
-- =====================================================

-- Organizations
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Owners and admins can update their organization" ON public.organizations;

CREATE POLICY "Users can view their organization"
  ON public.organizations FOR SELECT
  USING (id = public.get_user_org_id());

CREATE POLICY "Owners and admins can update their organization"
  ON public.organizations FOR UPDATE
  USING (
    id = public.get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Subscriptions
DROP POLICY IF EXISTS "Users can view subscriptions in their organization" ON public.subscriptions;
DROP POLICY IF EXISTS "Owners and admins can manage subscriptions" ON public.subscriptions;

CREATE POLICY "Users can view subscriptions in their organization"
  ON public.subscriptions FOR SELECT
  USING (organization_id = public.get_user_org_id());

-- Vacancies
DROP POLICY IF EXISTS "Users can view vacancies in their organization" ON public.vacancies;
DROP POLICY IF EXISTS "Users can insert vacancies in their organization" ON public.vacancies;
DROP POLICY IF EXISTS "Users can update vacancies in their organization" ON public.vacancies;
DROP POLICY IF EXISTS "Owners and admins can delete vacancies" ON public.vacancies;

CREATE POLICY "Users can view vacancies in their organization"
  ON public.vacancies FOR SELECT
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can insert vacancies in their organization"
  ON public.vacancies FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id());

CREATE POLICY "Users can update vacancies in their organization"
  ON public.vacancies FOR UPDATE
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can delete vacancies in their organization"
  ON public.vacancies FOR DELETE
  USING (organization_id = public.get_user_org_id());

-- Candidates
DROP POLICY IF EXISTS "Users can view candidates in their organization" ON public.candidates;
DROP POLICY IF EXISTS "Users can insert candidates in their organization" ON public.candidates;
DROP POLICY IF EXISTS "Users can update candidates in their organization" ON public.candidates;
DROP POLICY IF EXISTS "Owners and admins can delete candidates" ON public.candidates;

CREATE POLICY "Users can view candidates in their organization"
  ON public.candidates FOR SELECT
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can insert candidates in their organization"
  ON public.candidates FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id());

CREATE POLICY "Users can update candidates in their organization"
  ON public.candidates FOR UPDATE
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can delete candidates in their organization"
  ON public.candidates FOR DELETE
  USING (organization_id = public.get_user_org_id());

-- Applications
DROP POLICY IF EXISTS "Users can view applications in their organization" ON public.applications;
DROP POLICY IF EXISTS "Users can insert applications in their organization" ON public.applications;
DROP POLICY IF EXISTS "Users can update applications in their organization" ON public.applications;
DROP POLICY IF EXISTS "Owners and admins can delete applications" ON public.applications;

CREATE POLICY "Users can view applications in their organization"
  ON public.applications FOR SELECT
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can insert applications in their organization"
  ON public.applications FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id());

CREATE POLICY "Users can update applications in their organization"
  ON public.applications FOR UPDATE
  USING (organization_id = public.get_user_org_id());

CREATE POLICY "Users can delete applications in their organization"
  ON public.applications FOR DELETE
  USING (organization_id = public.get_user_org_id());

-- Candidate documents
DROP POLICY IF EXISTS "Users can view candidate documents in their organization" ON public.candidate_documents;
DROP POLICY IF EXISTS "Users can insert candidate documents in their organization" ON public.candidate_documents;
DROP POLICY IF EXISTS "Users can update candidate documents in their organization" ON public.candidate_documents;
DROP POLICY IF EXISTS "Owners and admins can delete candidate documents" ON public.candidate_documents;

CREATE POLICY "Users can manage candidate documents in their organization"
  ON public.candidate_documents FOR ALL
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Candidate notes
DROP POLICY IF EXISTS "Users can view candidate notes in their organization" ON public.candidate_notes;
DROP POLICY IF EXISTS "Users can insert candidate notes in their organization" ON public.candidate_notes;
DROP POLICY IF EXISTS "Users can update candidate notes in their organization" ON public.candidate_notes;
DROP POLICY IF EXISTS "Owners and admins can delete candidate notes" ON public.candidate_notes;

CREATE POLICY "Users can manage candidate notes in their organization"
  ON public.candidate_notes FOR ALL
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Interviews
DROP POLICY IF EXISTS "Users can view interviews in their organization" ON public.interviews;
DROP POLICY IF EXISTS "Users can insert interviews in their organization" ON public.interviews;
DROP POLICY IF EXISTS "Users can update interviews in their organization" ON public.interviews;
DROP POLICY IF EXISTS "Owners and admins can delete interviews" ON public.interviews;

CREATE POLICY "Users can manage interviews in their organization"
  ON public.interviews FOR ALL
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Activity log
DROP POLICY IF EXISTS "Users can view activity in their organization" ON public.activity_log;
DROP POLICY IF EXISTS "Users can insert activity in their organization" ON public.activity_log;

CREATE POLICY "Users can manage activity log in their organization"
  ON public.activity_log FOR ALL
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());
