-- ============================================================================
-- reset-test-data.sql  —  DESTRUCTIVE test-data reset for HRHandle
-- ============================================================================
-- Wipes ALL tenant data (organizations, profiles, candidates, vacancies,
-- interviews, applications, offers, notes, custom fields, pipeline stages,
-- saved views, integrations, notifications, …) and ALL auth users, so you can
-- test the app from a clean slate (fresh sign-up → onboarding → 7-day trial).
--
-- PRESERVES the four global lookup tables the app needs to function:
--     sectors, candidate_statuses, application_statuses, vacancy_statuses
-- (Wiping those would break the status pipelines and the sector dropdown.)
-- New per-org pipeline stages are re-created on demand by the
-- seed_default_pipeline_stages() function, so nothing else needs re-seeding.
--
-- ⚠️  IRREVERSIBLE.  ⚠️
-- ⚠️  staging and production are SEPARATE Supabase projects. Run this ONLY on
--     staging (project ref quotchdymcnjlnwtjmgu). Never on production
--     (fnpyfwhvgzoxgyjafbsg). Confirm the project in the dashboard switcher.
--
-- HOW TO RUN  (Supabase Dashboard → SQL Editor):
--   1. Confirm the project name (top-left switcher) is HRHandle **staging**.
--   2. Run STEP 0 — it lists the most recent orgs so you can confirm it's
--      test data (and not a real customer org) before wiping.
--   3. Run STEP 1 to preview the row counts that will be deleted.
--   4. Run STEP 2. By default it is a SAFE DRY RUN — it ends in ROLLBACK and
--      changes NOTHING (it still surfaces any error, so you know it'd work).
--   5. When you're sure, change the final `rollback;` to `commit;` and re-run.
--
-- Table list verified against the live staging schema on 2026-06-26 (38 public
-- tables: 33 tenant + 4 lookups preserved + the candidate_activity view, which
-- is cleared automatically when its base tables are truncated).
-- ============================================================================


-- ─── STEP 0 — IDENTITY CHECK (read-only, always safe) ───────────────────────
-- Postgres can't see the Supabase project ref, so this can't auto-detect prod.
-- The real guard is you: confirm the dashboard switcher reads HRHandle
-- staging, and that the most-recently-created org below is test data you are
-- happy to destroy. If you see a real customer org here, STOP.
select name, created_at
from public.organizations
order by created_at desc
limit 5;


-- ─── STEP 1 — PREVIEW (read-only, always safe) ──────────────────────────────
select 'auth.users'      as scope, count(*) from auth.users
union all select 'organizations',   count(*) from public.organizations
union all select 'profiles',        count(*) from public.profiles
union all select 'subscriptions',   count(*) from public.subscriptions
union all select 'candidates',      count(*) from public.candidates
union all select 'vacancies',       count(*) from public.vacancies
union all select 'applications',    count(*) from public.applications
union all select 'interviews',      count(*) from public.interviews
union all select 'offers',          count(*) from public.offers
union all select 'pipeline_stages', count(*) from public.pipeline_stages
union all select 'notifications',   count(*) from public.notifications
union all select 'storage: candidate-documents', count(*) from storage.objects where bucket_id = 'candidate-documents'
union all select 'storage: org-logos',           count(*) from storage.objects where bucket_id = 'org-logos'
order by scope;


-- ─── STEP 2 — RESET (destructive) ───────────────────────────────────────────
-- SAFE DEFAULT: this block ends in `rollback;`, so running it as-is deletes
-- NOTHING. When you are certain, change the final `rollback;` to `commit;`.
begin;

-- Every tenant table. `restart identity` resets sequences; `cascade` also
-- catches any future org-scoped child table not yet listed here, so the wipe
-- stays correct as the schema grows. Order is irrelevant under CASCADE.
truncate table
  public.activity_log,
  public.application_screening_answers,
  public.applications,
  public.candidate_documents,
  public.candidate_education,
  public.candidate_evaluation_answers,
  public.candidate_evaluations,
  public.candidate_experience,
  public.candidate_merges,
  public.candidate_notes,
  public.candidates,
  public.custom_field_groups,
  public.custom_field_values,
  public.custom_fields,
  public.email_templates,
  public.interviews,
  public.mfa_recovery_codes,
  public.notifications,
  public.offers,
  public.org_pipeline_stage_templates,
  public.organization_integrations,
  public.pipeline_stages,
  public.profiles,
  public.rejection_reasons,
  public.rejection_templates,
  public.saved_views,
  public.subscriptions,
  public.team_invitations,
  public.vacancies,
  public.vacancy_questions,
  public.vacancy_screening_questions,
  public.webhook_notifications,
  public.organizations
  restart identity cascade;

-- All auth accounts. Every public table that references a user has just been
-- truncated above, so the only remaining references are auth-internal
-- (identities / sessions / refresh tokens / mfa factors) which delete via
-- their own ON DELETE CASCADE.
delete from auth.users;

-- NOTE on uploaded files: Supabase blocks direct DELETE on storage.objects
-- (a protect_delete trigger raises "Direct deletion from storage tables is not
-- allowed"), so it is intentionally NOT done here. The wiped DB rows leave the
-- candidate-documents / org-logos files orphaned but harmless for testing. To
-- also clear the binaries, empty those buckets via Dashboard → Storage, or run
-- the companion script:  node scripts/reset-storage.mjs   (uses the Storage API)

-- Preserved on purpose (DO NOT truncate): sectors, candidate_statuses,
-- application_statuses, vacancy_statuses.

rollback;  -- ⬅️  CHANGE TO  commit;  TO ACTUALLY APPLY THE RESET
-- ============================================================================
