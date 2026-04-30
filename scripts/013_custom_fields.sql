-- Custom Fields: groups, definitions, and values
-- Entity types: 'candidate' | 'vacancy'
-- Field types: 'text' | 'number' | 'dropdown' | 'checkbox'

-- =====================================================
-- custom_field_groups
-- =====================================================
CREATE TABLE IF NOT EXISTS public.custom_field_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('candidate', 'vacancy')),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, entity_type, name)
);

ALTER TABLE public.custom_field_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view custom_field_groups"
  ON public.custom_field_groups FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid() AND is_active = TRUE
  ));

CREATE POLICY "org admins can manage custom_field_groups"
  ON public.custom_field_groups FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid() AND role IN ('owner', 'admin') AND is_active = TRUE
  ));

-- =====================================================
-- custom_fields
-- =====================================================
CREATE TABLE IF NOT EXISTS public.custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.custom_field_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'dropdown', 'checkbox')),
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  -- For dropdown: array of option strings, e.g. ["Option A", "Option B"]
  options JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view custom_fields"
  ON public.custom_fields FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid() AND is_active = TRUE
  ));

CREATE POLICY "org admins can manage custom_fields"
  ON public.custom_fields FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid() AND role IN ('owner', 'admin') AND is_active = TRUE
  ));

-- =====================================================
-- custom_field_values
-- =====================================================
CREATE TABLE IF NOT EXISTS public.custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  -- entity_id is the candidate or vacancy UUID
  entity_id UUID NOT NULL,
  value_text TEXT,
  value_number NUMERIC,
  value_boolean BOOLEAN,
  -- For dropdown: selected option string
  value_option TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (field_id, entity_id)
);

ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view custom_field_values"
  ON public.custom_field_values FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid() AND is_active = TRUE
  ));

CREATE POLICY "org members can upsert custom_field_values"
  ON public.custom_field_values FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid() AND is_active = TRUE
  ));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_custom_field_groups_org ON public.custom_field_groups(organization_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_custom_fields_group ON public.custom_fields(group_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_custom_field_values_entity ON public.custom_field_values(field_id, entity_id);
