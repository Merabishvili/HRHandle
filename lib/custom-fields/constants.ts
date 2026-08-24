/**
 * Pure constants for custom fields. Kept OUT of `lib/actions/custom-fields.ts`
 * because that file is `'use server'` and may only export async functions —
 * a plain `export const` there breaks the whole module (#5/6/7).
 */

/** Max custom fields per entity type — enforced on create, surfaced in the
 * "N / MAX" counter on every custom-fields surface. */
export const MAX_CUSTOM_FIELDS_PER_ENTITY = 20
