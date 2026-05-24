// Shared shapes for the common partial-select results used across page
// components. Each alias mirrors a `select('id, name, code, sort_order')`-style
// query so callers can `import { CandidateStatusOption } from '@/lib/types/database'`
// instead of redeclaring the same shape inline.
//
// Full domain types (`Candidate`, `Application`, `Vacancy`, etc.) still live in
// their own files. This module is for the *projection* aliases that the audit
// flagged as duplicated (A-001).

import type { CandidateGeneralStatus } from './candidate'
import type { ApplicationStatus } from './application'

/**
 * Result of `select('id, name, code, is_active, sort_order')` against
 * `candidate_statuses`. Matches the cached lookup in `lib/cache/lookups.ts`.
 * Used in the candidates list, candidate detail, candidate edit, dashboard,
 * vacancy detail, candidate form, and pipeline kanban views.
 */
export type CandidateStatusOption = Pick<
  CandidateGeneralStatus,
  'id' | 'name' | 'code' | 'is_active' | 'sort_order'
>

/**
 * Result of `select('id, name, code, is_active, sort_order')` against
 * `application_statuses`. Used in the candidate detail, vacancy detail, and
 * the apply-evaluation + applications-list components.
 */
export type ApplicationStatusOption = Pick<
  ApplicationStatus,
  'id' | 'name' | 'code' | 'is_active' | 'sort_order'
>
