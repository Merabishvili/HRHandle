-- #4 — Retire the AI interview-questions feature.
--
-- The separate "AI interview questions" section on the vacancy detail tab was
-- removed (it duplicated the Assessment suggester). The backend route, action,
-- lib, and tests are deleted in the same change; this drops the now-unused
-- JSONB column. Any saved data is discarded (it was never surfaced after the UI
-- removal).
--
-- Apply on staging now; apply on production with the deploy.

ALTER TABLE public.vacancies
  DROP COLUMN IF EXISTS interview_questions;
