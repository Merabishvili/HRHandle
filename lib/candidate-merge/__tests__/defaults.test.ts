import { describe, it, expect } from 'vitest'
import { defaultMergeChoice } from '@/lib/candidate-merge/defaults'

describe('defaultMergeChoice', () => {
  it('keeps the winner when only the winner has a value', () => {
    expect(defaultMergeChoice({ winnerValue: 'a', loserValue: null })).toBe('winner')
  })
  it('takes the loser when only the loser has a value', () => {
    expect(defaultMergeChoice({ winnerValue: null, loserValue: 'b' })).toBe('loser')
    expect(defaultMergeChoice({ winnerValue: '   ', loserValue: 'b' })).toBe('loser')
  })
  it('defaults to the winner when both are set', () => {
    expect(defaultMergeChoice({ winnerValue: 'a', loserValue: 'b' })).toBe('winner')
  })
  it('defaults to the winner when both are empty/whitespace', () => {
    expect(defaultMergeChoice({ winnerValue: '', loserValue: '  ' })).toBe('winner')
    expect(defaultMergeChoice({ winnerValue: null, loserValue: null })).toBe('winner')
  })
})
