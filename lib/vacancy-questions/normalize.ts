/**
 * Pure normalization for the vacancy-questions bulk-insert path. Pulled
 * out of the server action (`lib/actions/evaluations.ts`) so it can be
 * unit-tested without mocking Supabase. Rules:
 *   - Trim labels; drop entries whose trimmed label is empty.
 *   - Drop entries whose trimmed label exceeds 500 chars (matches the
 *     single-add path's validation in `addVacancyQuestion`).
 *   - Force `mustHave` false for `type === 'text'` — open questions can't
 *     carry the must-have semantic, regardless of what the caller passed.
 */
export function normalizeVacancyQuestionEntries(
  entries: { label: string; type: 'text' | 'score'; mustHave?: boolean }[],
): { label: string; type: 'text' | 'score'; mustHave: boolean }[] {
  return entries
    .map((e) => ({
      label: e.label.trim(),
      type: e.type,
      mustHave: e.type === 'score' && Boolean(e.mustHave),
    }))
    .filter((e) => e.label.length > 0 && e.label.length <= 500)
}
