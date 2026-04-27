-- =====================================================
-- 015: Email Templates + Rejection Reasons
-- =====================================================

-- 1. EMAIL TEMPLATES
-- Stores per-org overrides for the 3 transactional email types.
-- If no row exists for an org+type, the default template is used.
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_templates (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_type     TEXT        NOT NULL CHECK (template_type IN ('application_received', 'interview_invitation', 'rejection')),
  subject           TEXT        NOT NULL,
  body              TEXT        NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, template_type)
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can view email_templates"  ON public.email_templates;
DROP POLICY IF EXISTS "org admins can manage email_templates" ON public.email_templates;

CREATE POLICY "org members can view email_templates"
  ON public.email_templates FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "org admins can manage email_templates"
  ON public.email_templates FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin') AND is_active = TRUE
    )
  );

-- =====================================================
-- 2. REJECTION REASONS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.rejection_reasons (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  send_email        BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rejection_reasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can view rejection_reasons"  ON public.rejection_reasons;
DROP POLICY IF EXISTS "org admins can manage rejection_reasons" ON public.rejection_reasons;

CREATE POLICY "org members can view rejection_reasons"
  ON public.rejection_reasons FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "org admins can manage rejection_reasons"
  ON public.rejection_reasons FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin') AND is_active = TRUE
    )
  );
