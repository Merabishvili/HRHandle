-- =============================================================================
-- 029_storage_buckets_and_policies.sql
--
-- Source-of-truth snapshot of the two Supabase Storage buckets and the RLS
-- policies on `storage.objects`. Captures live state on staging + production
-- (verified identical 2026-05-23 via the Supabase MCP).
--
-- Audit ref: S-015. Prior to this script the bucket configuration lived only
-- in the Supabase Dashboard, so cloning to a fresh project or running CI in
-- an isolated env required re-creating these by hand.
--
-- IMPORTANT: this script is **idempotent** — it can be safely re-run. Apply
-- via Supabase SQL Editor (the local Supabase MCP is in read-only mode, so we
-- cannot apply migrations programmatically from this tool).
-- =============================================================================

-- 1) Buckets ---------------------------------------------------------------
--    candidate-documents: private (no listing, no public URL). All reads/writes
--      go via the admin client (`createAdminClient()` in lib/supabase/admin.ts).
--    org-logos: public direct-URL access, 2 MB upload cap, images only.
--      Listing was disabled in scripts/027 (S-NEW-4).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('candidate-documents', 'candidate-documents', false, NULL, NULL),
  ('org-logos',           'org-logos',           true,  2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) Policies on storage.objects ------------------------------------------
--    Only the org-logos bucket has explicit policies — candidate-documents is
--    accessed exclusively via the service-role admin client which bypasses RLS.

DROP POLICY IF EXISTS "Authenticated upload org logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update org logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete org logos" ON storage.objects;

CREATE POLICY "Authenticated upload org logos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'org-logos');

CREATE POLICY "Authenticated update org logos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'org-logos');

CREATE POLICY "Authenticated delete org logos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'org-logos');

-- Note: there is intentionally **no** SELECT policy on storage.objects. The
-- public-bucket flag on `org-logos` already grants direct-URL read access via
-- `/storage/v1/object/public/...`, and the previous broad SELECT (which also
-- allowed listing every file in the bucket) was dropped in scripts/027 per
-- audit finding S-NEW-4.
