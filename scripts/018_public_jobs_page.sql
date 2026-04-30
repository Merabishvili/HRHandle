-- 018: public jobs page
-- Add public_page_token to organizations (used as the public jobs page URL key)
-- Add show_on_public_page to vacancies

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS public_page_token uuid UNIQUE DEFAULT gen_random_uuid();

-- Backfill existing orgs that got NULL (shouldn't happen with DEFAULT, but be safe)
UPDATE organizations
SET public_page_token = gen_random_uuid()
WHERE public_page_token IS NULL;

ALTER TABLE organizations
  ALTER COLUMN public_page_token SET NOT NULL;

-- Toggle per vacancy
ALTER TABLE vacancies
  ADD COLUMN IF NOT EXISTS show_on_public_page boolean NOT NULL DEFAULT false;
