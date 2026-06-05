-- Migration 026: Fix Supabase advisor findings S-NEW-1 and S-NEW-3
--
-- S-NEW-1 (anon_security_definer_function_executable):
--   public.get_user_org_id() is SECURITY DEFINER and granted EXECUTE to PUBLIC,
--   making it callable by the anon role via /rest/v1/rpc/get_user_org_id.
--   Revoke from PUBLIC and anon; keep explicit grants to authenticated and
--   service_role. SECURITY DEFINER stays (required to break the recursive
--   profiles RLS lookup — see scripts/004_fix_rls_helper.sql).
--
-- S-NEW-3 (function_search_path_mutable):
--   Three functions lack SET search_path, enabling a search-path hijack surface.
--   Pin search_path to (pg_catalog, public) on each. The function bodies are
--   left in place — only the config is changed.
--
-- Apply to BOTH Supabase projects (staging + production). See CLAUDE.md.

-- ---------------------------------------------------------------------------
-- S-NEW-1: lock down get_user_org_id() execution
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.get_user_org_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_org_id() FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_user_org_id() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_user_org_id() TO service_role;

-- ---------------------------------------------------------------------------
-- S-NEW-3: pin search_path on three functions with mutable search_path
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.sync_candidate_status_on_application_change()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.close_expired_vacancies()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.sync_candidate_hired_status()
  SET search_path = pg_catalog, public;
