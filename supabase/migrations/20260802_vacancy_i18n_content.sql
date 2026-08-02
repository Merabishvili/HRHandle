-- i18n Slice 4 (step 1) — per-vacancy multilingual content.
-- See docs/redesign/i18n-plan.md §2.5 + §3.
--
-- Adds JSONB "{locale: text}" columns ALONGSIDE the existing single-language
-- text columns (two-step, reversible: the legacy columns stay until a later
-- drop-migration once every reader/writer uses the _i18n columns). Backfills
-- each _i18n with {"en": <existing text>} so nothing is lost. Also adds
-- vacancies.posting_locales (which locales a vacancy is published in).
--
-- Idempotent: IF NOT EXISTS on columns + WHERE _i18n IS NULL on backfills.

ALTER TABLE public.vacancies
  ADD COLUMN IF NOT EXISTS description_i18n      jsonb,
  ADD COLUMN IF NOT EXISTS responsibilities_i18n jsonb,
  ADD COLUMN IF NOT EXISTS requirements_i18n     jsonb,
  ADD COLUMN IF NOT EXISTS posting_locales       text[] NOT NULL DEFAULT ARRAY['en']::text[];

ALTER TABLE public.vacancy_screening_questions
  ADD COLUMN IF NOT EXISTS label_i18n jsonb;

ALTER TABLE public.vacancy_questions
  ADD COLUMN IF NOT EXISTS label_i18n jsonb;

-- Backfill: seed each _i18n from the current English text.
UPDATE public.vacancies
   SET description_i18n = jsonb_build_object('en', description)
 WHERE description IS NOT NULL AND description_i18n IS NULL;
UPDATE public.vacancies
   SET responsibilities_i18n = jsonb_build_object('en', responsibilities)
 WHERE responsibilities IS NOT NULL AND responsibilities_i18n IS NULL;
UPDATE public.vacancies
   SET requirements_i18n = jsonb_build_object('en', requirements)
 WHERE requirements IS NOT NULL AND requirements_i18n IS NULL;
UPDATE public.vacancy_screening_questions
   SET label_i18n = jsonb_build_object('en', label)
 WHERE label IS NOT NULL AND label_i18n IS NULL;
UPDATE public.vacancy_questions
   SET label_i18n = jsonb_build_object('en', label)
 WHERE label IS NOT NULL AND label_i18n IS NULL;

COMMENT ON COLUMN public.vacancies.posting_locales IS
  'Locales this vacancy is published in (subset of the org enabled_content_locales; ''en'' default).';
