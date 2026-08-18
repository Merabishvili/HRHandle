-- Migration 037: Scorecard sharing tokens (G-025)
--
-- Adds four columns to `candidate_evaluations` so a recruiter can share a
-- candidate's evaluation with a non-HRHandle stakeholder (hiring manager,
-- exec) via a token-gated public URL at `/scorecard/<token>`.
--
-- - `scorecard_token` — 32-char hex (UUID-without-hyphens). Nullable so
--   existing evaluations stay private until the recruiter explicitly
--   shares; UNIQUE enforces the one-token-per-evaluation invariant.
-- - `scorecard_revoked_at` — timestamp of the most recent revoke. Lets the
--   share dialog show "last shared / revoked on …" without us reading the
--   audit log. Doesn't gate access on its own; gating is the token being
--   non-NULL.
-- - `shared_by` — `profiles.id` of the recruiter who first generated the
--   token. Used for stable attribution on the public page ("Shared by
--   Alex"). Set to NULL via ON DELETE SET NULL if they leave the org.
-- - `shared_at` — timestamp of the first share. Re-share after revoke
--   leaves this unchanged so the public page reflects when the candidate's
--   eval was originally cleared to leave the workspace.
--
-- Re-sharing after a revoke generates a fresh token (different value) and
-- clears `scorecard_revoked_at`. The old token stops working as soon as it
-- is overwritten/cleared.
--
-- Apply in Supabase: Dashboard → SQL Editor → run this file on BOTH the
-- staging (quotchdymcnjlnwtjmgu) and production (fnpyfwhvgzoxgyjafbsg)
-- projects. Safe to re-run (column existence checks + idempotent index).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'candidate_evaluations'
      AND column_name  = 'scorecard_token'
  ) THEN
    ALTER TABLE public.candidate_evaluations
      ADD COLUMN scorecard_token TEXT UNIQUE;
    RAISE NOTICE 'Added scorecard_token to candidate_evaluations.';
  ELSE
    RAISE NOTICE 'scorecard_token already exists, skipping.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'candidate_evaluations'
      AND column_name  = 'scorecard_revoked_at'
  ) THEN
    ALTER TABLE public.candidate_evaluations
      ADD COLUMN scorecard_revoked_at TIMESTAMPTZ;
    RAISE NOTICE 'Added scorecard_revoked_at to candidate_evaluations.';
  ELSE
    RAISE NOTICE 'scorecard_revoked_at already exists, skipping.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'candidate_evaluations'
      AND column_name  = 'shared_by'
  ) THEN
    ALTER TABLE public.candidate_evaluations
      ADD COLUMN shared_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added shared_by to candidate_evaluations.';
  ELSE
    RAISE NOTICE 'shared_by already exists, skipping.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'candidate_evaluations'
      AND column_name  = 'shared_at'
  ) THEN
    ALTER TABLE public.candidate_evaluations
      ADD COLUMN shared_at TIMESTAMPTZ;
    RAISE NOTICE 'Added shared_at to candidate_evaluations.';
  ELSE
    RAISE NOTICE 'shared_at already exists, skipping.';
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_evaluations_scorecard_token
  ON public.candidate_evaluations (scorecard_token)
  WHERE scorecard_token IS NOT NULL;

COMMENT ON COLUMN public.candidate_evaluations.scorecard_token IS
  'When non-NULL, the candidate scorecard for this evaluation is accessible at /scorecard/<token>. Revoke by setting to NULL.';
COMMENT ON COLUMN public.candidate_evaluations.scorecard_revoked_at IS
  'Timestamp of the most recent revoke (token cleared). Re-sharing clears this back to NULL.';
