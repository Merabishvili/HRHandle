-- Migration 027: Fix Supabase advisor finding S-NEW-4 (public_bucket_allows_listing)
--
-- The `org-logos` bucket is public (bucket.public = true). The "Public read org
-- logos" SELECT policy on storage.objects let any caller (including `anon`)
-- LIST all files in the bucket — leaking every organization's UUID via file
-- paths of the form `{org_uuid}/logo.{ext}`.
--
-- Public buckets serve files via `/storage/v1/object/public/{bucket}/{path}`,
-- which bypasses storage.objects RLS. Dropping the SELECT policy stops the
-- listing leak; direct-URL image rendering continues to work via `getPublicUrl()`.
--
-- App ripple-check: the only writer is `components/settings/organization-form.tsx`
-- using `.upload(..., {upsert: true})`, which goes through the existing INSERT +
-- UPDATE policies. No `.list()` or `.download()` callers exist for this bucket.
--
-- Apply to BOTH Supabase projects (staging + production). See CLAUDE.md.

DROP POLICY IF EXISTS "Public read org logos" ON storage.objects;
