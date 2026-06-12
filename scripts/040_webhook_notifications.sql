-- Migration 040: webhook_notifications table (G-030, Phase 5.1)
--
-- Stores Slack + Microsoft Teams incoming-webhook URLs per organisation so
-- HRHandle can POST notifications when meaningful events happen (new
-- application, hire, offer accepted/declined, candidate withdrew, etc.).
--
-- An org can have multiple webhooks (e.g., one to #hiring, another to a
-- leadership channel) with different event subscriptions on each.
-- `webhook_url` is treated as a secret with the same risk model as the
-- existing `organization_integrations.access_token` field.
--
-- Apply in Supabase: Dashboard → SQL Editor → run this file on BOTH the
-- staging (quotchdymcnjlnwtjmgu) and production (fnpyfwhvgzoxgyjafbsg)
-- projects. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.webhook_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_type    TEXT NOT NULL CHECK (channel_type IN ('slack', 'teams')),
  webhook_url     TEXT NOT NULL,
  name            TEXT NOT NULL,
  enabled_events  TEXT[] NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_notifications_org
  ON public.webhook_notifications(organization_id)
  WHERE is_active = TRUE;

ALTER TABLE public.webhook_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read webhook_notifications" ON public.webhook_notifications;
CREATE POLICY "Org members can read webhook_notifications"
  ON public.webhook_notifications FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Org admins can manage webhook_notifications" ON public.webhook_notifications;
CREATE POLICY "Org admins can manage webhook_notifications"
  ON public.webhook_notifications FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles
     WHERE id = auth.uid() AND role IN ('owner', 'admin')
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.profiles
     WHERE id = auth.uid() AND role IN ('owner', 'admin')
  ));
