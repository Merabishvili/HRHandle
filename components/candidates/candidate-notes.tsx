'use client'

import { useRef, useState, useTransition } from 'react'
import { createNote, deleteNote } from '@/lib/actions/notes'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

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
}

export function CandidateNotes({ candidateId, initialNotes, currentUserId }: CandidateNotesProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleAdd = () => {
    if (!text.trim()) return
    setError(null)

    startTransition(async () => {
      const result = await createNote(candidateId, text.trim())
      if (!result.success) {
        setError(result.error)
        return
      }
      // Server revalidates the page; optimistically add a placeholder
      const optimistic: Note = {
        id: result.data.id,
        text: text.trim(),
        created_at: new Date().toISOString(),
        author_id: currentUserId,
        profiles: null,
      }
      setNotes((prev) => [optimistic, ...prev])
      setText('')
      textareaRef.current?.focus()
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
          <Textarea
            ref={textareaRef}
            placeholder="Add a note about this candidate…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            disabled={isPending}
          />
          <div className="flex justify-end">
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
              <li key={note.id} className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-pre-wrap text-sm text-foreground">{note.text}</p>
                  {note.author_id === currentUserId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
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
