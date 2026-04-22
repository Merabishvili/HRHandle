-- HRHandle ATS Database Schema v2
-- PostgreSQL

-- Optional extension for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- 1. ORGANIZATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 2. PROFILES / USERS
-- Linked to Supabase auth.users
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'member')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 3. SUBSCRIPTIONS
-- Replaces simplified subscription fields in organizations
-- =====================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  plan_code TEXT NOT NULL CHECK (plan_code IN ('trial', 'professional')),
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'annual')),
  status TEXT NOT NULL CHECK (status IN ('trial', 'active', 'past_due', 'expired', 'canceled')),

  trial_start_at TIMESTAMPTZ,
  trial_end_at TIMESTAMPTZ,
  current_period_start_at TIMESTAMPTZ,
  current_period_end_at TIMESTAMPTZ,
  next_billing_at TIMESTAMPTZ,

  payment_method_linked BOOLEAN NOT NULL DEFAULT FALSE,
  payment_provider_customer_ref TEXT,
  payment_provider_subscription_ref TEXT,
  last_payment_status TEXT,

  vacancy_limit INTEGER NOT NULL DEFAULT 5,
  candidate_limit INTEGER NOT NULL DEFAULT 100,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional: one active/current subscription row per org in MVP
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_organization
  ON public.subscriptions (organization_id);

-- =====================================================
-- 4. SECTORS
-- Vacancy sectors like IT, Financial, Sales
-- =====================================================
CREATE TABLE IF NOT EXISTS public.sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed example values
INSERT INTO public.sectors (name, code, sort_order)
VALUES
  ('Financial', 'financial', 1),
  ('IT', 'it', 2),
  ('Sales', 'sales', 3),
  ('Marketing', 'marketing', 4),
  ('HR', 'hr', 5),
  ('Operations', 'operations', 6),
  ('Legal', 'legal', 7),
  ('Customer Support', 'customer_support', 8)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 5. VACANCY STATUSES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.vacancy_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO public.vacancy_statuses (name, code, sort_order)
VALUES
  ('Draft', 'draft', 1),
  ('Open', 'open', 2),
  ('On Hold', 'on_hold', 3),
  ('Closed', 'closed', 4),
  ('Archived', 'archived', 5)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 6. CANDIDATE GENERAL STATUSES
-- Profile-level, not application pipeline
-- =====================================================
CREATE TABLE IF NOT EXISTS public.candidate_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO public.candidate_statuses (name, code, sort_order)
VALUES
  ('New', 'new', 1),
  ('Active', 'active', 2),
  ('In Process', 'in_process', 3),
  ('Hired', 'hired', 4),
  ('Rejected', 'rejected', 5),
  ('Archived', 'archived', 6)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 7. APPLICATION STATUSES
-- Pipeline-level per candidate per vacancy
-- =====================================================
CREATE TABLE IF NOT EXISTS public.application_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO public.application_statuses (name, code, sort_order)
VALUES
  ('Applied', 'applied', 1),
  ('Screening', 'screening', 2),
  ('Interview', 'interview', 3),
  ('Offer', 'offer', 4),
  ('Hired', 'hired', 5),
  ('Rejected', 'rejected', 6),
  ('Withdrawn', 'withdrawn', 7)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 8. VACANCIES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.vacancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL,
  status_id UUID REFERENCES public.vacancy_statuses(id) ON DELETE SET NULL,

  department TEXT,
  location TEXT,
  employment_type TEXT CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'internship')),
  hiring_manager_name TEXT,
  salary_min NUMERIC(12,2),
  salary_max NUMERIC(12,2),
  salary_currency TEXT DEFAULT 'USD',
  openings_count INTEGER NOT NULL DEFAULT 1 CHECK (openings_count >= 1),

  start_date DATE NOT NULL,
  end_date DATE,
  description TEXT NOT NULL,
  requirements TEXT,

  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,

  CONSTRAINT chk_vacancy_dates CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT chk_salary_range CHECK (
    salary_min IS NULL OR salary_max IS NULL OR salary_max >= salary_min
  )
);

-- =====================================================
-- 9. CANDIDATES
-- General candidate profile only
-- No direct vacancy_id here
-- =====================================================
CREATE TABLE IF NOT EXISTS public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  age INTEGER CHECK (age IS NULL OR age >= 16),
  email TEXT,
  phone TEXT,

  current_company TEXT,
  current_position TEXT,
  years_of_experience NUMERIC(4,1) CHECK (years_of_experience IS NULL OR years_of_experience >= 0),

  linkedin_profile_url TEXT,
  source TEXT,
  general_status_id UUID REFERENCES public.candidate_statuses(id) ON DELETE SET NULL,

  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Optional uniqueness if you want to reduce duplicates by org+email
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_candidates_org_email
--   ON public.candidates (organization_id, email)
--   WHERE deleted_at IS NULL AND email IS NOT NULL;

-- =====================================================
-- 10. APPLICATIONS
-- CORE FIX: relation between candidate and vacancy
-- =====================================================
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  vacancy_id UUID NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
  status_id UUID REFERENCES public.application_statuses(id) ON DELETE SET NULL,

  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_status_changed_at TIMESTAMPTZ,
  notes TEXT,

  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_applications_candidate_vacancy_active
  ON public.applications (candidate_id, vacancy_id)
  WHERE deleted_at IS NULL;

