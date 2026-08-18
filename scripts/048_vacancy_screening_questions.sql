-- 048_vacancy_screening_questions.sql
--
-- Wave 2.5 Slice 2a — Screening questions schema.
--
-- The redesigned vacancy wizard's Step 4 captures a list of screening
-- questions ("Eligible to work here?", "Notice period?") that the design
-- specifies should appear on the public apply form, with knockout answers
-- *flagging* the application internally rather than blocking submission
-- (per Public Pages.dc.html — "let the candidate submit; we flag
-- internally — avoids tipping off / discrimination concerns").
--
-- Two tables:
--
--   1. vacancy_screening_questions — the question definitions on a
--      vacancy. answer_type covers the four enums called out in the
--      wizard's tech-debt note (`yes_no`, `short_text`, `number`,
--      `select`); `is_knockout` + `knockout_answer` carry the design's
--      "must = Yes" semantic (the answer that does NOT flag).
--
--   2. application_screening_answers — what each candidate answered, one
--      row per question per application. `is_knockout_flag` is the
--      pre-computed flag so the screening tab doesn't have to re-derive
--      it on every render. No writer in this slice — Slice 2b adds the
--      apply form integration that populates this table.
--
-- Idempotent — re-running this is a no-op.

CREATE TABLE IF NOT EXISTS public.vacancy_screening_questions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vacancy_id      UUID        NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
  label           TEXT        NOT NULL,
  answer_type     TEXT        NOT NULL DEFAULT 'yes_no'
                              CHECK (answer_type IN ('yes_no', 'short_text', 'number', 'select')),
  -- For answer_type='select': JSON array of the allowed option strings.
  -- Null for the other types.
  options         JSONB,
  is_knockout     BOOLEAN     NOT NULL DEFAULT false,
  -- The single answer string that does NOT trigger the knockout flag.
  -- E.g. 'yes' means "candidate must answer Yes; any other answer flags".
  -- Null when is_knockout=false.
  knockout_answer TEXT,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vacancy_screening_questions_vacancy
  ON public.vacancy_screening_questions (vacancy_id);

CREATE INDEX IF NOT EXISTS idx_vacancy_screening_questions_org
  ON public.vacancy_screening_questions (organization_id);

CREATE TABLE IF NOT EXISTS public.application_screening_answers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  application_id   UUID        NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  question_id      UUID        NOT NULL REFERENCES public.vacancy_screening_questions(id) ON DELETE CASCADE,
  answer_value     TEXT,
  is_knockout_flag BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (application_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_application_screening_answers_application
  ON public.application_screening_answers (application_id);

CREATE INDEX IF NOT EXISTS idx_application_screening_answers_question
  ON public.application_screening_answers (question_id);

-- RLS — same shape as vacancy_questions / candidate_evaluation_answers.
ALTER TABLE public.vacancy_screening_questions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_screening_answers  ENABLE ROW LEVEL SECURITY;

-- vacancy_screening_questions
DROP POLICY IF EXISTS "Users can view screening questions in their org"
  ON public.vacancy_screening_questions;
CREATE POLICY "Users can view screening questions in their org"
  ON public.vacancy_screening_questions FOR SELECT
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Owners and admins can manage screening questions"
  ON public.vacancy_screening_questions;
CREATE POLICY "Owners and admins can manage screening questions"
  ON public.vacancy_screening_questions FOR ALL
  USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('owner', 'admin')
  );

-- application_screening_answers
DROP POLICY IF EXISTS "Users can view screening answers in their org"
  ON public.application_screening_answers;
CREATE POLICY "Users can view screening answers in their org"
  ON public.application_screening_answers FOR SELECT
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage screening answers in their org"
  ON public.application_screening_answers;
CREATE POLICY "Users can manage screening answers in their org"
  ON public.application_screening_answers FOR ALL
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

COMMENT ON TABLE public.vacancy_screening_questions IS
  'Wave 2.5 Slice 2 — recruiter-defined questions surfaced on the public apply form. '
  'Knockout answers flag the application internally rather than blocking submission.';

COMMENT ON TABLE public.application_screening_answers IS
  'Wave 2.5 Slice 2 — one row per question per application. '
  'is_knockout_flag is pre-computed at submit time for fast screening-tab reads.';
