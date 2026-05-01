-- Add long_text and date field types to custom_fields
ALTER TABLE public.custom_fields
  DROP CONSTRAINT IF EXISTS custom_fields_field_type_check;

ALTER TABLE public.custom_fields
  ADD CONSTRAINT custom_fields_field_type_check
  CHECK (field_type IN ('text', 'number', 'dropdown', 'checkbox', 'long_text', 'date'));
