-- Migration 036: Internal @-mentions in candidate notes (G-021)
--
-- Adds a `mentions UUID[]` column to `candidate_notes` storing the
-- `profiles.id`s of teammates the note author tagged via @-mention. The
-- column has a default of `'{}'` so existing rows + any code that does not
-- yet write to it behave identically to before this migration.
--
-- The matching GIN index makes "notes mentioning me" lookups efficient — not
-- needed for this PR's send-on-save notification flow, but cheap to add now
-- and avoids a follow-up migration when we build a per-user mentions feed.
--
-- Apply in Supabase: Dashboard → SQL Editor → run this file on BOTH the
-- staging (quotchdymcnjlnwtjmgu) and production (fnpyfwhvgzoxgyjafbsg)
-- projects. Safe to re-run (column existence check + idempotent index).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'candidate_notes'
      AND column_name  = 'mentions'
  ) THEN
    ALTER TABLE public.candidate_notes
      ADD COLUMN mentions UUID[] NOT NULL DEFAULT '{}';
    RAISE NOTICE 'Added mentions to candidate_notes.';
  ELSE
    RAISE NOTICE 'mentions already exists on candidate_notes, skipping.';
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_candidate_notes_mentions
  ON public.candidate_notes USING gin (mentions);

COMMENT ON COLUMN public.candidate_notes.mentions IS
  'Array of profiles.id values tagged via @-mention in the note text. Used to deliver in-app notifications on save.';
