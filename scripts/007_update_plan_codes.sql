-- =====================================================
-- 007: Update plan_code values and constraints
-- =====================================================

-- Drop existing check constraint on subscriptions
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_code_check;

-- Add updated constraint with new plan codes
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_code_check
  CHECK (plan_code IN ('trial', 'individual', 'organization'));

-- Update any existing 'professional' rows to 'individual'
UPDATE public.subscriptions
  SET plan_code = 'individual'
  WHERE plan_code = 'professional';
