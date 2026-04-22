-- =====================================================
-- 006: Add member_limit to subscriptions
-- =====================================================

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS member_limit INTEGER NOT NULL DEFAULT 2;

-- Set correct limits for existing rows
UPDATE public.subscriptions
  SET member_limit = CASE
    WHEN plan_code = 'professional' THEN 30
    ELSE 2
  END;
