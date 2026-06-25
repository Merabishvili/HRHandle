import { describe, it, expect } from 'vitest'
import { terminalSummary, type TerminalCount } from '@/components/pipeline/terminal-rail'

const make = (name: string, count: number): TerminalCount => ({
  statusId: name.toLowerCase(),
  code: name.toLowerCase() as TerminalCount['code'],
  name,
  count,
})

describe('terminalSummary', () => {
  it('joins each terminal outcome with a middot, including zero counts', () => {
    const summary = terminalSummary([make('Rejected', 2), make('Withdrawn', 0)])
    expect(summary).toBe('Rejected 2 · Withdrawn 0')
  })

  it('renders a single outcome without a separator', () => {
    expect(terminalSummary([make('Rejected', 5)])).toBe('Rejected 5')
  })

  it('returns an empty string when there are no terminals', () => {
    expect(terminalSummary([])).toBe('')
  })
})
