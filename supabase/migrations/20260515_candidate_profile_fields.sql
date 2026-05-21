-- Add new profile fields to candidates table
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS location          TEXT,
  ADD COLUMN IF NOT EXISTS timezone          TEXT,
  ADD COLUMN IF NOT EXISTS languages         TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS salary_expectation TEXT,
  ADD COLUMN IF NOT EXISTS notice_period      TEXT;

-- Unified activity view for the candidate detail page
-- Merges: notes, document uploads, interview events, applications
CREATE OR REPLACE VIEW candidate_activity AS

  -- Applications
  SELECT
    a.id                                        AS id,
    a.candidate_id,
    a.organization_id,
    'application'                               AS kind,
    'Applied to ' || v.title                    AS headline,
    NULL::TEXT                                  AS body,
    NULL::TEXT                                  AS meta,
    p.full_name                                 AS actor_name,
    a.created_at
  FROM applications a
  LEFT JOIN vacancies        v ON v.id = a.vacancy_id
  LEFT JOIN profiles         p ON p.id = a.created_by
  WHERE a.deleted_at IS NULL

UNION ALL

  -- Notes
  SELECT
    n.id,
    n.candidate_id,
    n.organization_id,
    'note'                                      AS kind,
    'Note added'                                AS headline,
    n.note_text                                 AS body,
    NULL::TEXT                                  AS meta,
    p.full_name                                 AS actor_name,
    n.created_at
  FROM candidate_notes n
  LEFT JOIN profiles p ON p.id = n.created_by
  WHERE n.deleted_at IS NULL

UNION ALL

  -- Document uploads
  SELECT
    d.id,
    d.candidate_id,
    d.organization_id,
    'document'                                  AS kind,
    'Document uploaded: ' || d.file_name        AS headline,
    NULL::TEXT                                  AS body,
    d.document_type                             AS meta,
    p.full_name                                 AS actor_name,
    d.created_at
  FROM candidate_documents d
  LEFT JOIN profiles p ON p.id = d.uploaded_by
  WHERE d.deleted_at IS NULL

UNION ALL

  -- Interviews
  SELECT
    i.id,
    i.candidate_id,
    i.organization_id,
    'interview'                                 AS kind,
    initcap(i.type) || ' interview scheduled'   AS headline,
    NULL::TEXT                                  AS body,
    to_char(i.scheduled_at AT TIME ZONE 'UTC', 'Mon DD, YYYY · HH12:MI AM') AS meta,
    p.full_name                                 AS actor_name,
    i.created_at
  FROM interviews i
  LEFT JOIN profiles p ON p.id = i.interviewer_id
  WHERE i.organization_id IS NOT NULL;

-- RLS: restrict to own org (views inherit underlying table RLS,
-- but we add a security_invoker wrapper for clarity)
ALTER VIEW candidate_activity SET (security_invoker = true);
