-- Add responsibilities field to vacancies
ALTER TABLE public.vacancies ADD COLUMN IF NOT EXISTS responsibilities TEXT;
