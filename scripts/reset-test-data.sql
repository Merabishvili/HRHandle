-- ============================================================================
-- reset-test-data.sql  —  DESTRUCTIVE test-data reset for HRHandle
-- ============================================================================
-- Wipes ALL tenant data (organizations, profiles, candidates, vacancies,
-- interviews, applications, notes, custom fields, etc.) and ALL auth users, so
-- you can test the app from a clean slate.
--
-- PRESERVES the global lookup tables the app needs to function:
--     sectors, candidate_statuses, application_statuses, vacancy_statuses
-- (Wiping those would break status pipelines and the sector dropdown.)
--
-- ⚠️  IRREVERSIBLE.  ⚠️  staging and production are SEPARATE databases — run it
--     in each one separately, and double-check which project you're in first.
--
-- HOW TO RUN  (Supabase Dashboard -> SQL Editor):
--   1. Confirm the project name (top-left switcher) is the one you intend.
--   2. Run STEP 1 to preview the row counts that will be deleted.
--   3. Run STEP 2. By default it is a SAFE DRY RUN — it ends in ROLLBACK and
--      changes NOTHING.
--   4. When you're sure, change the final `rollback;` to `commit;` and re-run.
-- ============================================================================


-- ─── STEP 1 — PREVIEW (read-only, always safe) ──────────────────────────────
select 'auth.users'                     as scope, count(*) from auth.users
union all select 'organizations',  count(*) from public.organizations
union all select 'profiles',       count(*) from public.profiles
union all select 'subscriptions',  count(*) from public.subscriptions
union all select 'candidates',     count(*) from public.candidates
union all select 'vacancies',      count(*) from public.vacancies
union all select 'applications',   count(*) from public.applications
union all select 'interviews',     count(*) from public.interviews
union all select 'storage: candidate-documents', count(*) from storage.objects where bucket_id = 'candidate-documents'
union all select 'storage: org-logos',            count(*) from storage.objects where bucket_id = 'org-logos'
order by scope;


-- ─── STEP 2 — RESET (destructive) ───────────────────────────────────────────
-- SAFE DEFAULT: this block ends in `rollback;`, so running it as-is deletes
-- NOTHING. When you are certain, change the final `rollback;` to `commit;`.
begin;

-- All tenant tables. CASCADE also catches any future org-scoped table that
-- isn't listed here yet, so this stays correct as the schema grows.
truncate table
  public.activity_log,
  public.applications,
  public.candidate_documents,
  public.candidate_education,
  public.candidate_evaluation_answers,
  public.candidate_evaluations,
  public.candidate_experience,
  public.candidate_notes,
  public.candidates,
  public.custom_field_groups,
  public.custom_field_values,
  public.custom_fields,
  public.email_templates,
  public.interviews,
  public.notifications,
  public.organization_integrations,
  public.profiles,
  public.rejection_reasons,
  public.rejection_templates,
  public.subscriptions,
  public.team_invitations,
  public.vacancies,
  public.vacancy_questions,
  public.organizations
  restart identity cascade;

-- All auth accounts (cascades to auth.identities / sessions / refresh tokens).
delete from auth.users;

-- (Optional) remove uploaded-file RECORDS too. NOTE: this clears rows in
-- storage.objects but can leave the underlying files in the storage backend.
-- For a complete file wipe, empty the buckets in Dashboard -> Storage instead.
-- delete from storage.objects where bucket_id in ('candidate-documents', 'org-logos');

rollback;  -- ⬅️  CHANGE TO  commit;  TO ACTUALLY APPLY THE RESET
-- ============================================================================
