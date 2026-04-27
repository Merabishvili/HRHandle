-- =====================================================
-- 016: Rejection Templates + cleanup
-- =====================================================

-- 1. Drop send_email from rejection_reasons
--    (send/no-send is now decided at rejection time, not configuration time)
ALTER TABLE public.rejection_reasons DROP COLUMN IF EXISTS send_email;

-- 2. Rejection email templates (multiple per org, each named)
CREATE TABLE IF NOT EXISTS public.rejection_templates (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID      NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  subject       TEXT        NOT NULL,
  body          TEXT        NOT NULL,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rejection_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can view rejection_templates"  ON public.rejection_templates;
DROP POLICY IF EXISTS "org admins can manage rejection_templates" ON public.rejection_templates;

CREATE POLICY "org members can view rejection_templates"
  ON public.rejection_templates FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "org admins can manage rejection_templates"
  ON public.rejection_templates FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin') AND is_active = TRUE
    )
  );

-- 3. Seed "General" rejection reason for orgs that have none yet
INSERT INTO public.rejection_reasons (organization_id, name, sort_order)
SELECT o.id, 'General', 0
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.rejection_reasons rr
  WHERE rr.organization_id = o.id
);
