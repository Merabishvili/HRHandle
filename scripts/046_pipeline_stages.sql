-- Migration 046: per-vacancy pipeline_stages table (Wave 2.6 foundation)
--
-- Adds the core schema for custom-per-vacancy pipeline stages, locked by
-- the redesign audit Q3 with these constraints:
--   - Per-vacancy (each vacancy owns its own ordered list of stages)
--   - Cap at 10 stages per vacancy (enforced by trigger)
--   - Stage type is enum-restricted to standard / interview / offer / review;
--     behavior keys off type, never off the (free-text) name
--   - Greenfield: no migration of existing applications.status_id rows.
--     Per the locked Q14, the user is cleaning customer data before
--     launch — there is no in-flight state to remap.
--
-- IMPORTANT: this migration only adds the new table + helpers. The
-- coordinated swap on `applications` (drop status_id → add
-- pipeline_stage_id) is intentionally deferred to a follow-up migration
-- so the ~20 file callsites that read `applications.status_id` today
-- continue to work. Until that follow-up lands, `pipeline_stages` is
-- forward-compat scaffolding with no live readers — safe to apply.
--
-- Apply in Supabase: Dashboard → SQL Editor → run this file on BOTH
-- staging (quotchdymcnjlnwtjmgu) and production (fnpyfwhvgzoxgyjafbsg)
-- projects. Idempotent (CREATE TABLE IF NOT EXISTS, etc).

-- ─────────────────────────────────────────────────────────────────────
-- 1. pipeline_stages table
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID         NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vacancy_id      UUID         NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
  name            TEXT         NOT NULL,
  type            TEXT         NOT NULL CHECK (type IN ('standard', 'interview', 'offer', 'review')),
  sort_order      INTEGER      NOT NULL,
  is_terminal     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_by      UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Two stages on the same vacancy can't share a sort_order — keeps
-- ordering atomic during drag-reorders.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pipeline_stages_vacancy_sort
  ON public.pipeline_stages (vacancy_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_vacancy
  ON public.pipeline_stages (vacancy_id);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_org
  ON public.pipeline_stages (organization_id);

-- ─────────────────────────────────────────────────────────────────────
-- 2. Cap-10 enforcement (Q3 lock)
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_pipeline_stages_cap()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.pipeline_stages WHERE vacancy_id = NEW.vacancy_id) >= 10 THEN
    RAISE EXCEPTION 'Pipeline stages capped at 10 per vacancy';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pipeline_stages_cap_trigger ON public.pipeline_stages;
CREATE TRIGGER pipeline_stages_cap_trigger
  BEFORE INSERT ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pipeline_stages_cap();

-- ─────────────────────────────────────────────────────────────────────
-- 3. RLS — view in own org, admins+owners can manage
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view pipeline_stages in their org" ON public.pipeline_stages;
CREATE POLICY "Users can view pipeline_stages in their org"
  ON public.pipeline_stages FOR SELECT
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can insert pipeline_stages" ON public.pipeline_stages;
CREATE POLICY "Admins can insert pipeline_stages"
  ON public.pipeline_stages FOR INSERT
  WITH CHECK (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "Admins can update pipeline_stages" ON public.pipeline_stages;
CREATE POLICY "Admins can update pipeline_stages"
  ON public.pipeline_stages FOR UPDATE
  USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "Admins can delete pipeline_stages" ON public.pipeline_stages;
CREATE POLICY "Admins can delete pipeline_stages"
  ON public.pipeline_stages FOR DELETE
  USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('owner', 'admin')
  );

-- ─────────────────────────────────────────────────────────────────────
-- 4. Default-template seeder
--
-- Called from createVacancy() in the follow-up migration that swaps
-- applications.status_id → pipeline_stage_id. Mirrors the legacy global
-- 7-stage seed so a brand-new vacancy has the same default UX as today,
-- and the recruiter can edit / add / remove from there (up to the cap).
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.seed_default_pipeline_stages(
  p_vacancy_id UUID,
  p_org_id     UUID,
  p_created_by UUID DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
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
END $$;
