-- =====================================================
-- 005: Team Invitations table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.team_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  token           UUID NOT NULL DEFAULT gen_random_uuid(),
  invited_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_token_idx
  ON public.team_invitations(token);

CREATE INDEX IF NOT EXISTS team_invitations_org_email_idx
  ON public.team_invitations(organization_id, email)
  WHERE status = 'pending';

-- RLS
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Org members can view their org's invitations
DROP POLICY IF EXISTS "Org members can view invitations" ON public.team_invitations;
CREATE POLICY "Org members can view invitations"
  ON public.team_invitations FOR SELECT
  USING (organization_id = public.get_user_org_id());

-- Owners and admins can insert/update/delete invitations
DROP POLICY IF EXISTS "Owners and admins can manage invitations" ON public.team_invitations;
CREATE POLICY "Owners and admins can manage invitations"
  ON public.team_invitations FOR ALL
  USING (
    organization_id = public.get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id = public.get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Service role can read by token (for the accept-invite page using admin client)
DROP POLICY IF EXISTS "Service role can read invitation by token" ON public.team_invitations;
-- (service role bypasses RLS automatically — no policy needed)
