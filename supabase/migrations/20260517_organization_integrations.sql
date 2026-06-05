CREATE TABLE IF NOT EXISTS organization_integrations (
  id                 UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id    UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform           TEXT        NOT NULL CHECK (platform IN ('linkedin')),
  external_page_id   TEXT        NOT NULL,   -- LinkedIn numeric company page ID
  external_page_name TEXT        NOT NULL,
  access_token       TEXT        NOT NULL,
  token_expires_at   TIMESTAMPTZ,
  connected_by       UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  connected_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  is_active          BOOLEAN     DEFAULT true NOT NULL,
  UNIQUE (organization_id, platform)
);

ALTER TABLE organization_integrations ENABLE ROW LEVEL SECURITY;

-- Org members can read their own org's integrations
CREATE POLICY "org_members_can_read_integrations"
  ON organization_integrations FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Org members can insert/update/delete their own org's integrations
CREATE POLICY "org_members_can_manage_integrations"
  ON organization_integrations FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
