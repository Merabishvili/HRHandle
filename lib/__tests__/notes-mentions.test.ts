import { describe, it, expect } from 'vitest'
import {
  extractMentionIds,
  tokenizeNoteForDisplay,
  type MentionableMember,
} from '@/lib/notes/mentions'

const ALEX: MentionableMember = { id: 'u1', display_name: 'Alex Merabishvili' }
const SOPHIA: MentionableMember = { id: 'u2', display_name: 'Sophia Mumladze' }
const ALEXANDRA: MentionableMember = { id: 'u3', display_name: 'Alexandra Jones' }

const MEMBERS = [ALEX, SOPHIA, ALEXANDRA]

describe('extractMentionIds', () => {
  it('returns empty when no ids are supplied', () => {
    expect(extractMentionIds('Hello world', [], MEMBERS)).toEqual([])
  })

  it('keeps ids whose @FullName actually appears in the text', () => {
    const text = 'Following up — please review, @Alex Merabishvili and @Sophia Mumladze.'
    expect(extractMentionIds(text, ['u1', 'u2'], MEMBERS)).toEqual(['u1', 'u2'])
  })

  it('drops ids when the matching @FullName is missing from the text', () => {
    const text = 'No mention here.'
    expect(extractMentionIds(text, ['u1'], MEMBERS)).toEqual([])
  })

  it('drops unknown ids (forged / belongs to a different org)', () => {
    const text = '@Alex Merabishvili check this'
    expect(extractMentionIds(text, ['unknown-id', 'u1'], MEMBERS)).toEqual(['u1'])
  })

  it('dedupes ids supplied twice', () => {
    const text = '@Alex Merabishvili @Alex Merabishvili'
    expect(extractMentionIds(text, ['u1', 'u1', 'u1'], MEMBERS)).toEqual(['u1'])
  })

  it('matches case-insensitively', () => {
    const text = 'cc @alex merabishvili'
    expect(extractMentionIds(text, ['u1'], MEMBERS)).toEqual(['u1'])
  })

  it('ignores non-string elements in the supplied list', () => {
    // @ts-expect-error — deliberately bad input to confirm the runtime guard
    expect(extractMentionIds('@Alex Merabishvili', ['u1', null, 42], MEMBERS)).toEqual(['u1'])
  })
})

describe('tokenizeNoteForDisplay', () => {
  const byId = new Map(MEMBERS.map((m) => [m.id, m]))

  it('returns a single text token when the note has no mentions', () => {
    expect(tokenizeNoteForDisplay('plain text', byId)).toEqual([
      { kind: 'text', text: 'plain text' },
    ])
  })

  it('returns an empty list for the empty string', () => {
    expect(tokenizeNoteForDisplay('', byId)).toEqual([])
  })

  it('splits text + one mention + text', () => {
    expect(
      tokenizeNoteForDisplay('cc @Sophia Mumladze for review', byId),
    ).toEqual([
      { kind: 'text', text: 'cc ' },
      { kind: 'mention', memberId: 'u2', label: 'Sophia Mumladze' },
      { kind: 'text', text: ' for review' },
    ])
  })

  it('handles multiple mentions interspersed with text', () => {
    expect(
      tokenizeNoteForDisplay('@Alex Merabishvili and @Sophia Mumladze pls', byId),
    ).toEqual([
      { kind: 'mention', memberId: 'u1', label: 'Alex Merabishvili' },
      { kind: 'text', text: ' and ' },
      { kind: 'mention', memberId: 'u2', label: 'Sophia Mumladze' },
      { kind: 'text', text: ' pls' },
    ])
  })

  it('prefers the longer match when names share a prefix (Alex vs Alexandra)', () => {
    expect(tokenizeNoteForDisplay('see @Alexandra Jones', byId)).toEqual([
      { kind: 'text', text: 'see ' },
      { kind: 'mention', memberId: 'u3', label: 'Alexandra Jones' },
    ])
  })

  it('leaves unresolved @ sequences as literal text', () => {
    expect(tokenizeNoteForDisplay('email me @nobody@example.com', byId)).toEqual([
      { kind: 'text', text: 'email me @nobody@example.com' },
    ])
  })

  it('returns an empty mentions map → single text token', () => {
    expect(tokenizeNoteForDisplay('@Alex Merabishvili stuff', new Map())).toEqual([
      { kind: 'text', text: '@Alex Merabishvili stuff' },
    ])
  })

  it('handles a standalone @ at end of text', () => {
    expect(tokenizeNoteForDisplay('ping @', byId)).toEqual([
      { kind: 'text', text: 'ping @' },
    ])
  })

  it('matches case-insensitively', () => {
    expect(tokenizeNoteForDisplay('cc @sophia mumladze', byId)).toEqual([
      { kind: 'text', text: 'cc ' },
      { kind: 'mention', memberId: 'u2', label: 'Sophia Mumladze' },
    ])
  })
})
