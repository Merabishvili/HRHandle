-- =====================================================================
-- Candidate CSV bulk import — server-backed redesign
-- =====================================================================
--
-- Replaces the old client-only mapping wizard with a server-backed flow:
--   upload → review (edit) → confirm → running (job) → done.
--
-- Three objects:
--   1. candidate_import_drafts — the parsed file + the user's inline edits
--      and deletions, persisted so a refresh (or a return within 24h) does
--      not lose work. Keyed by an `importId`. Uploader-only (RLS).
--   2. candidate_imports — the commit JOB + audit record: live progress
--      counters, status, cancel flag, timings. Same-org read; writes are
--      service-role only (the background job runs under the admin client).
--   3. candidates.import_id — stamps every candidate created by an import
--      so the done screen can deep-link to "this import" and an admin-side
--      rollback stays possible.
--
-- No backfill needed (existing data is wiped before relaunch). Idempotent.
-- Apply on BOTH Supabase projects (staging + production).

BEGIN;

-- ---------------------------------------------------------------------
-- 1. candidate_imports — job + audit record
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidate_imports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  filename         TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'running'
                     CHECK (status IN ('running','completed','cancelled','failed')),
  total            INTEGER NOT NULL DEFAULT 0,   -- rows submitted to the job
  imported         INTEGER NOT NULL DEFAULT 0,   -- candidates actually created
  deleted_count    INTEGER NOT NULL DEFAULT 0,   -- rows the user removed in review
  failed           INTEGER NOT NULL DEFAULT 0,   -- rows that failed at commit (e.g. dup race)
  cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
  error_reason     TEXT,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_candidate_imports_org
  ON public.candidate_imports (organization_id, started_at DESC);

ALTER TABLE public.candidate_imports ENABLE ROW LEVEL SECURITY;

-- Same-org members may read import records (done screen, activity). All
-- writes go through the service-role admin client (background job), which
-- bypasses RLS — so there is deliberately no INSERT/UPDATE policy here.
DROP POLICY IF EXISTS "org_members_read_candidate_imports" ON public.candidate_imports;
CREATE POLICY "org_members_read_candidate_imports"
  ON public.candidate_imports FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- ---------------------------------------------------------------------
-- 2. candidate_import_drafts — parsed file + edits (uploader-only)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidate_import_drafts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  filename         TEXT NOT NULL,
  headers          JSONB NOT NULL DEFAULT '[]'::jsonb,   -- original header row (as uploaded)
  rows             JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{ csvRow, values: {field: string|null} }]
  size_bytes       BIGINT NOT NULL DEFAULT 0,            -- uploaded file size (summary bar)
  column_count     INTEGER NOT NULL DEFAULT 0,           -- uploaded column count (summary bar)
  initial_row_count INTEGER NOT NULL DEFAULT 0,          -- rows at parse time (→ deleted tally)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_candidate_import_drafts_owner
  ON public.candidate_import_drafts (created_by, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidate_import_drafts_expires
  ON public.candidate_import_drafts (expires_at);

ALTER TABLE public.candidate_import_drafts ENABLE ROW LEVEL SECURITY;

-- Only the uploader can see or mutate their own draft, and only within
-- their own org. (Drafts hold un-committed PII, so they are per-user.)
DROP POLICY IF EXISTS "owner_manage_import_drafts" ON public.candidate_import_drafts;
CREATE POLICY "owner_manage_import_drafts"
  ON public.candidate_import_drafts FOR ALL
  USING (
    created_by = auth.uid()
    AND organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    created_by = auth.uid()
    AND organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 3. candidates.import_id — provenance stamp
-- ---------------------------------------------------------------------
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS import_id UUID
    REFERENCES public.candidate_imports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_import_id
  ON public.candidates (import_id);

COMMENT ON COLUMN public.candidates.import_id IS
  'The candidate_imports job that created this candidate via CSV bulk import. NULL for manually-added / public-apply candidates.';

COMMIT;
