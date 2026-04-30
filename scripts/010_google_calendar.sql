-- Migration 010: Google Calendar / Meet integration

-- 1. Add Google OAuth token fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS google_access_token  TEXT,
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_token_expiry  BIGINT;

-- 2. Add Google Meet fields to interviews
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS google_meet_link         TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;
