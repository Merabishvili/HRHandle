-- #8.2 — Surface stage-change and offer-lifecycle events in the candidate
-- Activity feed.
--
-- `candidate_activity` is a VIEW (defined in 20260515_candidate_profile_fields)
-- that unions applications / notes / documents / interviews. It never included
-- stage changes or offer events, so those never appeared in the per-candidate
-- Activity feed even though they're logged in `activity_log`.
--
-- This recreates the view with two extra UNION branches sourced from
-- `activity_log` (which already records `status_changed` on applications and
-- `offer_sent` / `offer_accepted` / `offer_declined` / `offer_withdrawn` on
-- offers). Column list + order are unchanged so CREATE OR REPLACE is safe.
--
-- Apply on BOTH Supabase projects (staging + production).

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
  WHERE i.organization_id IS NOT NULL

UNION ALL

  -- Stage changes (from the audit log). `details` carries the candidate id and
  -- the message is "<from> → <to>".
  SELECT
    al.id,
    (al.details->>'candidate_id')::uuid         AS candidate_id,
    al.organization_id,
    'stage'                                      AS kind,
    upper(left(al.message, 1)) || right(al.message, -1) AS headline,
    NULL::TEXT                                   AS body,
    NULL::TEXT                                   AS meta,
    p.full_name                                  AS actor_name,
    al.created_at
  FROM activity_log al
  LEFT JOIN profiles p ON p.id = al.user_id
  WHERE al.action = 'status_changed'
    AND al.entity_type = 'application'
    AND al.details ? 'candidate_id'

UNION ALL

  -- Offer lifecycle events (from the audit log). `details` carries the
  -- application id; join to reach the candidate. Excludes 'offer_created'
  -- (a draft that never reached the candidate).
  SELECT
    al.id,
    a.candidate_id,
    al.organization_id,
    'offer'                                      AS kind,
    upper(left(al.message, 1)) || right(al.message, -1) AS headline,
    NULL::TEXT                                   AS body,
    NULL::TEXT                                   AS meta,
    p.full_name                                  AS actor_name,
    al.created_at
  FROM activity_log al
  JOIN applications a
    ON a.id = (al.details->>'application_id')::uuid
   AND a.deleted_at IS NULL
  LEFT JOIN profiles p ON p.id = al.user_id
  WHERE al.entity_type = 'offer'
    AND al.action IN ('offer_sent', 'offer_accepted', 'offer_declined', 'offer_withdrawn')
    AND al.details ? 'application_id';

-- Preserve the security_invoker wrapper (RLS on the base tables applies).
ALTER VIEW candidate_activity SET (security_invoker = true);
