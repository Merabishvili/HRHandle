-- AI Fit Analysis (Wave 3.1 / Phase 8) — EU-AI-Act-compliant scaffolding.
-- Advisory-only, evidence-based, NO overall numeric score (spec Guardrail 1).
-- Ships behind an org opt-in (default OFF) + EU acknowledgement gate.
--
-- Idempotent (IF NOT EXISTS + DROP POLICY IF EXISTS) so it is safe to re-run.
-- Apply on BOTH staging and production Supabase projects.

BEGIN;

-- ── 1. Per-analysis records ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_fit_analyses (
  id                         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id            UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  application_id             UUID        NOT NULL REFERENCES public.applications(id)  ON DELETE CASCADE,

  -- Input snapshots (provenance / reproducibility)
  criteria_snapshot          JSONB       NOT NULL,           -- vacancy_questions at analysis time
  cv_snapshot_hash           TEXT        NOT NULL,           -- sha256 of the sanitized model input
  redacted_categories        TEXT[]      NOT NULL DEFAULT '{}', -- what the sanitizer stripped
  screening_answers_snapshot JSONB,

  -- Output — NO overall score. "Meets N of M must-haves" + per-criterion detail.
  meets_count                INTEGER     NOT NULL,
  must_have_total            INTEGER     NOT NULL,
  confidence                 TEXT        CHECK (confidence IN ('low','medium','high')),
  rendered_analysis          JSONB       NOT NULL,           -- {criteria[], strengths[], to_verify[], suggested_questions[]}

  -- Provenance
  model_name                 TEXT        NOT NULL,
  model_version              TEXT,
  prompt_version             TEXT        NOT NULL,
  raw_response               TEXT,

  -- Human oversight (mandatory Agree/Override — EU AI Act Art. 14)
  assessment                 TEXT        CHECK (assessment IN ('agree','override')),
  assessment_reason          TEXT,       -- required when assessment = 'override'
  assessed_by                UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  assessed_at                TIMESTAMPTZ,

  -- Audit
  created_by                 UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_fit_analyses_app ON public.ai_fit_analyses (application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_fit_analyses_org ON public.ai_fit_analyses (organization_id);

ALTER TABLE public.ai_fit_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_read_ai_fit" ON public.ai_fit_analyses;
CREATE POLICY "org_members_read_ai_fit"
  ON public.ai_fit_analyses FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "org_members_manage_ai_fit" ON public.ai_fit_analyses;
CREATE POLICY "org_members_manage_ai_fit"
  ON public.ai_fit_analyses FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- ── 2. Org opt-in + geofencing (Guardrails 2 & 6) ────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS ai_fit_enabled          BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_fit_enabled_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_fit_enabled_by       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_fit_eu_acknowledged  BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS billing_country         TEXT;

-- ── 3. Bias review log (Settings → Data) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_fit_bias_reviews (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reviewed_on     DATE        NOT NULL,
  reviewer        TEXT        NOT NULL,       -- who ran the bias/adverse-impact test
  summary         TEXT        NOT NULL,       -- findings
  action_taken    TEXT,                       -- what was done about it
  created_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_fit_bias_reviews_org ON public.ai_fit_bias_reviews (organization_id, reviewed_on DESC);

ALTER TABLE public.ai_fit_bias_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_read_bias_reviews" ON public.ai_fit_bias_reviews;
CREATE POLICY "org_members_read_bias_reviews"
  ON public.ai_fit_bias_reviews FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "org_members_manage_bias_reviews" ON public.ai_fit_bias_reviews;
CREATE POLICY "org_members_manage_bias_reviews"
  ON public.ai_fit_bias_reviews FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

COMMIT;
