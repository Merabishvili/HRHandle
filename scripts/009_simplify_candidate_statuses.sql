-- Migration 009: Simplify candidate statuses to Active / Hired / Archived

-- 1. Clear existing foreign key references
UPDATE public.candidates SET general_status_id = NULL;

-- 2. Remove old statuses
DELETE FROM public.candidate_statuses;

-- 3. Insert simplified statuses
INSERT INTO public.candidate_statuses (name, code, sort_order) VALUES
  ('Active',   'active',   1),
  ('Hired',    'hired',    2),
  ('Archived', 'archived', 3);

-- 4. Set all existing candidates to Active
UPDATE public.candidates
SET general_status_id = (
  SELECT id FROM public.candidate_statuses WHERE code = 'active'
);
