/**
 * Pure plan-limit predicates. Kept out of `lib/actions/` (which is `'use server'`
 * and may only export async functions) so they can be imported by both server
 * actions and unit tests.
 */

/**
 * True when `newCount` is exactly one past `limit` — the single moment a **soft**
 * cap is crossed.
 *
 * Used by the public apply form (BL-203): public applications are never blocked,
 * but when a newly-created candidate pushes the org past its `candidate_limit`
 * we notify the owners/admins **once** (at the crossing) rather than on every
 * insert past the cap. A `null` / `0` / `undefined` limit means "no cap".
 */
export function justCrossedLimit(newCount: number, limit: number | null | undefined): boolean {
  if (!limit) return false
  return newCount === limit + 1
}
