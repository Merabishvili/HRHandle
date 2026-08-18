-- #1 — Storage bucket for user avatars.
--
-- Public bucket (avatar images are shown in the app header / lists). Writes go
-- through the `uploadAvatar` server action using the service-role admin client,
-- so no per-user storage.objects policies are required — public read is enough.
--
-- If your project restricts direct inserts into storage.buckets from SQL, create
-- the bucket named `avatars` (public, 2 MB, image/jpeg|png|webp) via the
-- Supabase dashboard instead; the app only needs the bucket to exist + be public.
--
-- Apply on staging now; apply on production with the deploy.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 2097152,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];
