// Pure helpers for the @-mention feature (G-021). Live outside the server
// action + UI so both the API path (which revalidates client-supplied id
// arrays) and the renderer (which tokenizes saved notes for display) share
// the same canonical rules.

export interface MentionableMember {
  id: string
  display_name: string
}

/** Pieces produced by tokenizing a note for display. `text` is a literal
 * substring; `mention` is a resolved @-mention with the chip's display label
 * and the id to link to. */
export type NoteToken =
  | { kind: 'text'; text: string }
  | { kind: 'mention'; memberId: string; label: string }

/**
 * Validate the client-supplied list of mentioned ids against the note's
 * current text. Drops any id whose corresponding `@FullName` substring no
 * longer appears in the text — that's the only way to keep client-recorded
 * ids honest without re-parsing the whole note server-side.
 *
 * Membership is normalised through the `members` map so deduped ids and
 * ids belonging to a different org's profiles (somehow forged client-side)
 * naturally fall out.
 */
export function extractMentionIds(
  text: string,
  clientIds: ReadonlyArray<string>,
  members: ReadonlyArray<MentionableMember>,
): string[] {
  const byId = new Map(members.map((m) => [m.id, m]))
  const lower = text.toLowerCase()
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of clientIds) {
    if (typeof id !== 'string' || seen.has(id)) continue
    const m = byId.get(id)
    if (!m) continue
    // Defensive: only keep ids whose `@FullName` substring is actually
    // present. Comparison is case-insensitive — recruiters often type
    // lowercase first letters then accept the auto-capitalised insert.
    const needle = `@${m.display_name}`.toLowerCase()
    if (!lower.includes(needle)) continue
    out.push(id)
    seen.add(id)
  }
  return out
}

/**
 * Tokenize a saved note's text into a sequence of `{text}` / `{mention}`
 * pieces. The matcher scans for any `@FullName` substring of a member in the
 * note's `mentionsById` map. We do this in a single pass so overlapping
 * names (Alex / Alexandra) resolve to the longest match.
 */
export function tokenizeNoteForDisplay(
  text: string,
  mentionsById: ReadonlyMap<string, MentionableMember>,
): NoteToken[] {
  if (mentionsById.size === 0) {
    return text.length === 0 ? [] : [{ kind: 'text', text }]
  }

  // Build a list of needles sorted longest-first so the longest match wins
  // when two members share a name prefix.
  const needles = Array.from(mentionsById.values())
    .map((m) => ({ id: m.id, label: m.display_name, needle: `@${m.display_name}` }))
    .sort((a, b) => b.needle.length - a.needle.length)

  const tokens: NoteToken[] = []
  let cursor = 0
  while (cursor < text.length) {
    if (text[cursor] !== '@') {
      const nextAt = text.indexOf('@', cursor + 1)
      const sliceEnd = nextAt === -1 ? text.length : nextAt
      tokens.push({ kind: 'text', text: text.slice(cursor, sliceEnd) })
      cursor = sliceEnd
      continue
    }
    let matched: { id: string; label: string; length: number } | null = null
    for (const n of needles) {
      const window = text.slice(cursor, cursor + n.needle.length)
      if (window.toLowerCase() === n.needle.toLowerCase()) {
        matched = { id: n.id, label: n.label, length: n.needle.length }
        break
      }
    }
    if (matched) {
      tokens.push({ kind: 'mention', memberId: matched.id, label: matched.label })
      cursor += matched.length
    } else {
      tokens.push({ kind: 'text', text: '@' })
      cursor += 1
    }
  }
  // Coalesce neighbour text tokens so the renderer doesn't emit
  // back-to-back spans for what is conceptually one literal run.
  const merged: NoteToken[] = []
  for (const t of tokens) {
    const prev = merged[merged.length - 1]
    if (t.kind === 'text' && prev && prev.kind === 'text') {
      prev.text += t.text
    } else {
      merged.push(t)
    }
  }
  return merged
}