-- =====================================================
-- 11. CANDIDATE DOCUMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.candidate_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,

  document_type TEXT NOT NULL CHECK (document_type IN ('cv', 'resume', 'cover_letter', 'other')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,

  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- =====================================================
-- 12. CANDIDATE NOTES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.candidate_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,

  note_text TEXT NOT NULL,

  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- =====================================================
-- 13. INTERVIEWS
-- Optional but useful
-- Now linked through candidate and vacancy
-- =====================================================
CREATE TABLE IF NOT EXISTS public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  vacancy_id UUID NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,

  interviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),

  type TEXT NOT NULL DEFAULT 'video' CHECK (type IN ('phone', 'video', 'onsite')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  feedback TEXT,
  rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 14. ACTIVITY LOG
-- =====================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  message TEXT,
  details JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 15. INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profiles_organization
  ON public.profiles (organization_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_organization
  ON public.subscriptions (organization_id);

CREATE INDEX IF NOT EXISTS idx_vacancies_organization
  ON public.vacancies (organization_id);

CREATE INDEX IF NOT EXISTS idx_vacancies_status
  ON public.vacancies (status_id);

CREATE INDEX IF NOT EXISTS idx_vacancies_sector
  ON public.vacancies (sector_id);

CREATE INDEX IF NOT EXISTS idx_candidates_organization
  ON public.candidates (organization_id);

CREATE INDEX IF NOT EXISTS idx_candidates_status
  ON public.candidates (general_status_id);

CREATE INDEX IF NOT EXISTS idx_candidates_name
  ON public.candidates (last_name, first_name);

CREATE INDEX IF NOT EXISTS idx_applications_organization
  ON public.applications (organization_id);

CREATE INDEX IF NOT EXISTS idx_applications_candidate
  ON public.applications (candidate_id);

CREATE INDEX IF NOT EXISTS idx_applications_vacancy
  ON public.applications (vacancy_id);

CREATE INDEX IF NOT EXISTS idx_applications_status
  ON public.applications (status_id);

CREATE INDEX IF NOT EXISTS idx_candidate_documents_candidate
  ON public.candidate_documents (candidate_id);

CREATE INDEX IF NOT EXISTS idx_candidate_notes_candidate
  ON public.candidate_notes (candidate_id);

CREATE INDEX IF NOT EXISTS idx_interviews_candidate
  ON public.interviews (candidate_id);

CREATE INDEX IF NOT EXISTS idx_interviews_vacancy
  ON public.interviews (vacancy_id);

CREATE INDEX IF NOT EXISTS idx_interviews_scheduled
  ON public.interviews (scheduled_at);

CREATE INDEX IF NOT EXISTS idx_activity_log_organization
  ON public.activity_log (organization_id);

CREATE INDEX IF NOT EXISTS idx_activity_log_created
  ON public.activity_log (created_at DESC);

-- =====================================================
-- 16. ENABLE RLS
-- =====================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacancy_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 17. RLS POLICIES
-- =====================================================

-- Organizations
CREATE POLICY "Users can view their organization"
  ON public.organizations
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can update their organization"
  ON public.organizations
  FOR UPDATE
  USING (
    id IN (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Profiles
CREATE POLICY "Users can view profiles in their organization"
  ON public.profiles
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
    OR id = auth.uid()
  );

CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid());

-- Subscriptions
CREATE POLICY "Users can view subscriptions in their organization"
  ON public.subscriptions
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can manage subscriptions"
  ON public.subscriptions
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Dictionary tables (read for authenticated users)
CREATE POLICY "Authenticated users can view sectors"
  ON public.sectors
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view vacancy statuses"
  ON public.vacancy_statuses
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view candidate statuses"
  ON public.candidate_statuses
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view application statuses"
  ON public.application_statuses
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Vacancies
CREATE POLICY "Users can view vacancies in their organization"
  ON public.vacancies
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert vacancies in their organization"
  ON public.vacancies
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update vacancies in their organization"
  ON public.vacancies
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can delete vacancies"
  ON public.vacancies
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Candidates
CREATE POLICY "Users can view candidates in their organization"
  ON public.candidates
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert candidates in their organization"
  ON public.candidates
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update candidates in their organization"
  ON public.candidates
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can delete candidates"
  ON public.candidates
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Applications
CREATE POLICY "Users can view applications in their organization"
  ON public.applications
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert applications in their organization"
  ON public.applications
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update applications in their organization"
  ON public.applications
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can delete applications"
  ON public.applications
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Candidate documents
CREATE POLICY "Users can view candidate documents in their organization"
  ON public.candidate_documents
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert candidate documents in their organization"
  ON public.candidate_documents
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update candidate documents in their organization"
  ON public.candidate_documents
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can delete candidate documents"
  ON public.candidate_documents
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Candidate notes
CREATE POLICY "Users can view candidate notes in their organization"
  ON public.candidate_notes
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert candidate notes in their organization"
  ON public.candidate_notes
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update candidate notes in their organization"
  ON public.candidate_notes
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can delete candidate notes"
  ON public.candidate_notes
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Interviews
CREATE POLICY "Users can view interviews in their organization"
  ON public.interviews
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert interviews in their organization"
  ON public.interviews
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update interviews in their organization"
  ON public.interviews
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can delete interviews"
  ON public.interviews
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Activity log
CREATE POLICY "Users can view activity in their organization"
  ON public.activity_log
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert activity in their organization"
  ON public.activity_log
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );