-- 021: add public_page_slug to organizations
-- Separate from the internal app slug (which has a user-id suffix for uniqueness).
-- This is the human-readable URL segment for the public jobs page.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS public_page_slug TEXT;

-- Backfill existing orgs with clean slugs derived from their name.
-- First org with a name gets "company", second gets "company1", etc.
DO $$
DECLARE
  r RECORD;
  base_slug TEXT;
  candidate_slug TEXT;
  counter INTEGER;
BEGIN
  FOR r IN SELECT id, name FROM organizations ORDER BY created_at ASC LOOP
    -- Slugify: lowercase, strip non-alphanumeric (except spaces/hyphens), collapse spaces → hyphens
    base_slug := lower(
      regexp_replace(
        regexp_replace(trim(r.name), '[^a-zA-Z0-9\s\-]', '', 'g'),
        '\s+', '-', 'g'
      )
    );
    base_slug := regexp_replace(base_slug, '-+', '-', 'g');
    base_slug := trim(base_slug, '-');
    IF base_slug = '' OR base_slug IS NULL THEN
      base_slug := 'org';
    END IF;

    -- Find a unique slug (numeric suffix, no separator per user spec: company, company1, company2)
    candidate_slug := base_slug;
    counter := 1;
    WHILE EXISTS (SELECT 1 FROM organizations WHERE public_page_slug = candidate_slug) LOOP
      candidate_slug := base_slug || counter::text;
      counter := counter + 1;
    END LOOP;

    UPDATE organizations SET public_page_slug = candidate_slug WHERE id = r.id;
  END LOOP;
END $$;

-- Enforce uniqueness and NOT NULL going forward
ALTER TABLE organizations ALTER COLUMN public_page_slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_public_page_slug
  ON organizations (public_page_slug);
