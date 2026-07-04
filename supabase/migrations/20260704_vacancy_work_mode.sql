-- #2 — Work mode on vacancies (Remote / Hybrid / On-site).
--
-- Previously "work mode" only lived inside the free-text `location`, so the
-- Vacancies list "Type" column was ambiguous and work mode couldn't be its own
-- column. This adds a dedicated field.
--
-- Apply on staging now; apply on production with the deploy.

ALTER TABLE public.vacancies
  ADD COLUMN IF NOT EXISTS work_mode TEXT;

ALTER TABLE public.vacancies
  DROP CONSTRAINT IF EXISTS vacancies_work_mode_check;

ALTER TABLE public.vacancies
  ADD CONSTRAINT vacancies_work_mode_check
  CHECK (work_mode IS NULL OR work_mode IN ('remote', 'hybrid', 'onsite'));

COMMENT ON COLUMN public.vacancies.work_mode IS
  '#2 — remote | hybrid | onsite | NULL (unspecified).';
