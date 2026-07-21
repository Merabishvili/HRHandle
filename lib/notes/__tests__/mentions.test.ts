import { describe, it, expect } from 'vitest'
import {
  extractMentionIds,
  tokenizeNoteForDisplay,
  type MentionableMember,
} from '@/lib/notes/mentions'

const members: MentionableMember[] = [
  { id: 'u1', display_name: 'Jane Doe' },
  { id: 'u2', display_name: 'Alex' },
  { id: 'u3', display_name: 'Alexandra Smith' },
]

describe('extractMentionIds', () => {
  it('keeps ids whose @name appears in the text (case-insensitive)', () => {
    expect(extractMentionIds('cc @jane doe here', ['u1'], members)).toEqual(['u1'])
  })
  it('drops ids whose @name is not in the text', () => {
    expect(extractMentionIds('no mentions', ['u1'], members)).toEqual([])
  })
  it('drops unknown / forged ids', () => {
    expect(extractMentionIds('@Jane Doe', ['nope'], members)).toEqual([])
  })
  it('dedupes repeated ids', () => {
    expect(extractMentionIds('@Jane Doe and @Jane Doe', ['u1', 'u1'], members)).toEqual(['u1'])
  })
})

describe('tokenizeNoteForDisplay', () => {
  const byId = new Map(members.map((m) => [m.id, m]))

  it('returns a single text token when there are no mentions', () => {
    expect(tokenizeNoteForDisplay('hello world', new Map())).toEqual([{ kind: 'text', text: 'hello world' }])
  })

  it('splits text and mention pieces', () => {
    const toks = tokenizeNoteForDisplay('hi @Jane Doe!', byId)
    expect(toks).toEqual([
      { kind: 'text', text: 'hi ' },
      { kind: 'mention', memberId: 'u1', label: 'Jane Doe' },
      { kind: 'text', text: '!' },
    ])
  })

  it('longest match wins for shared prefixes (Alexandra Smith over Alex)', () => {
    const toks = tokenizeNoteForDisplay('ping @Alexandra Smith', byId)
    expect(toks).toContainEqual({ kind: 'mention', memberId: 'u3', label: 'Alexandra Smith' })
    expect(toks.some((t) => t.kind === 'mention' && t.memberId === 'u2')).toBe(false)
  })

  it('leaves a lone @ that matches no member as text', () => {
    expect(tokenizeNoteForDisplay('email a@b.com', byId)).toEqual([{ kind: 'text', text: 'email a@b.com' }])
  })

  it('resolves a bare @Alex mention', () => {
    const toks = tokenizeNoteForDisplay('@Alex hi', byId)
    expect(toks[0]).toEqual({ kind: 'mention', memberId: 'u2', label: 'Alex' })
  })
})
