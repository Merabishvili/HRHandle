-- Migration 051: drop applications.status_id — Wave 2.6 Slice 4
--
-- Closes out the pipeline_stages cutover started in Migration 046.
-- Sequence so far:
--   - 046: created `pipeline_stages` + seeder + cap-10 trigger.
--   - 047: scorecard `vacancy_questions.must_have` (parallel Wave 2.5).
--   - 048: screening questions (parallel Wave 2.5).
--   - 049: added `applications.pipeline_stage_id` + backfilled it
--          from the legacy status_id; every writer dual-wrote both
--          columns through Slices 1, 2a, 2b, 3.
--   - 050: scorecard scale 1→5 (parallel Wave 2.5 fidelity fix).
--   - 051 (this): drops the legacy status_id column now that no
--          reader or writer in the app still touches it.
--
-- Slice 2c + 4 (this slice) made the following code-level changes
-- before this migration:
--   - All application writers (createCandidate linked path,
--     createApplication, updateApplicationStatus, rejectApplication,
--     withdrawApplicationByToken, submitPublicApplication, offers
--     accept-hire) now write pipeline_stage_id only.
--   - All readers (candidate detail page, reports queries, export,
--     /pipeline page, /vacancies/[id]/pipeline page,
--     moveApplicationsBatch skip-detection) bucket-map via
--     pipeline_stages.
--   - Application type + Zod schema have status_id removed.
--
-- The application_statuses table itself stays — it's still the
-- canonical lookup for code→display-name (used by the wizard's
-- starting-stage picker, the cross-vacancy board's column model, and
-- the rejection dialog handoff). Only the column on `applications`
-- is gone.
--
-- Idempotent — `DROP COLUMN IF EXISTS` makes re-runs a no-op.

-- ── 1. Drop triggers that reference status_id ───────────────────────
-- Migration 022 added `trg_sync_candidate_status` (sets candidate to
-- inactive when all their apps are in a closed bucket) and a sibling
-- `trg_sync_candidate_hired_status` was added later (syncs candidate
-- general_status_id to hired when an app moves into the hired stage).
-- Both fire on UPDATE OF status_id and join application_statuses to
-- read the code, so they hard-depend on the column.
--
-- The candidate-status sync that mattered for active/hired is now
-- handled by the app-level code:
--   - updateApplicationStatus sets candidate to hired on the move into
--     hired, and reverts to active when the only hired app moves away.
--   - rejectApplication preserves the same logic on rejection paths.
--   - offers.ts accept-hire keeps candidate.general_status_id in sync
--     when an offer is accepted via the public token.
--
-- The "mark inactive when ALL apps are closed" behaviour from Migration
-- 022 is not duplicated in app code — this is a tiny UX regression for
-- the candidates index (a candidate with only closed apps stays "active"
-- instead of falling to "inactive"). Tracked in tech-debt for a future
-- recreate-on-pipeline_stage_id if it proves to matter.
DROP TRIGGER IF EXISTS trg_sync_candidate_status ON public.applications;
DROP TRIGGER IF EXISTS trg_sync_candidate_hired_status ON public.applications;

-- ── 2. Drop the FK constraint (if any) before the column ──────────────
-- Original constraint was added in the early applications schema; the
-- name was the PostgreSQL default `applications_status_id_fkey`. Guard
-- with IF EXISTS so re-runs and schemas without the explicit FK don't
-- error.
ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_status_id_fkey;

-- ── 3. Drop any index on status_id ────────────────────────────────────
DROP INDEX IF EXISTS public.idx_applications_status;
DROP INDEX IF EXISTS public.applications_status_id_idx;

-- ── 4. Drop the column ────────────────────────────────────────────────
ALTER TABLE public.applications
  DROP COLUMN IF EXISTS status_id;
