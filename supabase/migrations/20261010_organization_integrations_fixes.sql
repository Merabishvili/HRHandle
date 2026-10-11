-- organization_integrations fixes (2026-10-10)
--
-- 1. Calendly rows were never allowed. The table was created for LinkedIn only
--    (`CHECK (platform IN ('linkedin'))`) and 041 added the Calendly columns
--    but not the platform value, so saving a Calendly connection failed.
-- 2. Disconnecting Calendly clears `access_token`, which was NOT NULL, so the
--    disconnect update failed and the row stayed active.
-- 3. Every org member could read every column — including the Calendly OAuth
--    tokens and the webhook signing key — and insert/update/delete the org's
--    integrations straight through the API. Now members read only the
--    non-secret columns, and only owners/admins may write. The app reads the
--    secrets and writes through the service role, which bypasses both.
--
-- Apply in Supabase: Dashboard → SQL Editor → run this file on BOTH the
-- staging (quotchdymcnjlnwtjmgu) and production (fnpyfwhvgzoxgyjafbsg)
-- projects. Safe to re-run.

BEGIN;

-- 1. Allow Calendly.
ALTER TABLE public.organization_integrations
  DROP CONSTRAINT IF EXISTS organization_integrations_platform_check;
ALTER TABLE public.organization_integrations
  ADD CONSTRAINT organization_integrations_platform_check
  CHECK (platform IN ('linkedin', 'calendly'));

-- 2. A disconnected Calendly row keeps no token.
ALTER TABLE public.organization_integrations
  ALTER COLUMN access_token DROP NOT NULL;

-- 3. Replace every policy on the table. They're looked up rather than dropped
--    by name: the live databases may carry policies that aren't in the repo,
--    and one leftover permissive policy would keep the old access.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organization_integrations'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.organization_integrations', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.organization_integrations ENABLE ROW LEVEL SECURITY;

-- 3a. Writes: owners and admins only.
CREATE POLICY "org_admins_can_manage_integrations"
  ON public.organization_integrations FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- 3b. Reads: org members keep row access (the vacancy page shows "Post to
-- LinkedIn Jobs", candidate pages show "Calendly link")…
CREATE POLICY "org_members_can_read_integrations"
  ON public.organization_integrations FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- …but not to the secret columns (access_token, refresh_token,
-- webhook_signing_key). Column grants: a select that names them is refused.
REVOKE SELECT ON public.organization_integrations FROM anon, authenticated;
GRANT SELECT (
  id,
  organization_id,
  platform,
  external_page_id,
  external_page_name,
  token_expires_at,
  connected_by,
  connected_at,
  is_active,
  webhook_subscription_id,
  selected_event_type_uri,
  selected_event_type_name,
  external_user_uri
) ON public.organization_integrations TO authenticated;

COMMIT;

-- Check afterwards — two policies (org_admins_can_manage_integrations,
-- org_members_can_read_integrations), and no SELECT grant on the 🔒 columns:
--   select policyname, cmd from pg_policies where tablename = 'organization_integrations';
--   select column_name, privilege_type from information_schema.column_privileges
--   where table_name = 'organization_integrations' and grantee = 'authenticated'
--     and privilege_type = 'SELECT' order by 1;
