/**
 * Default conflict resolution for the A-3 merge dialog: non-empty wins,
 * otherwise keep the winner (the surviving record). Whitespace-only is
 * treated as empty.
 *
 * Lives in lib/ so the test file can import it without pulling in the
 * 'use client' dialog and its transitive server-only deps.
 */
export type MergeChoice = 'winner' | 'loser'

export function defaultMergeChoice(row: {
  winnerValue: string | null
  loserValue: string | null
}): MergeChoice {
  const w = (row.winnerValue ?? '').trim()
  const l = (row.loserValue ?? '').trim()
  if (w && !l) return 'winner'
  if (!w && l) return 'loser'
  return 'winner'
}
