import { describe, it, expect } from 'vitest'
import { defaultMergeChoice } from '@/lib/candidate-merge/defaults'

// Pure-logic tests for the merge dialog. The server side of A-3 is the
// merge_candidates() SQL function in scripts/053_candidate_merges.sql,
// which is exercised in integration tests via the migration's own
// `RAISE EXCEPTION` branches. Vitest just covers the client-side
// defaults that drive the UI.

describe('defaultMergeChoice', () => {
  it('keeps the winner when only the winner has a value', () => {
    expect(defaultMergeChoice({ winnerValue: 'Alex', loserValue: null })).toBe('winner')
  })

  it('picks the loser when only the loser has a value (non-empty wins)', () => {
    expect(defaultMergeChoice({ winnerValue: null, loserValue: 'Acme Inc.' })).toBe('loser')
  })

  it('keeps the winner when both are populated (manual override required)', () => {
    expect(defaultMergeChoice({ winnerValue: 'Alex', loserValue: 'Aleksandre' })).toBe('winner')
  })

  it('keeps the winner when both are empty (no-op)', () => {
    expect(defaultMergeChoice({ winnerValue: null, loserValue: null })).toBe('winner')
  })

  it('treats whitespace-only as empty', () => {
    expect(defaultMergeChoice({ winnerValue: '   ', loserValue: 'real' })).toBe('loser')
    expect(defaultMergeChoice({ winnerValue: 'real', loserValue: '   ' })).toBe('winner')
  })
})
