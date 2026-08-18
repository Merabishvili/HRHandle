-- Migration 042: 2FA / TOTP policy + per-user enrollment flag (G-032, Phase 6.1)
--
-- Supabase Auth handles the actual TOTP secret + verification (records live in
-- `auth.mfa_factors`). This migration adds:
--   * An org-wide policy on `organizations` so an owner can require MFA from
--     all members, or just from owners/admins.
--   * A boolean cache on `profiles` (`mfa_enrolled`) so the middleware can
--     gate dashboard routes via the single profile query it already does,
--     without paying for a `auth.mfa.listFactors` round-trip on every request.
--     The flag is maintained in sync by the verify + unenroll server actions
--     and by the admin reset-factors recovery path.
--
-- Apply in Supabase: Dashboard → SQL Editor → run this file on BOTH the
-- staging (quotchdymcnjlnwtjmgu) and production (fnpyfwhvgzoxgyjafbsg)
-- projects. Safe to re-run.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS require_mfa            BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS require_mfa_for_admins BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mfa_enrolled BOOLEAN NOT NULL DEFAULT FALSE;

-- Admin recovery: clear every MFA factor for a given user. The action gate
-- in `lib/actions/mfa.ts:adminResetUserFactors` enforces "only owners and
-- admins of the same org can call this" before we ever invoke the RPC, and
-- the RPC is itself called via the service-role admin client. SECURITY
-- DEFINER lets the RPC cross schemas (the table is in `auth`, the function
-- in `public`); we leave EXECUTE granted to the default role set so the
-- service-role key can call it.
CREATE OR REPLACE FUNCTION public.admin_delete_user_mfa_factors(target_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM auth.mfa_factors WHERE user_id = target_user_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
