-- #6b — Default meeting provider for video interviews.
--
-- When a user connects more than one meeting tool (Google Calendar / Zoom /
-- Microsoft Teams), nothing recorded which one the Schedule-Interview flow's
-- auto-link logic should prefer — it just hard-coded Google > Zoom > Teams.
-- This adds a per-user preference so the Integrations page can expose a
-- "Default for video interviews" selector and the interview form can honour it.
--
-- Per-user (on profiles) because the auto-link uses the scheduling user's own
-- connected calendar. NULL = fall back to the built-in Google > Zoom > Teams
-- precedence.
--
-- Apply on BOTH Supabase projects (staging + production).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_meeting_provider TEXT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_default_meeting_provider_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_default_meeting_provider_check
  CHECK (
    default_meeting_provider IS NULL
    OR default_meeting_provider IN ('google_meet', 'zoom', 'teams')
  );

COMMENT ON COLUMN public.profiles.default_meeting_provider IS
  '#6b — preferred auto meeting link for this user''s video interviews '
  '(google_meet | zoom | teams). NULL = built-in Google > Zoom > Teams order.';
