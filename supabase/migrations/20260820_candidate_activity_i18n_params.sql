-- #2 — Localize the candidate Activity feed.
--
-- `candidate_activity` composed its English `headline`/`meta` in SQL at read
-- time (e.g. 'Applied to ' || v.title), so the feed always rendered in English
-- regardless of the recruiter's UI language. We can't translate a pre-baked
-- string in the app, so this appends a structured `params` JSONB carrying the
-- raw pieces each row needs; the client renderer (lib/candidates/activity-i18n)
-- rebuilds a localized headline from `kind` + `params`, falling back to the
-- stored English `headline` when `params` is absent (pre-migration safety).
--
-- CREATE OR REPLACE only appends `params` to the end of the existing column
-- list (same names/types/order before it), so it's a safe in-place swap.
-- The English `headline`/`meta` columns are kept as the graceful fallback.
--
-- stage/offer rows reuse the audit-log localizer: params carries the audit
-- `action` + `details` so lib/audit-log/message-i18n can reconstruct the phrase
-- ("Screening → Interview", "Offer sent to candidate") in the active locale.
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
    a.created_at,
    jsonb_build_object('title', v.title)        AS params
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
    n.created_at,
    '{}'::jsonb                                 AS params
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
    d.created_at,
    jsonb_build_object('file', d.file_name, 'docType', d.document_type) AS params
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
    i.created_at,
    jsonb_build_object('type', i.type, 'at', i.scheduled_at) AS params
  FROM interviews i
  LEFT JOIN profiles p ON p.id = i.interviewer_id
  WHERE i.organization_id IS NOT NULL

UNION ALL

  -- Stage changes (from the audit log). `details` carries the candidate id and
  -- before/after stage codes; the localizer rebuilds "<from> → <to>".
  SELECT
    al.id,
    (al.details->>'candidate_id')::uuid         AS candidate_id,
    al.organization_id,
    'stage'                                      AS kind,
    upper(left(al.message, 1)) || right(al.message, -1) AS headline,
    NULL::TEXT                                   AS body,
    NULL::TEXT                                   AS meta,
    p.full_name                                  AS actor_name,
    al.created_at,
    jsonb_build_object('audit', true, 'action', al.action, 'entity_type', al.entity_type, 'details', al.details) AS params
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
    al.created_at,
    jsonb_build_object('audit', true, 'action', al.action, 'entity_type', 'offer', 'details', al.details) AS params
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
