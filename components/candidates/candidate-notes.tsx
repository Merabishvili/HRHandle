'use client'

import { useEffect, useState, useTransition } from 'react'
import { createNote, deleteNote, listMentionableMembers } from '@/lib/actions/notes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import { MentionTextarea } from '@/components/notes/mention-textarea'
import { NoteDisplay } from '@/components/notes/note-display'
import type { MentionableMember } from '@/lib/notes/mentions'

interface NoteAuthor {
  full_name: string | null
}

interface Note {
  id: string
  text: string
  created_at: string
  author_id: string
  profiles: NoteAuthor[] | null
}

interface CandidateNotesProps {
  candidateId: string
  initialNotes: Note[]
  currentUserId: string
  /** Org members the author can @-mention. Loaded server-side and passed
   * down so the popover is responsive on the first keystroke. */
  initialMembers: MentionableMember[]
}

export function CandidateNotes({
  candidateId,
  initialNotes,
  currentUserId,
  initialMembers,
}: CandidateNotesProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [text, setText] = useState('')
  const [mentions, setMentions] = useState<string[]>([])
  const [members, setMembers] = useState<MentionableMember[]>(initialMembers)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Refresh the member list once on mount in case the parent's snapshot is
  // stale (someone joined the org while the page was open).
  useEffect(() => {
    let cancelled = false
    listMentionableMembers().then((r) => {
      if (cancelled) return
      if (r.success) setMembers(r.data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleAdd = () => {
    if (!text.trim()) return
    setError(null)

    startTransition(async () => {
      const result = await createNote(candidateId, text.trim(), mentions)
      if (!result.success) {
        setError(result.error)
        return
      }
      const optimistic: Note = {
        id: result.data.id,
        text: text.trim(),
        created_at: new Date().toISOString(),
        author_id: currentUserId,
        profiles: null,
      }
      setNotes((prev) => [optimistic, ...prev])
      setText('')
      setMentions([])
    })
  }

  const handleDelete = (noteId: string) => {
    startTransition(async () => {
      const result = await deleteNote(noteId, candidateId)
      if (!result.success) {
        setError(result.error)
        return
      }
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
    })
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle>Notes</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <MentionTextarea
            value={text}
            onChange={(v, ids) => {
              setText(v)
              setMentions(ids)
            }}
            members={members}
            placeholder="Add a note about this candidate… Type @ to mention a teammate."
            rows={3}
            maxLength={5000}
            disabled={isPending}
          />
          <div className="flex items-center justify-between">
            {mentions.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Will notify {mentions.length} teammate{mentions.length === 1 ? '' : 's'}.
              </p>
            ) : (
              <span />
            )}
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={isPending || !text.trim()}
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add Note
            </Button>
          </div>
        </div>

        {notes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <ul className="space-y-3">
            {notes.map((note) => (
              <li
                key={note.id}
                id={`note-${note.id}`}
                className="rounded-lg border border-border bg-muted/30 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <NoteDisplay
                    text={note.text}
                    members={members}
                    className="flex-1 whitespace-pre-wrap text-sm text-foreground"
                  />
                  {note.author_id === currentUserId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Delete note"
                      onClick={() => handleDelete(note.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {note.profiles?.[0]?.full_name ?? 'Team member'} ·{' '}
                  {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
