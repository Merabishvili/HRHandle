-- ============================================================================
-- HRHandle — RESET DATA (clean slate for testing) — REUSABLE (any project)
-- ============================================================================
--  Wipes every organization, user, candidate, vacancy, application,
--  subscription, payment order, note, interview, support ticket, pipeline
--  stage + Main-pipeline template, etc. The wipe is DYNAMIC — it truncates
--  every `public` table except the global lookups below — so tables added by
--  later migrations (e.g. support_tickets, pipeline_stages,
--  org_pipeline_stage_templates) are cleared automatically, no edits needed.
--  Keeps the global lookup tables (sectors + the status tables) so a fresh
--  signup still works. All per-org defaults are recreated on the next signup:
--  runOnboarding() reseeds the org's Main pipeline + rejection defaults, and
--  seed_default_pipeline_stages() clones it onto each new vacancy.
--
--  ⚠️  IRREVERSIBLE. Works on WHATEVER project the SQL Editor is connected to —
--      staging OR production. There is no hard-coded target here, so the safety
--      is a two-step, dry-run-by-default flow:
--
--   STEP 1 — DRY RUN (default): run this file AS-IS. It changes nothing (ends
--            in ROLLBACK) but prints, in the "Messages"/NOTICE output, the
--            counts + the org names it WOULD delete. Read them: do you
--            recognise this as the project you meant to wipe?
--
--   STEP 2 — APPLY: only when you are sure, change the final `ROLLBACK;` on the
--            last line to `COMMIT;` and run again.
--
--  STORAGE: cleared separately (Supabase blocks DELETE on storage.objects from
--  SQL) — run the companion script with the matching local env file:
--    Staging:     node --env-file=.env.local           scripts/reset-storage.mjs --confirm quotchdymcnjlnwtjmgu
--    Production:  node --env-file=.env.production.local scripts/reset-storage.mjs --confirm fnpyfwhvgzoxgyjafbsg
-- ============================================================================

BEGIN;

-- ── 0) TARGET CHECK — surfaced via NOTICE so it shows even on ROLLBACK ───────
DO $$
DECLARE
  r record;
BEGIN
  RAISE NOTICE '=========================================================';
  RAISE NOTICE ' TARGET CHECK — you are about to wipe THIS database:';
  RAISE NOTICE '   current_database = %', current_database();
  RAISE NOTICE '   auth.users       = %', (SELECT count(*) FROM auth.users);
  RAISE NOTICE '   organizations    = %', (SELECT count(*) FROM public.organizations);
  RAISE NOTICE '   candidates       = %', (SELECT count(*) FROM public.candidates);
  RAISE NOTICE '   vacancies        = %', (SELECT count(*) FROM public.vacancies);
  RAISE NOTICE ' Organizations present (first 20) — recognise this project?';
  FOR r IN
    SELECT name FROM public.organizations ORDER BY created_at LIMIT 20
  LOOP
    RAISE NOTICE '   org: %', r.name;
  END LOOP;
  RAISE NOTICE '=========================================================';
END $$;

-- ── 1) Wipe all application data ────────────────────────────────────────────
-- Dynamically truncates every table in `public` EXCEPT the global lookups in
-- `keep`. CASCADE + RESTART IDENTITY clears child tables and resets sequences.
DO $$
DECLARE
  keep text[] := ARRAY[
    'sectors',
    'vacancy_statuses',
    'candidate_statuses',
    'application_statuses'
  ];
  tbls text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
    INTO tbls
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename <> ALL (keep);

  IF tbls IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE ' || tbls || ' RESTART IDENTITY CASCADE';
  END IF;
END $$;

-- ── 2) Remove all auth users ────────────────────────────────────────────────
-- Cascades to auth.identities / sessions / refresh_tokens / mfa_factors.
DELETE FROM auth.users;

-- Storage files are cleared separately — see the STORAGE note in the header.

-- ── 3) COMMIT or ROLLBACK ───────────────────────────────────────────────────
-- Default is ROLLBACK (dry run). Change to COMMIT to actually wipe.
ROLLBACK;
-- COMMIT;
