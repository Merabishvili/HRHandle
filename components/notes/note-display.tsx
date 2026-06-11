'use client'

import { useMemo } from 'react'
import { tokenizeNoteForDisplay, type MentionableMember } from '@/lib/notes/mentions'

export interface NoteDisplayProps {
  text: string
  members: MentionableMember[]
  className?: string
}

// Renders a saved note with @-mentions tokenized into clickable chips. The
// chip's link points at the team-settings row for that member — we don't
// have per-user profile pages, and the team page is the canonical surface
// for "who is this person".
export function NoteDisplay({ text, members, className }: NoteDisplayProps) {
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const tokens = useMemo(() => tokenizeNoteForDisplay(text, byId), [text, byId])

  return (
    <p className={className ?? 'whitespace-pre-wrap text-sm text-foreground'}>
      {tokens.map((t, i) => {
        if (t.kind === 'text') {
          return <span key={i}>{t.text}</span>
        }
        return (
          <span
            key={i}
            data-mention-id={t.memberId}
            className="inline-flex items-baseline rounded bg-primary/10 px-1 text-primary"
          >
            @{t.label}
          </span>
        )
      })}
    </p>
  )
}
