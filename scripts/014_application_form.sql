-- Public application form support

-- Add form token to vacancies (NULL = form inactive)
ALTER TABLE public.vacancies
  ADD COLUMN IF NOT EXISTS application_form_token TEXT UNIQUE;

-- Add IP address tracking to applications for rate limiting
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'internal'
    CHECK (source_type IN ('internal', 'public_form'));

-- Index for rate limiting lookup
CREATE INDEX IF NOT EXISTS idx_applications_ip_created
  ON public.applications (ip_address, created_at)
  WHERE ip_address IS NOT NULL;

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_vacancies_form_token
  ON public.vacancies (application_form_token)
  WHERE application_form_token IS NOT NULL;
