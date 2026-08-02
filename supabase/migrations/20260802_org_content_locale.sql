-- i18n Slice 2 — organization content language.
-- See docs/redesign/i18n-plan.md §10.2.
--
-- Candidate-facing surfaces (public job pages, apply form, offer + status
-- pages) and AI-generated content render in the ORG's content language, which
-- is independent of each recruiter's personal UI language (profiles.language).
-- Only owners/admins change it; the app enforces the invariants (default must
-- be within the enabled set, 'en' is always enabled, values ∈ {en,ka,ru}).
--
-- Idempotent: safe to run more than once. No RLS change — organizations
-- already carries org-scoped policies and these are plain columns.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS default_content_locale  text   NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS enabled_content_locales text[] NOT NULL DEFAULT ARRAY['en']::text[];

COMMENT ON COLUMN public.organizations.default_content_locale IS
  'Default language for candidate-facing pages + AI content (i18n Slice 2). One of the enabled_content_locales.';
COMMENT ON COLUMN public.organizations.enabled_content_locales IS
  'Locales a candidate may view public pages in (subset of the app locales; ''en'' always included).';
