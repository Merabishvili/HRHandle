-- Add reason_id to rejection_templates so each template can be linked to a rejection reason
ALTER TABLE rejection_templates
  ADD COLUMN IF NOT EXISTS reason_id UUID REFERENCES rejection_reasons(id) ON DELETE SET NULL;

-- Add rejection tracking columns to applications
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS rejection_reason_id UUID REFERENCES rejection_reasons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_template_id UUID REFERENCES rejection_templates(id) ON DELETE SET NULL;

-- Seed a default rejection template linked to the "General" reason
-- for orgs that already have a "General" reason but no templates yet
INSERT INTO rejection_templates (organization_id, name, subject, body, sort_order, reason_id)
SELECT
  rr.organization_id,
  'General',
  'An update from {{company}} — {{role}}',
  'After careful consideration, we have decided to move forward with other candidates whose experience more closely matches our current needs. We encourage you to apply for future opportunities that match your background.',
  0,
  rr.id
FROM rejection_reasons rr
WHERE rr.name = 'General'
  AND NOT EXISTS (
    SELECT 1 FROM rejection_templates rt
    WHERE rt.organization_id = rr.organization_id
  );
