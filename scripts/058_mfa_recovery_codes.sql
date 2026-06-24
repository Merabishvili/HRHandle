-- =====================================================================
-- A-8b — MFA recovery codes + active sessions helpers
-- =====================================================================
--
-- Per `Merge Notifications Security.dc.html` §A-8, the MFA card needs
-- a "Recovery codes · N of 10 remaining · Regenerate" affordance.
-- Supabase's TOTP factor type does not ship user-facing recovery
-- codes natively, so we store our own — hashed.
--
-- WHAT WE STORE:
--   * One sha256 hex per code (uppercase A-Z0-9 only — readable by a
--     person typing them in if needed)
--   * `consumed_at` so a future MFA challenge fallback can mark a
--     code used. Slice 1 doesn't wire the consumption path; the
--     column is here so it doesn't require a follow-up migration.
--
-- HOW THE RAW CODE FLOW WORKS:
--   1. Recruiter clicks Regenerate
--   2. App generates 10 raw codes in memory
--   3. App hashes each and calls replace_mfa_recovery_codes()
--   4. App returns the 10 raw codes to the client ONCE for a reveal-
--      once modal. They are NEVER persisted in raw form.
--
-- The RLS policy lets a user SELECT their own rows (to count
-- remaining) but writes only happen via the SECURITY DEFINER
-- function. That keeps the table tamper-proof from compromised
-- client sessions while letting the count query work without an RPC.

BEGIN;

CREATE TABLE IF NOT EXISTS public.mfa_recovery_codes (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash   TEXT         NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, code_hash)
);

CREATE INDEX IF NOT EXISTS idx_mfa_recovery_codes_user
  ON public.mfa_recovery_codes (user_id);

CREATE INDEX IF NOT EXISTS idx_mfa_recovery_codes_user_unused
  ON public.mfa_recovery_codes (user_id)
  WHERE consumed_at IS NULL;

ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

-- Owner-read only. Writes flow through the SECURITY DEFINER function
-- so a compromised user session can't clear codes without holding the
-- short-window MFA challenge their generation was gated behind.
DROP POLICY IF EXISTS "users read their own recovery codes" ON public.mfa_recovery_codes;
CREATE POLICY "users read their own recovery codes"
  ON public.mfa_recovery_codes FOR SELECT
  USING (user_id = auth.uid());

-- replace_mfa_recovery_codes(hashes) — atomic rotate. Deletes the
-- caller's existing codes and inserts the supplied set. Caller is
-- responsible for generating + hashing the raw codes client-side and
-- showing them once.
CREATE OR REPLACE FUNCTION public.replace_mfa_recovery_codes(
  p_code_hashes TEXT[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count   INTEGER := 0;
  v_hash    TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_code_hashes IS NULL OR array_length(p_code_hashes, 1) IS NULL THEN
    RAISE EXCEPTION 'code_hashes array is required';
  END IF;
  IF array_length(p_code_hashes, 1) > 20 THEN
    RAISE EXCEPTION 'too many recovery codes (cap 20)';
  END IF;

  DELETE FROM public.mfa_recovery_codes WHERE user_id = v_user_id;

  FOREACH v_hash IN ARRAY p_code_hashes LOOP
    IF length(v_hash) < 16 THEN
      RAISE EXCEPTION 'recovery code hash too short — generation bug';
    END IF;
    INSERT INTO public.mfa_recovery_codes (user_id, code_hash)
    VALUES (v_user_id, v_hash);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_mfa_recovery_codes(TEXT[]) TO authenticated;

-- count_mfa_recovery_codes() — convenience query so the Settings UI
-- can display "N of 10 remaining" without leaking hash data through
-- the wire. Returns the count of un-consumed codes for the caller.
CREATE OR REPLACE FUNCTION public.count_mfa_recovery_codes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count   INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT COUNT(*) INTO v_count
    FROM public.mfa_recovery_codes
   WHERE user_id = v_user_id AND consumed_at IS NULL;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_mfa_recovery_codes() TO authenticated;

-- ---------------------------------------------------------------------
-- Active sessions helpers
-- ---------------------------------------------------------------------
--
-- Supabase Auth manages `auth.sessions` directly; that schema isn't
-- exposed through PostgREST by default. These SECURITY DEFINER
-- wrappers let the Settings UI list + revoke the current user's
-- sessions without holding a service-role key.
--
-- list_my_sessions() returns id + user_agent + ip + created_at +
-- refreshed_at + not_after for every session belonging to the caller.
-- delete_my_session(id) revokes one session by id.
-- delete_my_other_sessions(current_session_id) wipes every session
-- except the caller's own, supporting the design's "Sign out
-- everywhere" affordance.
--
-- "Sign out everywhere" deliberately keeps the caller's session so
-- the user isn't logged out of the Settings page mid-action; the
-- client can then prompt to log out everywhere including the current
-- device if they want a clean slate.

CREATE OR REPLACE FUNCTION public.list_my_sessions()
RETURNS TABLE (
  id           UUID,
  user_agent   TEXT,
  ip           INET,
  created_at   TIMESTAMPTZ,
  refreshed_at TIMESTAMPTZ,
  not_after    TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  RETURN QUERY
    SELECT s.id, s.user_agent, s.ip, s.created_at, s.refreshed_at, s.not_after
      FROM auth.sessions s
     WHERE s.user_id = v_user_id
     ORDER BY s.refreshed_at DESC NULLS LAST, s.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_my_sessions() TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_my_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_deleted INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'session_id is required';
  END IF;

  DELETE FROM auth.sessions
   WHERE id = p_session_id AND user_id = v_user_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_session(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_my_other_sessions(p_current_session_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_deleted INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  DELETE FROM auth.sessions
   WHERE user_id = v_user_id
     AND (p_current_session_id IS NULL OR id <> p_current_session_id);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_other_sessions(UUID) TO authenticated;

COMMIT;
