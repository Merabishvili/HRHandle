-- Migration 045: per-user notification preferences (Wave 1.2 / Phase 0.7)
--
-- Adds a JSONB column on profiles for granular email + in-product
-- notification settings. The default value opts the user in to all email
-- events (sensible recruiter default; saves an empty-form-on-first-visit
-- experience).
--
-- Shape (`notification_preferences` JSONB):
--   {
--     "email": {
--       "new_applicant":            true,
--       "interview_scheduled":      true,
--       "offer_awaiting_response":  true,
--       "mention":                  true,
--       "team_invite_update":       true,
--       "weekly_digest":            false
--     },
--     "in_product": {
--       "show_bell_badge":          true,
--       "auto_mark_read":           true
--     },
--     "quiet_hours": null
--   }
--
-- `quiet_hours` is reserved for v1.1 — when set, the shape is
-- `{ "start_local": "22:00", "end_local": "07:00", "timezone": "Europe/Tbilisi" }`.
-- The current notification dispatcher does not yet read quiet_hours; the
-- column carries the future config slot so the schema is forward-compatible.
--
-- Apply in Supabase: Dashboard → SQL Editor → run this file on BOTH staging
-- (quotchdymcnjlnwtjmgu) and production (fnpyfwhvgzoxgyjafbsg) projects.
-- Safe to re-run (`ADD COLUMN IF NOT EXISTS`).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{
    "email": {
      "new_applicant": true,
      "interview_scheduled": true,
      "offer_awaiting_response": true,
      "mention": true,
      "team_invite_update": true,
      "weekly_digest": false
    },
    "in_product": {
      "show_bell_badge": true,
      "auto_mark_read": true
    },
    "quiet_hours": null
  }'::jsonb;
