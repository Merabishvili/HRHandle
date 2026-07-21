# Database Schema

_Last updated: 2026-07-20_

> **Reconciliation status (2026-07-22 audit).** The live **staging** schema (36 public tables) was pulled via the Supabase Management API and reconciled: **all 6 previously-undocumented tables now have sections** (`offers`, `webhook_notifications`, `pipeline_stages`, `org_pipeline_stage_templates`, `vacancy_screening_questions`, `application_screening_answers`, `candidate_merges`, `mfa_recovery_codes`) and `candidate_evaluations` gained its reviewer + scorecard-sharing columns. **No documented section maps to a dropped table.** The *original* per-table sections (candidates/vacancies/applications/etc.) were not re-diffed column-by-column against live in this pass — trust the live schema on any specific column dispute.

## Changelog

- 🆕 **2026-07 batch (`supabase/migrations/20260704_*`)**:
  - `vacancies.work_mode text` (`remote|hybrid|onsite|NULL`) — `20260704_vacancy_work_mode.sql`.
  - `profiles.language text` — `20260704_profile_language.sql`.
  - `candidate_evaluations` gains `reviewer_id` (FK `profiles`, ON DELETE SET NULL) + `submitted boolean` for the multi-reviewer scorecard; `UNIQUE(application_id, reviewer_id)`; recommendation CHECK widened to `strong_yes|yes|lean_no|no` — `20260704_scorecard_multi_reviewer.sql`.
  - `avatars` public Storage bucket (2 MB, jpg/png/webp) — `20260704_avatars_bucket.sql`.
  - `candidate_activity` view rebuilt to also union **stage-change** + **offer** events — `20260704_candidate_activity_stage_offer_events.sql`.
  - Default meeting provider field — `20260704_default_meeting_provider.sql`.
  - ❌ `saved_views` table dropped — `20260704_drop_saved_views.sql`.
  - ❌ `vacancies.interview_questions` column dropped — `20260704_drop_vacancy_interview_questions.sql`.
- 🆕 **Feature tables/columns added mid-2026 (documented in `docs/1-product/roadmap.md`, not all migrations in-repo):** `offers` table (G-018); per-vacancy `pipeline_stages` + `applications.pipeline_stage_id` with `applications.status_id` **dropped** (Wave 2.6, Migration 051); `applications.source_type` DEFAULT `'manual'` (G-029, Migration 039); `webhook_notifications` table + Calendly fields on `organization_integrations` (G-030/G-031, Migrations 040/041); `organizations.require_mfa` + `require_mfa_for_admins` + `profiles.mfa_enrolled` (G-032, Migration 042); `profiles.notification_preferences jsonb` (Migration 045); custom-fields tables.

- 🔄 (2026-05-23) `activity_log` table is now actively written to via `lib/audit-log.ts` (helper added). Wired call sites: vacancy status change, application status change, LinkedIn integration connect/disconnect. The table itself was always present in the schema (`001_create_schema.sql`) but had zero writers and zero rows until this change.
- 🆕 `candidate_experience` table — work history (migration `20260514_candidate_background.sql`). RLS enabled.
- 🆕 `candidate_education` table — education history (migration `20260514_candidate_background.sql`). RLS enabled.
- 🆕 `organization_integrations` table — third-party platform credential storage, currently scoped to `platform = 'linkedin'` (migration `20260517_organization_integrations.sql`). RLS enabled.
- 🆕 `candidates` columns added (migration `20260515_candidate_profile_fields.sql`): `location`, `timezone`, `languages text[]`, `salary_expectation`, `notice_period`.
- 🔄 `candidate_activity` view rebuilt with **breaking column rename**: `type` → `kind`, `title` → `headline`. Queries that read the old names will return no rows (silent, not an error). Search & replace required in any direct view consumers.
- 🔄 (revised 2026-05-08) Live-DB verification via Supabase MCP confirms **every public table has RLS enabled with at least one policy** (`vacancies`, `candidates`, `applications` each have 4 policies; `profiles` has 6). An earlier audit pass incorrectly claimed RLS was missing on most tables because the original RLS migration is not in the repo's `supabase/migrations/` folder — only newer additive migrations are. The RLS itself is live in the DB. See `docs/issues-found.md` retraction of `S-004`.

---

## Multi-Tenant Isolation

