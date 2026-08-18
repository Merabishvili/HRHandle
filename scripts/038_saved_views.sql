-- Migration 038: Saved filter views per recruiter (G-026)
--
-- Adds a `saved_views` table so each recruiter can save the current filter
-- combination on a list page (`/candidates` or `/vacancies`) under a named
-- view they can re-load with one click.
--
-- Per-user, not per-org. Two recruiters can each save a "Frontend Engineers"
-- view that means different things — the `organization_id` is here for
-- cascade-delete safety and a future smart-list-templates work that may
-- add a `is_shared` flag, not for cross-user visibility.
--
-- Apply in Supabase: Dashboard → SQL Editor → run this file on BOTH the
-- staging (quotchdymcnjlnwtjmgu) and production (fnpyfwhvgzoxgyjafbsg)
-- projects. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.saved_views (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Which list page does this view apply to. The CHECK constraint keeps
  -- stray values out — adding a new list-kind requires both a schema +
  -- application change, which is the right friction.
  list_kind       TEXT        NOT NULL,
  CONSTRAINT saved_views_list_kind_check
    CHECK (list_kind IN ('candidates', 'vacancies')),

  -- Display name shown in the dropdown. Per-user-per-kind unique so a
  -- recruiter can't save two "Senior Engineers" views on the same list.
  name            TEXT        NOT NULL,

  -- Normalised filter shape (see lib/saved-views/filter-encoding.ts).
  -- Empty `{}` is valid — it means "no filters", i.e. the full list.
  params          JSONB       NOT NULL DEFAULT '{}'::jsonb,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, list_kind, name)
);

CREATE INDEX IF NOT EXISTS idx_saved_views_user_kind
  ON public.saved_views (user_id, list_kind);

ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see their own saved views"   ON public.saved_views;
DROP POLICY IF EXISTS "Users insert their own saved views" ON public.saved_views;
DROP POLICY IF EXISTS "Users update their own saved views" ON public.saved_views;
DROP POLICY IF EXISTS "Users delete their own saved views" ON public.saved_views;

-- All four policies scope to `user_id = auth.uid()`. That's tighter than the
-- org-wide policies we use elsewhere — saved views are explicitly per-user
-- (not shared with the rest of the org).
CREATE POLICY "Users see their own saved views"
  ON public.saved_views
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users insert their own saved views"
  ON public.saved_views
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users update their own saved views"
  ON public.saved_views
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users delete their own saved views"
  ON public.saved_views
  FOR DELETE
  USING (user_id = auth.uid());

COMMENT ON TABLE public.saved_views IS
  'Per-recruiter saved filter combinations for the candidates and vacancies list pages.';
COMMENT ON COLUMN public.saved_views.params IS
  'Normalised URL search-params shape. Stripped of pagination + default sort by lib/saved-views/filter-encoding.ts before persisting.';
