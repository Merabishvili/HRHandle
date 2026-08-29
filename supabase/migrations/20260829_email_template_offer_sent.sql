-- =====================================================================
-- Allow the 'offer_sent' email template type
-- =====================================================================
--
-- The offer process added an `offer_sent` email template to the app
-- (lib/email-template-utils.ts TemplateType + the Settings → Email
-- templates "Offer sent" tab), but the `email_templates_template_type_check`
-- CHECK constraint was never extended past the status-change types
-- (script 034). Saving the Offer-sent template therefore failed with a
-- constraint violation → "Failed to save email template. Please try again."
--
-- Recreate the CHECK with the full current set (the 5 prior types + the
-- new offer_sent). Idempotent. Apply on BOTH Supabase projects.

ALTER TABLE public.email_templates
  DROP CONSTRAINT IF EXISTS email_templates_template_type_check;

ALTER TABLE public.email_templates
  ADD CONSTRAINT email_templates_template_type_check
  CHECK (template_type IN (
    'application_received',
    'interview_invitation',
    'rejection',
    'status_change_screening',
    'status_change_interview',
    'offer_sent'
  ));
