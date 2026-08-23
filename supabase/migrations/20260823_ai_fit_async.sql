-- AI Fit Analysis — async processing (#1).
--
-- The analysis previously ran synchronously inside the server action, so the
-- request blocked for the full model budget (up to 6 attempts × 25s) and Vercel
-- killed the function → "temporarily unavailable". We now insert a `pending`
-- row, run the model in the background (Next.js `after()`), and flip the row to
-- `completed` / `failed` + fire an in-app notification. That means a `pending`
-- row exists before the outputs are known, so the output columns must be
-- nullable while it runs.
--
-- Idempotent (IF EXISTS / IF NOT EXISTS). Apply on BOTH staging and production
-- Supabase projects.

BEGIN;

ALTER TABLE public.ai_fit_analyses
  ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending','completed','failed')),
  ADD COLUMN IF NOT EXISTS error_reason TEXT;

-- Outputs are unknown until the background run finishes; allow NULL for pending
-- rows. `prompt_version` stays NOT NULL — it's a constant stamped at insert.
ALTER TABLE public.ai_fit_analyses
  ALTER COLUMN meets_count       DROP NOT NULL,
  ALTER COLUMN must_have_total   DROP NOT NULL,
  ALTER COLUMN rendered_analysis DROP NOT NULL,
  ALTER COLUMN model_name        DROP NOT NULL;

-- Every pre-existing row already has its outputs → mark them completed.
UPDATE public.ai_fit_analyses SET status = 'completed' WHERE status IS NULL;

COMMIT;
