-- Migration 041: extend organization_integrations for Calendly (G-031, Phase 5.2)
--
-- The existing table stores LinkedIn (page-post) OAuth credentials. Calendly
-- adds a few extra fields:
--   * `refresh_token` — for offline access (LinkedIn uses long-lived tokens
--     so it didn't need this; Calendly access tokens expire in 2 hours)
--   * `webhook_subscription_id` — Calendly returns this when we subscribe
--   * `webhook_signing_key` — used to verify incoming webhook HMAC sigs
--   * `selected_event_type_uri` / `selected_event_type_name` — which of the
--     connected user's event types HRHandle will send candidates to
--   * `external_user_uri` — the Calendly user URI; needed for webhook
--     subscription scope and matching incoming webhooks back to integrations
--
-- These fields are all NULLable so existing LinkedIn rows are unaffected.
--
-- Apply in Supabase: Dashboard → SQL Editor → run this file on BOTH the
-- staging (quotchdymcnjlnwtjmgu) and production (fnpyfwhvgzoxgyjafbsg)
-- projects. Safe to re-run.

ALTER TABLE public.organization_integrations
  ADD COLUMN IF NOT EXISTS refresh_token           TEXT,
  ADD COLUMN IF NOT EXISTS webhook_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS webhook_signing_key     TEXT,
  ADD COLUMN IF NOT EXISTS selected_event_type_uri  TEXT,
  ADD COLUMN IF NOT EXISTS selected_event_type_name TEXT,
  ADD COLUMN IF NOT EXISTS external_user_uri        TEXT;

CREATE INDEX IF NOT EXISTS idx_org_integrations_external_user
  ON public.organization_integrations(external_user_uri)
  WHERE external_user_uri IS NOT NULL AND is_active = TRUE;
