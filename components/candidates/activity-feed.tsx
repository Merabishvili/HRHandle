'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { createNote, deleteNote, listMentionableMembers } from '@/lib/actions/notes'
import { Briefcase, FileText, ArrowRight, MessageSquare, Calendar, Loader2, Send, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

import { MentionTextarea } from '@/components/notes/mention-textarea'
import { NoteDisplay } from '@/components/notes/note-display'
import type { MentionableMember } from '@/lib/notes/mentions'

export type ActivityKind = 'application' | 'document' | 'stage' | 'note' | 'interview'

export interface ActivityItem {
  id: string
  kind: ActivityKind
  headline: string
  body: string | null
  meta: string | null
  actor_name: string | null
  created_at: string
}

interface ActivityFeedProps {
  candidateId: string
  currentUserId: string
  currentUserName: string | null
  initialItems: ActivityItem[]
  /** Org members the author can @-mention. Optional — when omitted, the
   * composer still works but the typeahead has nothing to offer until
   * `listMentionableMembers` returns on mount. */
  initialMembers?: MentionableMember[]
}

const KIND_ICON: Record<ActivityKind, React.ReactNode> = {
  application: <Briefcase  className="h-[15px] w-[15px]" />,
  document:    <FileText   className="h-[15px] w-[15px]" />,
  stage:       <ArrowRight className="h-[15px] w-[15px]" />,
  note:        <MessageSquare className="h-[15px] w-[15px]" />,
  interview:   <Calendar   className="h-[15px] w-[15px]" />,
}

const KIND_STYLE: Record<ActivityKind, string> = {
  application: 'bg-[oklch(0.55_0.18_250/0.1)]  text-[oklch(0.55_0.18_250)]',
  document:    'bg-[oklch(0.7_0.15_165/0.15)]   text-[oklch(0.35_0.12_165)]',
  stage:       'bg-[oklch(0.75_0.15_70/0.2)]    text-[oklch(0.38_0.1_70)]',
  note:        'bg-muted text-muted-foreground',
  interview:   'bg-[oklch(0.65_0.17_145/0.15)]  text-[oklch(0.35_0.13_145)]',
}

const FILTER_OPTIONS: { label: string; value: ActivityKind | 'all' }[] = [
  { label: 'All',           value: 'all' },
  { label: 'Notes',         value: 'note' },
  { label: 'Interviews',    value: 'interview' },
  { label: 'Stage changes', value: 'stage' },
  { label: 'Documents',     value: 'document' },
]

function ActivityIcon({ kind }: { kind: ActivityKind }) {
  return (
    <div className={cn('flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full', KIND_STYLE[kind])}>
      {KIND_ICON[kind]}
    </div>
  )
}

export function ActivityFeed({
  candidateId,
  currentUserId,
  currentUserName,
  initialItems,
  initialMembers = [],
}: ActivityFeedProps) {
  const [items, setItems]     = useState<ActivityItem[]>(initialItems)
  const [filter, setFilter]   = useState<ActivityKind | 'all'>('all')
  const [noteText, setNoteText] = useState('')
  const [noteMentions, setNoteMentions] = useState<string[]>([])
  const [members, setMembers] = useState<MentionableMember[]>(initialMembers)
  const [isPending, startTransition] = useTransition()

  const initials = (currentUserName ?? 'U').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  const filtered = filter === 'all' ? items : items.filter((i) => i.kind === filter)

  // Hydrate the member list once so the @-mention typeahead has something to
  // offer even when no `initialMembers` was passed by the parent.
  useEffect(() => {
    if (members.length > 0) return
    let cancelled = false
    listMentionableMembers().then((r) => {
      if (cancelled) return
      if (r.success) setMembers(r.data)
    })
    return () => {
      cancelled = true
    }
  }, [members.length])

  const handlePost = () => {
    const text = noteText.trim()
    if (!text) return
    startTransition(async () => {
      const result = await createNote(candidateId, text, noteMentions)
      if (!result.success) return
      const newItem: ActivityItem = {
        id: result.data.id,
        kind: 'note',
        headline: 'Note added',
        body: text,
        meta: null,
        actor_name: currentUserName,
        created_at: new Date().toISOString(),
      }
      setItems((prev) => [newItem, ...prev])
      setNoteText('')
      setNoteMentions([])
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteNote(id, candidateId)
      if (!result.success) return
      setItems((prev) => prev.filter((i) => i.id !== id))
    })
  }

  // Render either the body as a plain paragraph or — for note items — as a
  // tokenized display so @-mentions become chips. Memoised so a list of
  // hundreds of activity items doesn't re-tokenize every render.
  const noteBodyById = useMemo(() => {
    const m = new Map<string, React.ReactNode>()
    for (const item of items) {
      if (item.kind === 'note' && item.body) {
        m.set(
          item.id,
          <NoteDisplay
            key={item.id}
            text={item.body}
            members={members}
            className="text-[12.5px] leading-[1.55] text-muted-foreground"
          />,
        )
      }
    }
    return m
  }, [items, members])

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-[15px] font-bold text-foreground">Activity</span>
          {items.length > 0 && <span className="text-[12px] text-muted-foreground">({items.length})</span>}
        </div>
      </div>

      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTER_OPTIONS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={cn(
              'rounded-full px-3 py-[5px] text-[11.5px] font-medium transition-colors',
              filter === value
                ? 'border border-[oklch(0.55_0.18_250)] bg-[oklch(0.55_0.18_250/0.1)] text-[oklch(0.35_0.15_250)]'
                : 'border border-border bg-white text-muted-foreground hover:border-foreground/30'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="space-y-0">
          {filtered.map((item, idx) => (
            <div key={item.id} id={item.kind === 'note' ? `note-${item.id}` : undefined} className="flex gap-3">
              {/* Icon + connector */}
              <div className="flex flex-col items-center">
                <ActivityIcon kind={item.kind} />
                {idx < filtered.length - 1 && (
                  <div className="mt-1 w-px flex-1 bg-border" />
                )}
              </div>

              {/* Body */}
              <div className={cn('min-w-0 flex-1', idx < filtered.length - 1 ? 'pb-4' : 'pb-1')}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-medium text-foreground">{item.headline}</p>
                  {item.kind === 'note' && (
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="shrink-0 text-muted-foreground/50 transition-colors hover:text-destructive"
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {item.body && (
                  <div className="mt-1.5 rounded-lg bg-muted px-3 py-2.5">
                    {item.kind === 'note' ? (
                      noteBodyById.get(item.id) ?? (
                        <p className="text-[12.5px] leading-[1.55] text-muted-foreground">{item.body}</p>
                      )
                    ) : (
                      <p className="text-[12.5px] leading-[1.55] text-muted-foreground">{item.body}</p>
                    )}
                  </div>
                )}
                {item.meta && !item.body && (
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{item.meta}</p>
                )}
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  {item.actor_name ?? 'System'} · {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Note composer */}
      <div className="mt-3.5 border-t border-border/60 pt-3.5">
        <div className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2.5">
          <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[oklch(0.55_0.18_250/0.1)] text-[11px] font-semibold text-[oklch(0.55_0.18_250)]">
            {initials}
          </div>
          <div className="flex-1">
            <MentionTextarea
              value={noteText}
              onChange={(v, ids) => {
                setNoteText(v)
                setNoteMentions(ids)
              }}
              members={members}
              placeholder="Add a note about this candidate… Type @ to mention a teammate."
              rows={1}
              maxLength={5000}
              disabled={isPending}
              className="min-h-[1.75rem] resize-none border-0 px-0 py-1 text-[13px] focus-visible:ring-0 shadow-none bg-transparent"
            />
            {noteMentions.length > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Will notify {noteMentions.length} teammate{noteMentions.length === 1 ? '' : 's'}.
              </p>
            )}
          </div>
          <Button
            size="sm"
            className="mt-0.5 h-7 px-3 text-xs"
            onClick={handlePost}
            disabled={isPending || !noteText.trim()}
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* `currentUserId` accepted in props for parity with the candidate page;
          today it's unused locally because deletion is keyed by note ownership
          checked server-side. Keeping the parameter avoids a churny prop-rename
          downstream. */}
      <span className="hidden" data-current-user-id={currentUserId} />
    </div>
  )
}
