# Issues Found

All issues discovered during the codebase audit. Severity levels: **Critical** (data loss / security), **High** (incorrect behavior / visible bug), **Medium** (inconsistency / minor bug), **Low** (code quality / tech debt).

---

## BUG-005 — Duplicate application detection only matches by email, ignores hired/inactive candidates

| Field | Value |
|---|---|
| **Type** | Logic Issue |
| **Severity** | Low |
| **File** | `lib/actions/public-apply.ts` lines 143–149 |

**Description:**  
The duplicate candidate detection in `submitPublicApplication` queries `candidates` where `general_status_id = activeStatus.id` (i.e., only active candidates). If the same email has a candidate record with status `hired` or `archived`, a new candidate record will be created for that email, resulting in duplicate candidate records in the same organization.

**Impact:** The same person can appear multiple times as a candidate if they previously applied and were hired or archived.

**Suggested Fix:** Remove the `general_status_id` filter from the duplicate detection query, or search across all non-deleted candidates regardless of status.

---

## BUG-006 — Rollback on application insert failure only deletes candidate, not uploaded CV

| Field | Value |
|---|---|
| **Type** | Logic Issue |
| **Severity** | Low |
| **File** | `lib/actions/public-apply.ts` lines 211–216 |

**Description:**  
When the application insert fails (step 12), the code rolls back the newly-created candidate row. However, if the CV upload order ever changes (currently CV is uploaded after the application insert, so this is safe), orphaned storage files will accumulate. The rollback block does not clean up the storage bucket.

**Impact:** Low risk currently; potential future issue if upload order changes.

**Suggested Fix:** Document the dependency on operation order, or add storage cleanup to the rollback block.

---

## TODO-004 — LemonSqueezy billing is planned but not implemented

| Field | Value |
|---|---|
| **Type** | Missing Feature |
| **Severity** | N/A |
| **File** | `lib/types/subscription.ts`, `CLAUDE.md` |

**Description:**  
The subscription/billing system references plan codes (`trial`, `individual`, `organization`) and pricing, but there is no LemonSqueezy webhook handler, checkout session creation, or payment flow implemented. The billing settings page shows pricing but has no active payment link or upgrade mechanism.

**Impact:** Users cannot upgrade from trial to paid plans.
