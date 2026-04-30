-- 019: Microsoft OAuth token storage on profiles + event id on interviews
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS microsoft_access_token  text,
  ADD COLUMN IF NOT EXISTS microsoft_refresh_token text,
  ADD COLUMN IF NOT EXISTS microsoft_token_expiry  bigint;

ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS microsoft_calendar_event_id text;
