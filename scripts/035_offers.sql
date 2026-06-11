-- Migration 035: Offers (G-018) — phase 2 of the candidate-facing experience
--
-- Adds an `offers` table that captures a per-application offer that a
-- recruiter sends to a candidate. Schema is deliberately minimal — three
-- required columns (organization, application, role title, body) and
-- everything else (compensation, dates, recruiter message) is optional. The
-- design philosophy is "very general, easy to use": industry-specific quirks
-- (equity, commission, shift schedules, etc.) live in the markdown `body`
-- field rather than the schema.
--
-- Flow: draft → sent → (accepted | declined | expired | withdrawn). One
-- non-terminal offer per application (enforced by the partial unique index
-- below). Multiple terminal offers per application are allowed — they form
-- a small revision history.
--
-- Apply in Supabase: Dashboard → SQL Editor → run this file on BOTH the
-- staging (quotchdymcnjlnwtjmgu) and production (fnpyfwhvgzoxgyjafbsg)
-- projects. Safe to re-run (every statement is idempotent).

CREATE TABLE IF NOT EXISTS public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,

  -- Structured fields. Only role_title + body are required.
  role_title TEXT NOT NULL,
  compensation_amount NUMERIC(12, 2),
  compensation_currency TEXT,
  compensation_period TEXT,
  start_date DATE,
  expiry_date DATE,
  body TEXT NOT NULL,
  recruiter_message TEXT,

  -- State machine.
  status TEXT NOT NULL DEFAULT 'draft',
  public_token TEXT UNIQUE,

  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  decline_reason TEXT,

  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT offers_status_check CHECK (
    status IN ('draft', 'sent', 'accepted', 'declined', 'expired', 'withdrawn')
  ),
  CONSTRAINT offers_period_check CHECK (
    compensation_period IS NULL OR
    compensation_period IN ('annual', 'monthly', 'hourly', 'project', 'other')
  )
);

-- One non-terminal offer per application. Recruiter who wants to revise a
-- sent offer must `withdraw` the live one first; the partial index then
-- allows a fresh draft + send.
CREATE UNIQUE INDEX IF NOT EXISTS uq_offers_one_active_per_app
  ON public.offers (application_id)
  WHERE deleted_at IS NULL AND status IN ('draft', 'sent');

CREATE INDEX IF NOT EXISTS idx_offers_application ON public.offers (application_id);
CREATE INDEX IF NOT EXISTS idx_offers_organization ON public.offers (organization_id);
CREATE INDEX IF NOT EXISTS idx_offers_public_token
  ON public.offers (public_token)
  WHERE public_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offers_status ON public.offers (status);
-- Cron uses this to find sent offers past their expiry.
CREATE INDEX IF NOT EXISTS idx_offers_sent_expiry
  ON public.offers (expiry_date)
  WHERE status = 'sent' AND expiry_date IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view offers in their organization" ON public.offers;
DROP POLICY IF EXISTS "Users can insert offers in their organization" ON public.offers;
DROP POLICY IF EXISTS "Users can update offers in their organization" ON public.offers;
DROP POLICY IF EXISTS "Owners and admins can delete offers" ON public.offers;

-- Same shape as applications: any active member of the org can read/insert/
-- update; only owner/admin can delete. The candidate-facing read path
-- (/offer/<token>) bypasses RLS via the admin client — same risk model as
-- the G-016 status page.
CREATE POLICY "Users can view offers in their organization"
  ON public.offers
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert offers in their organization"
  ON public.offers
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update offers in their organization"
  ON public.offers
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can delete offers"
  ON public.offers
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );
