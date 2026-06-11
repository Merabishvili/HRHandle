-- Migration 034: Auto-emails on application status change (G-017)
--
-- Phase 2 of the candidate-facing experience work. Adds an `is_enabled` toggle
-- to email_templates so admins can disable specific transactional emails per
-- template type, and extends the template_type CHECK to allow two new
-- status-change types that fire when an application moves to "screening" or
-- "interview". The existing three template types (application_received,
-- interview_invitation, rejection) keep their behaviour exactly — `is_enabled`
-- defaults to TRUE so silent rows continue to send.
--
-- The new types are opt-IN by row presence: with no row, no email is sent,
-- which preserves the pre-migration behaviour for all existing customers.
-- An admin opts in via /settings/email-templates by toggling the switch,
-- which writes a row with is_enabled = TRUE.
--
-- Apply in Supabase: Dashboard → SQL Editor → run this file on BOTH the
-- staging (quotchdymcnjlnwtjmgu) and production (fnpyfwhvgzoxgyjafbsg)
-- projects. Safe to re-run (column existence check + constraint drop/add).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'email_templates'
      AND column_name  = 'is_enabled'
  ) THEN
    ALTER TABLE public.email_templates
      ADD COLUMN is_enabled BOOLEAN NOT NULL DEFAULT TRUE;

    RAISE NOTICE 'Added is_enabled to email_templates.';
  ELSE
    RAISE NOTICE 'is_enabled already exists on email_templates, skipping.';
  END IF;
END
$$;

-- Drop the original CHECK constraint and recreate with the two new template
-- types added. Constraint name from migration 015's implicit naming —
-- Postgres assigns `<table>_<column>_check` when no name is given.
ALTER TABLE public.email_templates
  DROP CONSTRAINT IF EXISTS email_templates_template_type_check;

ALTER TABLE public.email_templates
  ADD CONSTRAINT email_templates_template_type_check
  CHECK (template_type IN (
    'application_received',
    'interview_invitation',
    'rejection',
    'status_change_screening',
    'status_change_interview'
  ));