Every tenant (organization) is identified by `organization_id` (UUID). All tenant data tables include a NOT NULL `organization_id` column. Row Level Security (RLS) on all tables filters rows by `organization_id`, preventing cross-tenant data access. The admin client (`SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS and is only used server-side for privileged operations (onboarding, document storage, notifications, invitation management).

## Soft Delete Pattern

Many tables use a `deleted_at` (timestamptz) column instead of physical deletes. Records are excluded from queries with `.is('deleted_at', null)`. Soft-deleted tables: `applications`, `candidate_documents`, `candidate_notes`, `candidates`, `custom_fields`, `vacancies`.

## Global Lookup Tables vs Tenant Tables

**Global lookup tables** (no `organization_id`, shared across all orgs):
- `application_statuses` — pipeline stages: applied, screening, interview, offer, hired, rejected
- `candidate_statuses` — general candidate states: active, hired, archived
- `vacancy_statuses` — job states: draft, open, on_hold, closed, archived
- `sectors` — industry sectors for vacancies

**Tenant tables** (scoped by `organization_id`):
All other tables.

---

## Table Definitions

### `activity_log`
Audit trail for significant events within an organization.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| organization_id | uuid | NOT NULL | — | FK → organizations |
| user_id | uuid | NULL | — | FK → profiles |
| entity_type | text | NOT NULL | — | e.g. 'vacancy', 'candidate' |
| entity_id | uuid | NULL | — | |
| action | text | NOT NULL | — | e.g. 'created', 'updated' |
| message | text | NULL | — | |
| details | jsonb | NULL | — | |
| created_at | timestamptz | NULL | now() | |

---

### `application_statuses`
Global lookup. Pipeline stages for applications.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| name | text | NOT NULL | — | Display name |
| code | text | NOT NULL | — | e.g. 'applied', 'screening', 'interview', 'offer', 'hired', 'rejected' |
| is_active | bool | NULL | true | |
| sort_order | int | NULL | 0 | |

---

### `applications`
Links a candidate to a vacancy. Tracks pipeline status.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| organization_id | uuid | NOT NULL | — | FK → organizations |
| candidate_id | uuid | NOT NULL | — | FK → candidates |
| vacancy_id | uuid | NOT NULL | — | FK → vacancies |
| pipeline_stage_id | uuid | NULL | — | 🔄 FK → `pipeline_stages` (per-vacancy). **Replaced `status_id`** (dropped in Wave 2.6, Migration 051); the canonical bucket is derived via `mapPipelineStageToBucket`. |
| applied_at | timestamptz | NULL | now() | |
| last_status_changed_at | timestamptz | NULL | — | |
| notes | text | NULL | — | max 2000 chars |
| created_by | uuid | NULL | — | FK → profiles |
| created_at | timestamptz | NULL | — | |
| updated_at | timestamptz | NULL | — | |
| deleted_at | timestamptz | NULL | — | Soft-delete |
| ip_address | text | NULL | — | From public apply form |
| source_type | text | NULL | 'internal' | 'internal' or 'public_form' |
| rejection_reason_id | uuid | NULL | — | FK → rejection_reasons |
| rejection_template_id | uuid | NULL | — | FK → rejection_templates |
| public_token | text | NULL | — | 🆕 candidate-facing `/status/<token>` credential (G-016) |

---

### `candidate_documents`
Files (CV, cover letter) attached to a candidate. Stored in Supabase Storage bucket `candidate-documents`.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| organization_id | uuid | NOT NULL | — | FK → organizations |
| candidate_id | uuid | NOT NULL | — | FK → candidates |
| document_type | text | NOT NULL | — | e.g. 'cv', 'cover_letter', 'other' |
| file_name | text | NOT NULL | — | Original filename |
| file_path | text | NOT NULL | — | Storage path: `{orgId}/{candidateId}/{uuid}.{ext}` |
| mime_type | text | NULL | — | e.g. 'application/pdf' |
| file_size_bytes | bigint | NULL | — | ⚠️ Duplicate — see note below |
| file_size | bigint | NULL | — | ⚠️ Duplicate — application code writes to this column |
| uploaded_by | uuid | NULL | — | FK → profiles; NULL for public form submissions |
| created_at | timestamptz | NULL | — | |
| deleted_at | timestamptz | NULL | — | Soft-delete |

**⚠️ Known issue:** Two size columns exist — `file_size_bytes` (schema definition) and `file_size` (used by application code). See `docs/issues-found.md` issue #1.

---

### `candidate_evaluation_answers`
Individual answers within a candidate evaluation.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| organization_id | uuid | NOT NULL | — | |
| evaluation_id | uuid | NOT NULL | — | FK → candidate_evaluations |
| question_id | uuid | NOT NULL | — | FK → vacancy_questions |
| text_value | text | NULL | — | For text-type questions |
| score_value | smallint | NULL | — | For score-type questions (1–10) |
| created_at | timestamptz | NULL | — | |
| updated_at | timestamptz | NULL | — | |

---

### `candidate_evaluations`
A scoring/evaluation record for a candidate's application.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| organization_id | uuid | NOT NULL | — | |
| application_id | uuid | NULL | — | FK → applications |
| candidate_id | uuid | NOT NULL | — | |
| vacancy_id | uuid | NOT NULL | — | |
| is_active | bool | NULL | true | |
| score | smallint | NULL | — | Overall percentage score (0–100) |
| reviewer_id | uuid | NULL | — | 🆕 FK → profiles (ON DELETE SET NULL). Multi-reviewer model — `20260704_scorecard_multi_reviewer.sql`. |
| submitted | bool | NOT NULL | false | 🆕 draft vs submitted card (anti-anchoring: others' cards revealed only after you submit). |
| recommendation | text | NULL | — | 🆕 `strong_yes\|yes\|lean_no\|no` (CHECK). |
| recommendation_reason | text | NULL | — | 🆕 free-text rationale. |
| scorecard_token | text | NULL | — | 🆕 token for the shared `/scorecard/<token>` page (G-025). |
| scorecard_revoked_at | timestamptz | NULL | — | 🆕 revokes a shared scorecard. |
| shared_by / shared_at | uuid / timestamptz | NULL | — | 🆕 who shared + when. |
| created_at | timestamptz | NULL | — | |
| updated_at | timestamptz | NULL | — | |

_🆕 Constraint: `UNIQUE(application_id, reviewer_id)` (was `UNIQUE(application_id)`) — one card per reviewer per application._

---

### `candidate_notes`
Free-text notes attached to a candidate by a team member.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| organization_id | uuid | NOT NULL | — | |
| candidate_id | uuid | NOT NULL | — | |
| note_text | text | NOT NULL | — | |
| created_by | uuid | NULL | — | FK → profiles |
| created_at | timestamptz | NULL | — | |
| updated_at | timestamptz | NULL | — | |
| deleted_at | timestamptz | NULL | — | Soft-delete |

---

### `candidate_activity` (view)
Read-only view unioning all activity events for a candidate. Used by the candidate details page activity feed. Security invoker so RLS on base tables is respected.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK of the source row |
| organization_id | uuid | |
| candidate_id | uuid | |
| kind | text | 🔄 (renamed from `type`) 'application', 'note', 'document', 'interview' |
| headline | text | 🔄 (renamed from `title`) Human-readable label (e.g. `"Applied to Senior Engineer"`, `"Interview scheduled"`) |
| body | text | 🆕 Long-form text (note body, etc.); null for most rows |
| meta | text | Type-specific payload (status name, file name, document type, etc.). Note: now `text` not `jsonb`. |
| actor_name | text | 🆕 Display name of the user who triggered the event |
| created_at | timestamptz | Used for feed ordering |

---

### `candidate_statuses`
Global lookup. General state of a candidate.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| name | text | NULL | — | Display name |
| code | text | NULL | — | 'active', 'hired', 'archived' |
| is_active | bool | NULL | true | |
| sort_order | int | NULL | 0 | |

---

### `candidates`
Core candidate record.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| organization_id | uuid | NOT NULL | — | FK → organizations |
| first_name | text | NOT NULL | — | max 100 |
| last_name | text | NOT NULL | — | max 100 |
| email | text | NULL | — | |
| phone | text | NULL | — | max 30 |
| location | text | NULL | — | max 200; city or region |
| timezone | text | NULL | — | max 100; e.g. 'Europe/London' |
| languages | text[] | NULL | '{}' | array of language names |
| salary_expectation | text | NULL | — | max 200; free-text range or amount |
| notice_period | text | NULL | — | max 100; e.g. '2 weeks', '1 month' |
| linkedin_profile_url | text | NULL | — | URL |
| source | text | NULL | — | max 100; 'Public Form' for web applicants |
| general_status_id | uuid | NULL | — | FK → candidate_statuses |
| created_by | uuid | NULL | — | FK → profiles |
| created_at | timestamptz | NULL | — | |
| updated_at | timestamptz | NULL | — | |
| deleted_at | timestamptz | NULL | — | Soft-delete |
| current_company | text | NULL | — | **deprecated** — still in DB for backward compat; not surfaced in edit form |
| current_position | text | NULL | — | **deprecated** — still in DB for backward compat; not surfaced in edit form |
| years_of_experience | numeric | NULL | — | **deprecated** — still in DB for backward compat; not surfaced in edit form |
| date_of_birth | date | NULL | — | **deprecated** — still in DB for backward compat; not surfaced in edit form |

---

### `candidate_education`
Education history for a candidate. Created by CV parsing or manual entry.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| organization_id | uuid | NOT NULL | — | FK → organizations (cascade delete) |
| candidate_id | uuid | NOT NULL | — | FK → candidates (cascade delete) |
| institution | text | NOT NULL | — | |
| degree | text | NULL | — | e.g. Bachelor's, Master's |
| field_of_study | text | NULL | — | |
| start_year | smallint | NULL | — | |
| end_year | smallint | NULL | — | |
| is_ongoing | boolean | NOT NULL | false | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

RLS: org members can manage their org's records.

---

### `candidate_experience`
Work experience entries for a candidate. Created by CV parsing or manual entry.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| organization_id | uuid | NOT NULL | — | FK → organizations (cascade delete) |
| candidate_id | uuid | NOT NULL | — | FK → candidates (cascade delete) |
| company | text | NOT NULL | — | |
| title | text | NOT NULL | — | |
| start_date | date | NULL | — | |
| end_date | date | NULL | — | |
| is_current | boolean | NOT NULL | false | |
| description | text | NULL | — | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

RLS: org members can manage their org's records.

---

### `custom_field_groups`
Groups of custom fields for an entity type.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| organization_id | uuid | NOT NULL | — | |
| entity_type | text | NOT NULL | — | 'candidate' or 'vacancy' |
| name | text | NOT NULL | — | max 100 |
| sort_order | int | NULL | 0 | |
| created_at | timestamptz | NULL | — | |

---

### `custom_field_values`
Stores the value for a custom field on a specific entity instance.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| organization_id | uuid | NOT NULL | — | |
| field_id | uuid | NOT NULL | — | FK → custom_fields |
| entity_id | uuid | NOT NULL | — | The candidate or vacancy UUID |
| value_text | text | NULL | — | For text/long_text/date fields |
| value_number | numeric | NULL | — | For number fields |
| value_boolean | boolean | NULL | — | For checkbox fields |
| value_option | text | NULL | — | For dropdown fields |
| created_at | timestamptz | NULL | — | |
| updated_at | timestamptz | NULL | — | |

Upserted with `onConflict: 'field_id,entity_id'`.

---

### `custom_fields`
Schema definition for a custom field.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| organization_id | uuid | NOT NULL | — | |
| group_id | uuid | NOT NULL | — | FK → custom_field_groups |
| name | text | NOT NULL | — | max 100 |
| field_type | text | NOT NULL | — | 'text', 'long_text', 'date', 'number', 'dropdown', 'checkbox' |
| is_required | bool | NULL | false | |
| options | jsonb | NULL | — | String array for dropdown fields |
| sort_order | int | NULL | 0 | |
| deleted_at | timestamptz | NULL | — | Soft-delete |
| created_at | timestamptz | NULL | — | |

Limit: 20 active custom fields per entity type per organization.

---

### `email_templates`
Per-organization overrides for transactional email subjects and bodies.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| organization_id | uuid | NOT NULL | — | |
| template_type | text | NOT NULL | — | 'application_received', 'interview_invitation', 'rejection' |
| subject | text | NOT NULL | — | May contain `{{variable}}` placeholders |
| body | text | NOT NULL | — | May contain `{{variable}}` placeholders |
| updated_at | timestamptz | NULL | — | |

---

### `interviews`
Scheduled interview between a candidate and a team member.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| organization_id | uuid | NOT NULL | — | |
| candidate_id | uuid | NOT NULL | — | |
| vacancy_id | uuid | NOT NULL | — | |
| application_id | uuid | NULL | — | FK → applications |
| interviewer_id | uuid | NULL | — | FK → profiles |
| scheduled_at | timestamptz | NOT NULL | — | Must be in the future |
| duration_minutes | int | NULL | 60 | 15–480 |
| type | text | NULL | 'video' | 'video', 'phone', 'onsite' |
| status | text | NULL | 'scheduled' | 'scheduled', 'completed', 'cancelled', 'no_show' |
| feedback | text | NULL | — | |
| rating | int | NULL | — | |
| created_at | timestamptz | NULL | — | |
| updated_at | timestamptz | NULL | — | |
| google_meet_link | text | NULL | — | Google Meet join URL |
| google_calendar_event_id | text | NULL | — | Google Calendar event ID for deletion |
| meeting_link | text | NULL | — | Zoom join URL or manual link |
| microsoft_calendar_event_id | text | NULL | — | Microsoft Calendar event ID for deletion |

---

### `notifications`
In-app notifications for team members.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| organization_id | uuid | NOT NULL | — | |
| recipient_id | uuid | NOT NULL | — | FK → profiles |
| type | text | NOT NULL | — | e.g. 'new_application', 'interview_scheduled' |
| title | text | NOT NULL | — | |
| body | text | NULL | — | |
| link | text | NULL | — | Internal path |
| read_at | timestamptz | NULL | — | NULL = unread |
| created_at | timestamptz | NULL | — | |

Last 50 notifications returned per user, ordered by `created_at` descending.

---

### `organizations`
The tenant record. One organization per account (no multi-org memberships).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| name | text | NOT NULL | — | max 200 |
| slug | text | NOT NULL | UNIQUE | URL-safe, includes user ID suffix for uniqueness |
| logo_url | text | NULL | — | |
| is_active | bool | NULL | true | |
| created_at | timestamptz | NULL | — | |
| updated_at | timestamptz | NULL | — | |
| public_page_token | uuid | NULL | gen_random_uuid() | Legacy UUID for old public job links |
| public_page_slug | text | NOT NULL | — | Human-readable slug for `/jobs/{slug}` |

---

### `organization_integrations` 🆕
Per-org credentials for third-party platforms. Currently only used for LinkedIn company-page metadata.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| organization_id | uuid | NOT NULL | — | FK → organizations (cascade delete) |
| platform | text | NOT NULL | — | CHECK constraint: must be `'linkedin'` |
| external_page_id | text | NULL | — | LinkedIn numeric company-page ID |
| external_page_name | text | NULL | — | Display name (when known) |
| access_token | text | NULL | — | Reserved for future OAuth — unused today |
| token_expires_at | timestamptz | NULL | — | Reserved for future OAuth — unused today |
| connected_by | uuid | NULL | — | FK → profiles (SET NULL on delete) |
| connected_at | timestamptz | NOT NULL | now() | |
| is_active | boolean | NOT NULL | true | |

**Constraints:** UNIQUE(`organization_id`, `platform`) — one row per platform per org.
**RLS:** `org_members_can_read_integrations` (SELECT) and `org_members_can_manage_integrations` (ALL). Both gate on caller's `profiles.organization_id`.

---

### `profiles`
One profile per `auth.users` row. Stores app-level user data and third-party OAuth tokens.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK; FK → auth.users |
| organization_id | uuid | NULL | — | FK → organizations; NULL until onboarding completes |
| full_name | text | NOT NULL | — | max 100 |
| email | text | NULL | — | |
| avatar_url | text | NULL | — | |
| phone | text | NULL | — | max 30 |
| role | text | NULL | 'owner' | 'owner', 'admin', 'member' |
| is_active | bool | NULL | true | |
| created_at | timestamptz | NULL | — | |
| updated_at | timestamptz | NULL | — | |
| column_preferences | jsonb | NULL | '{}' | User's column visibility settings |
| google_access_token | text | NULL | — | Encrypted at rest by Supabase |
| google_refresh_token | text | NULL | — | |
| google_token_expiry | bigint | NULL | — | Unix ms timestamp |
| zoom_access_token | text | NULL | — | |
| zoom_refresh_token | text | NULL | — | |
| zoom_token_expiry | bigint | NULL | — | Unix ms timestamp |
| microsoft_access_token | text | NULL | — | |
| microsoft_refresh_token | text | NULL | — | |
| microsoft_token_expiry | bigint | NULL | — | Unix ms timestamp |

---

### `rejection_reasons`
Named reasons an application was rejected (e.g. "Overqualified", "General").

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| organization_id | uuid | NOT NULL | — | |
| name | text | NOT NULL | — | |
| sort_order | int | NULL | 0 | |
| created_at | timestamptz | NULL | — | |

A default "General" reason is seeded during onboarding.

---

### `rejection_templates`
Email template for a specific rejection reason.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| organization_id | uuid | NOT NULL | — | |
| name | text | NOT NULL | — | |
| subject | text | NOT NULL | — | May contain `{{variable}}` placeholders |
| body | text | NOT NULL | — | May contain `{{variable}}` placeholders |
| sort_order | int | NULL | 0 | |
| created_at | timestamptz | NULL | — | |
| updated_at | timestamptz | NULL | — | |
| reason_id | uuid | NULL | — | FK → rejection_reasons |

A default template linked to the "General" reason is seeded during onboarding.

---

### `sectors`
Global lookup. Industry sectors.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| name | text | NULL | — | |
| code | text | NULL | — | |
| is_active | bool | NULL | true | |
| sort_order | int | NULL | 0 | |
| created_at | timestamptz | NULL | — | |

---

### `subscriptions`
Billing/plan state for an organization.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| organization_id | uuid | NOT NULL | — | |
| plan_code | text | NOT NULL | — | 'trial', 'individual', 'organization' |
| billing_cycle | text | NULL | — | 'monthly', 'annual' |
| status | text | NOT NULL | — | 'trial', 'active', 'past_due', 'expired', 'canceled' |
| trial_start_at | timestamptz | NULL | — | |
| trial_end_at | timestamptz | NULL | — | Trial lasts 7 days |
| current_period_start_at | timestamptz | NULL | — | |
| current_period_end_at | timestamptz | NULL | — | |
| next_billing_at | timestamptz | NULL | — | |
| payment_method_linked | bool | NULL | false | |
| payment_provider_customer_ref | text | NULL | — | LemonSqueezy customer ID (planned) |
| payment_provider_subscription_ref | text | NULL | — | LemonSqueezy subscription ID (planned) |
| last_payment_status | text | NULL | — | |
| vacancy_limit | int | NULL | 5 | 5 trial, 500 individual, 1000 org |
| candidate_limit | int | NULL | 100 | 100 trial, 10000 individual, 20000 org |
| member_limit | int | NULL | 2 | 2 trial, 3 individual, 50 org |
| created_at | timestamptz | NULL | — | |
| updated_at | timestamptz | NULL | — | |

When `status === 'expired'` or trial has ended, users are redirected to `/subscription`.

---

### `team_invitations`
Pending/accepted/revoked invitations to join an organization.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| organization_id | uuid | NOT NULL | — | |
| email | text | NOT NULL | — | Invited email address |
| role | text | NULL | 'member' | 'admin' or 'member' |
| token | uuid | NULL | gen_random_uuid() | Used in the invite link |
| invited_by | uuid | NULL | — | FK → profiles |
| status | text | NULL | 'pending' | 'pending', 'accepted', 'revoked' |
| expires_at | timestamptz | NULL | now()+7days | |
| accepted_at | timestamptz | NULL | — | |
| created_at | timestamptz | NULL | — | |

---

### `vacancies`
Job posting within an organization.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| organization_id | uuid | NOT NULL | — | |
| title | text | NOT NULL | — | max 200 |
| sector_id | uuid | NULL | — | FK → sectors |
| status_id | uuid | NULL | — | FK → vacancy_statuses |
| department | text | NULL | — | max 100 |
| location | text | NULL | — | max 100 |
| employment_type | text | NULL | — | 'full_time', 'part_time', 'contract', 'internship' |
| hiring_manager_name | text | NULL | — | max 100 |
| salary_min | numeric | NULL | — | min 0 |
| salary_max | numeric | NULL | — | min 0; must be >= salary_min |
| salary_currency | text | NULL | 'USD' | ISO 3-letter code |
| openings_count | int | NOT NULL | 1 | min 1 |
| start_date | date | NOT NULL | — | |
| end_date | date | NULL | — | Must be >= start_date |
| description | text | NOT NULL | — | max 10000 (About the job) |
| requirements | text | NULL | — | max 5000 |
| responsibilities | text | NULL | — | max 5000 |
| created_by | uuid | NULL | — | FK → profiles |
| created_at | timestamptz | NULL | — | |
| updated_at | timestamptz | NULL | — | |
| archived_at | timestamptz | NULL | — | Set when archived |
| deleted_at | timestamptz | NULL | — | Soft-delete |
| application_form_token | text | NULL | — | base64url token for public apply link |
| show_on_public_page | bool | NULL | false | If true, shown on `/jobs/{slug}` |

---

### `vacancy_questions`
Custom assessment questions attached to a vacancy.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| organization_id | uuid | NOT NULL | — | |
| vacancy_id | uuid | NOT NULL | — | FK → vacancies |
| type | text | NOT NULL | — | 'text' or 'score' |
| label | text | NOT NULL | — | Question text |
| sort_order | int | NULL | 0 | |
| created_at | timestamptz | NULL | — | |
| updated_at | timestamptz | NULL | — | |

---

### `vacancy_statuses`
Global lookup. Status of a vacancy.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | — | PK |
| name | text | NULL | — | Display name |
| code | text | NULL | — | 'draft', 'open', 'on_hold', 'closed', 'archived' |
| is_active | bool | NULL | true | |
| sort_order | int | NULL | 0 | |

---

## Foreign Key Summary

| Table | FK Column | References |
|---|---|---|
| activity_log | organization_id | organizations |
| activity_log | user_id | profiles |
| applications | organization_id | organizations |
| applications | candidate_id | candidates |
| applications | vacancy_id | vacancies |
| applications | status_id | application_statuses |
| applications | created_by | profiles |
| applications | rejection_reason_id | rejection_reasons |
| applications | rejection_template_id | rejection_templates |
| candidate_documents | organization_id | organizations |
| candidate_documents | candidate_id | candidates |
| candidate_documents | uploaded_by | profiles |
| candidate_evaluation_answers | organization_id | organizations |
| candidate_evaluation_answers | evaluation_id | candidate_evaluations |
| candidate_evaluation_answers | question_id | vacancy_questions |
| candidate_evaluations | organization_id | organizations |
| candidate_evaluations | candidate_id | candidates |
| candidate_evaluations | application_id | applications |
| candidate_evaluations | vacancy_id | vacancies |
| candidate_notes | organization_id | organizations |
| candidate_notes | created_by | profiles |
| candidate_notes | candidate_id | candidates |
| candidates | organization_id | organizations |
| candidates | created_by | profiles |
| candidates | general_status_id | candidate_statuses |
| custom_field_groups | organization_id | organizations |
| custom_field_values | field_id | custom_fields |
| custom_field_values | organization_id | organizations |
| custom_fields | group_id | custom_field_groups |
| custom_fields | organization_id | organizations |
| email_templates | organization_id | organizations |
| interviews | organization_id | organizations |
| interviews | candidate_id | candidates |
| interviews | vacancy_id | vacancies |
| interviews | application_id | applications |
| interviews | interviewer_id | profiles |
| notifications | organization_id | organizations |
| notifications | recipient_id | profiles |
| profiles | id | auth.users |
| profiles | organization_id | organizations |
| rejection_reasons | organization_id | organizations |
| rejection_templates | organization_id | organizations |
| rejection_templates | reason_id | rejection_reasons |
| subscriptions | organization_id | organizations |
| team_invitations | organization_id | organizations |
| team_invitations | invited_by | profiles |
| vacancies | organization_id | organizations |
| vacancies | sector_id | sectors |
| vacancies | status_id | vacancy_statuses |
| vacancies | created_by | profiles |
| vacancy_questions | organization_id | organizations |
| vacancy_questions | vacancy_id | vacancies |

## Recent additions (2026-06-18 redesign session)

### 🆕 Live-verified additions (2026-07-22 audit)

_Pulled from the live **staging** DB (36 public tables) via the Supabase Management API — the tables below were missing from the sections above; columns/types/nullability are as live._

#### `offers` (G-018)
An offer extended to a candidate for a specific application. State machine in `lib/offers/state.ts`.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | NOT NULL | PK |
| organization_id | uuid | NOT NULL | tenant |
| application_id | uuid | NOT NULL | FK → applications |
| role_title | text | NOT NULL | |
| body | text | NOT NULL | offer letter body (≤20 000 chars) |
| recruiter_message | text | NULL | optional cover note (≤2000) |
| compensation_amount | numeric | NULL | |
| compensation_currency | text | NULL | 3–4 uppercase letters |
| compensation_period | text | NULL | `annual\|monthly\|hourly\|project\|other` |
| start_date | date | NULL | |
| expiry_date | date | NULL | drives `expired` via the daily cron + view-time check (`lib/offers/expiry.ts`) |
| status | text | NOT NULL | `draft\|sent\|accepted\|declined\|expired\|withdrawn` (default `draft`) |
| public_token | text | NULL | candidate-facing `/offer/<token>` credential |
| sent_at | timestamptz | NULL | set when the offer is sent |
| responded_at | timestamptz | NULL | set on accept/decline/withdraw |
| decline_reason | text | NULL | candidate's optional decline reason |
| created_by | uuid | NULL | FK → profiles |
| created_at / updated_at | timestamptz | NOT NULL | |
| deleted_at | timestamptz | NULL | soft delete |

#### `webhook_notifications` (G-030)
Per-org outgoing Slack/Teams webhook config.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | NOT NULL | PK |
| organization_id | uuid | NOT NULL | tenant |
| channel_type | text | NOT NULL | `slack\|teams` |
| webhook_url | text | NOT NULL | the incoming-webhook URL (customer-provided) |
| name | text | NULL | label |
| enabled_events | text[] | NOT NULL | subset of the 8 event types |
| is_active | bool | NOT NULL | per-webhook on/off |
| created_by | uuid | NULL | FK → profiles |
| created_at / updated_at | timestamptz | NOT NULL | |

#### `pipeline_stages` (Wave 2.6) & `org_pipeline_stage_templates`
Per-vacancy custom stages, and the org-level templates new vacancies clone.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | NOT NULL | PK |
| organization_id | uuid | NOT NULL | tenant |
| vacancy_id | uuid | NOT NULL | *(pipeline_stages only; templates have no vacancy_id)* |
| name | text | NOT NULL | e.g. "Sourced", "Closed - not a fit" |
| type | text | NOT NULL | `standard\|review\|interview\|offer` (bucket-mapped via `mapPipelineStageToBucket`) |
| sort_order | integer | NOT NULL | column order |
| is_terminal | bool | NOT NULL | default false |
| created_by | uuid | NULL | |
| created_at / updated_at | timestamptz | NOT NULL | |

#### `vacancy_screening_questions` & `application_screening_answers`
Apply-form screening question definitions (per vacancy) + the candidate's answers (per application). Knockout logic in `lib/screening-questions/`.

`vacancy_screening_questions`: id, organization_id, vacancy_id, `label` text, `answer_type` text (`yes_no\|short_text\|number\|select`, default `yes_no`), `options` jsonb, `is_knockout` bool, `knockout_answer` text (encoded per answer_type — see `knockout-condition.ts`), `sort_order` int, timestamps.

`application_screening_answers`: id, organization_id, application_id, question_id, `answer_value` text, `is_knockout_flag` bool (computed via `compute-flag.ts`), created_at.

#### `candidate_merges` (A-3)
Audit + revert record for a candidate merge.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | NOT NULL | PK |
| organization_id | uuid | NOT NULL | tenant |
| winner_id / loser_id | uuid | NOT NULL | surviving vs absorbed candidate |
| merged_by | uuid | NULL | FK → profiles |
| loser_snapshot | jsonb | NOT NULL | full loser record for revert |
| field_choices | jsonb | NOT NULL | per-field winner/loser resolution |
| reverted_at / reverted_by | timestamptz / uuid | NULL | set if the merge was undone |
| merged_at | timestamptz | NOT NULL | |

#### `mfa_recovery_codes` (G-032)
SHA-256-hashed single-use 2FA recovery codes (raw codes never stored — see `lib/mfa/recovery-codes.ts`).

| Column | Type | Nullable | Notes |
|---|---|---|---|
| id | uuid | NOT NULL | PK |
| user_id | uuid | NOT NULL | FK → profiles (per-user, not org-scoped) |
| code_hash | text | NOT NULL | sha256-hex of the normalised code |
| consumed_at | timestamptz | NULL | set when the code is used |
| created_at | timestamptz | NOT NULL | |

_MFA policy columns also live on `organizations` (`require_mfa`, `require_mfa_for_admins`) and `profiles` (`mfa_enrolled`); Calendly fields are on `organization_integrations` (G-031) — see the changelog at the top._

---

### Migration 044 — fix `sync_candidate_status_on_application_change()` trigger

Migration 022 introduced a trigger that auto-syncs `candidates.general_status_id` when all of a candidate's applications close. It looked up `candidate_statuses.code = 'inactive'`, but Migration 009 had simplified the codes to `'active' | 'hired' | 'archived'` — the lookup silently returned NULL and the trigger was a no-op for every close-out since June 2024. Migration 044 replaces the lookup with `'archived'` via `CREATE OR REPLACE FUNCTION`. Discovered during the redesign audit ([`audit.md` §2.4](../redesign/audit.md#0-status--decisions-locked)).

### Migration 045 — `profiles.notification_preferences` JSONB

Adds per-user notification preferences as a JSONB column. Default value matches `DEFAULT_NOTIFICATION_PREFERENCES` in `lib/types/notification-preferences.ts`. Shape:

```json
{
  "email": {
    "new_applicant": true, "interview_scheduled": true,
    "offer_awaiting_response": true, "mention": true,
    "team_invite_update": true, "weekly_digest": false
  },
  "in_product": { "show_bell_badge": true, "auto_mark_read": true },
  "quiet_hours": null
}
```

The in-product half is live — `NotificationsBell` reads it on mount and hides the unread badge if `show_bell_badge=false`, skips auto-mark-read if `auto_mark_read=false`. The email half is collected but not yet read by the dispatcher (most email events go to candidates/invitees external to the system; the recruiter-facing email surface is sparse today). `quiet_hours` is reserved for v1.1.

### Migration 046 — `pipeline_stages` table foundation

Per-vacancy custom stages, locked by [`audit.md` Q3](../redesign/audit.md#0-status--decisions-locked):

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `organization_id` | UUID NOT NULL FK organizations | RLS scope |
| `vacancy_id` | UUID NOT NULL FK vacancies | |
| `name` | TEXT NOT NULL | free text, any language |
| `type` | TEXT NOT NULL CHECK in (`standard`, `interview`, `offer`, `review`) | behavior keys off type, never name |
| `sort_order` | INTEGER NOT NULL | unique per vacancy |
| `is_terminal` | BOOLEAN NOT NULL DEFAULT FALSE | e.g. Hired / Rejected / Withdrawn |
| `created_by` | UUID FK profiles | nullable for cascade |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

Plus a `BEFORE INSERT` trigger enforcing the cap of 10 stages per vacancy, RLS that lets every org member view stages but restricts manage to owner+admin, and a `seed_default_pipeline_stages(vacancy_id, org_id, created_by)` helper mirroring the legacy 7-stage seed (Applied → Screening → Interview → Offer → Hired + Rejected + Withdrawn).

**Status:** schema lives but has no readers yet. The coordinated swap on `applications` (drop `status_id` → add `pipeline_stage_id`) is deferred to a follow-up migration so the ~20 call sites currently reading `applications.status_id` keep working. Wave 2.6 implementation finishes the cutover.
