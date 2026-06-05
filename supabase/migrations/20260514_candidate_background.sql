-- Migration: candidate_experience and candidate_education tables
-- Run this in the Supabase SQL editor on BOTH staging and production projects.

-- ── candidate_experience ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidate_experience (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  company         TEXT NOT NULL,
  title           TEXT NOT NULL,
  start_date      DATE,
  end_date        DATE,
  is_current      BOOLEAN NOT NULL DEFAULT false,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS candidate_experience_candidate_id_idx
  ON candidate_experience (candidate_id);

CREATE INDEX IF NOT EXISTS candidate_experience_org_id_idx
  ON candidate_experience (organization_id);

ALTER TABLE candidate_experience ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage candidate_experience"
  ON candidate_experience
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ── candidate_education ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidate_education (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  institution     TEXT NOT NULL,
  degree          TEXT,
  field_of_study  TEXT,
  start_year      SMALLINT,
  end_year        SMALLINT,
  is_ongoing      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS candidate_education_candidate_id_idx
  ON candidate_education (candidate_id);

CREATE INDEX IF NOT EXISTS candidate_education_org_id_idx
  ON candidate_education (organization_id);

ALTER TABLE candidate_education ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage candidate_education"
  ON candidate_education
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
