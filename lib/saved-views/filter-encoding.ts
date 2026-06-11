import { SAVED_VIEW_CONFIG, type SavedViewKind } from './list-kinds'

// Pure helpers for the saved-views feature (G-026). The encode/decode pair
// gives us a canonical JSONB-friendly shape for `saved_views.params` so two
// equivalent filter combinations always compare equal, and the recruiter
// doesn't get a false "modified" badge because the URL happens to have
// `page=2` or the default sort spelled out.

export type EncodedParams = Record<string, string>

/** Normalize a search-params bag into the canonical encoded shape:
 *
 * - Keep only keys that appear in the kind's filterKeys allow-list.
 * - Drop empty strings + whitespace-only values.
 * - Drop the default sort (so "untouched sort" matches the saved view).
 * - Preserve key order from `filterKeys` so the JSON serialisation is stable.
 *
 * Pagination params (`page`, `pageSize`) are never persisted — they belong
 * to the runtime URL, not the saved view's identity.
 */
export function encodeParams(
  kind: SavedViewKind,
  raw: Record<string, string | null | undefined>,
): EncodedParams {
  const cfg = SAVED_VIEW_CONFIG[kind]
  const out: EncodedParams = {}
  for (const key of cfg.filterKeys) {
    const v = raw[key]
    if (v == null) continue
    const trimmed = String(v).trim()
    if (trimmed.length === 0) continue
    if (key === 'sort' && trimmed === cfg.defaultSort) continue
    out[key] = trimmed
  }
  return out
}

/** Reverse: take a stored encoded shape and produce a URLSearchParams the
 * toolbar can navigate to. Unknown keys are ignored so a future schema-
 * mismatched saved view doesn't push junk back into the URL. */
export function decodeParams(
  kind: SavedViewKind,
  stored: Record<string, unknown>,
): URLSearchParams {
  const cfg = SAVED_VIEW_CONFIG[kind]
  const out = new URLSearchParams()
  if (!stored || typeof stored !== 'object') return out
  for (const key of cfg.filterKeys) {
    const v = (stored as Record<string, unknown>)[key]
    if (typeof v !== 'string') continue
    if (v.trim().length === 0) continue
    out.set(key, v)
  }
  return out
}

/** Strict equality of two encoded shapes. Used by the toolbar to decide
 * whether to render the "Modified" badge on a loaded view, and to choose
 * between Save / Update copy. */
export function paramsAreEqual(a: EncodedParams, b: EncodedParams): boolean {
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  for (const k of ak) {
    if (a[k] !== b[k]) return false
  }
  return true
}

/** Build a URL for the kind's base path with the given encoded params,
 * suitable for the dropdown's "load this view" link. */
export function buildHrefForView(kind: SavedViewKind, params: EncodedParams): string {
  const cfg = SAVED_VIEW_CONFIG[kind]
  const q = new URLSearchParams()
  for (const key of cfg.filterKeys) {
    const v = params[key]
    if (typeof v !== 'string') continue
    if (v.trim().length === 0) continue
    q.set(key, v)
  }
  const qs = q.toString()
  return qs ? `${cfg.basePath}?${qs}` : cfg.basePath
}

/** Validate + trim a view name. Returns the cleaned string or null when the
 * input is unsuitable. Bounds match the column comment in migration 038. */
export function normalizeViewName(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  if (trimmed.length > 60) return null
  return trimmed
}
