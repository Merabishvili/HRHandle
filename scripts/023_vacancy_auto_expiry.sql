-- Migration 023: Auto-close vacancies whose end_date has passed
-- Requires pg_cron extension (enabled in Supabase by default on paid plans)
-- Run in Supabase SQL editor

CREATE OR REPLACE FUNCTION expire_past_vacancies()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_closed_status_id UUID;
BEGIN
  SELECT id INTO v_closed_status_id
  FROM vacancy_statuses
  WHERE code = 'closed'
  LIMIT 1;

  IF v_closed_status_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE vacancies
  SET status_id  = v_closed_status_id,
      archived_at = NOW()
  WHERE end_date   < CURRENT_DATE
    AND archived_at IS NULL
    AND status_id IN (
      SELECT id FROM vacancy_statuses WHERE code IN ('open', 'on_hold')
    );
END;
$$;

-- Schedule: run daily at 01:00 UTC
SELECT cron.schedule(
  'expire-past-vacancies',
  '0 1 * * *',
  'SELECT expire_past_vacancies()'
);
