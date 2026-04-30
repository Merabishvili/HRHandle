-- Migration 008: column preferences + evaluation system

-- 1. Column preferences per user
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS column_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Vacancy questions (defines the evaluation template per vacancy)
CREATE TABLE IF NOT EXISTS public.vacancy_questions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vacancy_id      UUID        NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
  type            TEXT        NOT NULL CHECK (type IN ('text', 'score')),
  label           TEXT        NOT NULL,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vacancy_questions_vacancy
  ON public.vacancy_questions (vacancy_id);

CREATE INDEX IF NOT EXISTS idx_vacancy_questions_org
  ON public.vacancy_questions (organization_id);

-- 3. Candidate evaluations (one per application; survives vacancy-unlink as history)
CREATE TABLE IF NOT EXISTS public.candidate_evaluations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  application_id  UUID        REFERENCES public.applications(id) ON DELETE SET NULL,
  candidate_id    UUID        NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  vacancy_id      UUID        NOT NULL REFERENCES public.vacancies(id) ON DELETE RESTRICT,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  score           SMALLINT    CHECK (score >= 0 AND score <= 100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (application_id)
);

CREATE INDEX IF NOT EXISTS idx_candidate_evaluations_candidate
  ON public.candidate_evaluations (candidate_id);

CREATE INDEX IF NOT EXISTS idx_candidate_evaluations_vacancy
  ON public.candidate_evaluations (vacancy_id);

CREATE INDEX IF NOT EXISTS idx_candidate_evaluations_org
  ON public.candidate_evaluations (organization_id);

-- 4. Evaluation answers (one row per question per evaluation)
CREATE TABLE IF NOT EXISTS public.candidate_evaluation_answers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  evaluation_id   UUID        NOT NULL REFERENCES public.candidate_evaluations(id) ON DELETE CASCADE,
  question_id     UUID        NOT NULL REFERENCES public.vacancy_questions(id) ON DELETE CASCADE,
  text_value      TEXT,
  score_value     SMALLINT    CHECK (score_value >= 1 AND score_value <= 10),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (evaluation_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_evaluation_answers_evaluation
  ON public.candidate_evaluation_answers (evaluation_id);

CREATE INDEX IF NOT EXISTS idx_evaluation_answers_question
  ON public.candidate_evaluation_answers (question_id);

-- 5. RLS
ALTER TABLE public.vacancy_questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_evaluations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_evaluation_answers ENABLE ROW LEVEL SECURITY;

-- vacancy_questions
CREATE POLICY "Users can view vacancy questions in their org"
  ON public.vacancy_questions FOR SELECT
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Owners and admins can manage vacancy questions"
  ON public.vacancy_questions FOR ALL
  USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('owner', 'admin')
  );

-- candidate_evaluations
CREATE POLICY "Users can view evaluations in their org"
  ON public.candidate_evaluations FOR SELECT
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage evaluations in their org"
  ON public.candidate_evaluations FOR ALL
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- candidate_evaluation_answers
CREATE POLICY "Users can view evaluation answers in their org"
  ON public.candidate_evaluation_answers FOR SELECT
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage evaluation answers in their org"
  ON public.candidate_evaluation_answers FOR ALL
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
