-- Create public storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-logos',
  'org-logos',
  true,
  2097152,  -- 2 MB
  '{image/jpeg,image/png,image/webp,image/gif}'
)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read logos (needed for public apply form)
CREATE POLICY "Public read org logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'org-logos');

-- Authenticated users can upload (org owners — enforced at app layer)
CREATE POLICY "Authenticated upload org logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'org-logos');

-- Authenticated users can replace their logo
CREATE POLICY "Authenticated update org logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'org-logos');

-- Authenticated users can delete their logo
CREATE POLICY "Authenticated delete org logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'org-logos');
