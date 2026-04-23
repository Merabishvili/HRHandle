-- Migration 012: interview meeting link + Zoom OAuth tokens

-- 1. Add manual/Zoom meeting link to interviews
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS meeting_link TEXT;

-- 2. Add Zoom OAuth token fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS zoom_access_token  TEXT,
  ADD COLUMN IF NOT EXISTS zoom_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS zoom_token_expiry  BIGINT;
