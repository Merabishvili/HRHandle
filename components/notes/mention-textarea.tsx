'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'

import { Textarea } from '@/components/ui/textarea'
import type { MentionableMember } from '@/lib/notes/mentions'

export interface MentionTextareaProps {
  value: string
  onChange: (value: string, mentions: string[]) => void
  members: MentionableMember[]
  placeholder?: string
  disabled?: boolean
  rows?: number
  maxLength?: number
  className?: string
  id?: string
}

// Lightweight @-mention typeahead built on the existing Textarea. The "popover"
// is a positioned <ul> that opens when the caret immediately follows an `@`
// and a partial name, and closes on Escape / blur / selection / cursor moves
// past the trigger. No external dependency — kept under 200 LOC so it's easy
// to debug six months from now.
export function MentionTextarea({
  value,
  onChange,
  members,
  placeholder,
  disabled,
  rows = 3,
  maxLength = 5000,
  className,
  id,
}: MentionTextareaProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const [trigger, setTrigger] = useState<{ start: number; query: string } | null>(null)
  const [hover, setHover] = useState(0)

  const matches = useMemo(() => {
    if (!trigger) return []
    const q = trigger.query.toLowerCase()
    return members
      .filter((m) => m.display_name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [members, trigger])

  const updateTrigger = useCallback(
    (text: string, caret: number) => {
      // Scan backwards from the caret to find the trigger '@'. The trigger
      // window ends if we hit whitespace, another '@', or the start of text.
      let i = caret - 1
      let query = ''
      while (i >= 0) {
        const ch = text[i]
        if (ch === '@') {
          // Trigger valid only when '@' is at start of text or follows
          // whitespace — avoids opening the popover inside an email like
          // alex@example.com.
          const prev = i > 0 ? text[i - 1] : ''
          if (i === 0 || /\s/.test(prev)) {
            setTrigger({ start: i, query })
            setHover(0)
            return
          }
          setTrigger(null)
          return
        }
        if (/\s/.test(ch)) break
        query = ch + query
        i--
      }
      setTrigger(null)
    },
    [],
  )

  const onTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    const caret = e.target.selectionStart ?? v.length
    onChange(v, committedIdsFor(v, members))
    updateTrigger(v, caret)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!trigger || matches.length === 0) {
      if (e.key === 'Escape') setTrigger(null)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHover((h) => (h + 1) % matches.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHover((h) => (h - 1 + matches.length) % matches.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      pick(matches[hover])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setTrigger(null)
    }
  }

  const pick = (member: MentionableMember) => {
    if (!trigger) return
    const before = value.slice(0, trigger.start)
    const after = value.slice(trigger.start + 1 + trigger.query.length)
    const inserted = `@${member.display_name}`
    const next = `${before}${inserted}${after.startsWith(' ') ? '' : ' '}${after}`
    onChange(next, committedIdsFor(next, members))
    setTrigger(null)
    // Move caret to immediately after the inserted mention + space.
    requestAnimationFrame(() => {
      if (!ref.current) return
      const pos = before.length + inserted.length + 1
      ref.current.focus()
      ref.current.setSelectionRange(pos, pos)
    })
  }

  // Close the popover on blur after a tick so a click on a popover row still
  // registers as a `pick` first.
  useEffect(() => {
    if (!trigger) return
    const handler = (ev: MouseEvent) => {
      const node = ref.current?.parentElement
      if (!node) return
      if (!node.contains(ev.target as Node)) setTrigger(null)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [trigger])

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        id={id}
        value={value}
        onChange={onTextChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        maxLength={maxLength}
        className={className}
      />
      {trigger && matches.length > 0 && (
        <ul
          role="listbox"
          aria-label="Members to mention"
          className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-auto rounded-md border border-border bg-popover py-1 shadow-md"
        >
          {matches.map((m, i) => (
            <li
              key={m.id}
              role="option"
              aria-selected={i === hover}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(m)
              }}
              onMouseEnter={() => setHover(i)}
              className={[
                'cursor-pointer px-3 py-1.5 text-sm',
                i === hover
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground',
              ].join(' ')}
            >
              <span className="font-medium">@{m.display_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Local helper so we can pass the new mentions list synchronously with the
// new text in the same onChange call. Keeps the parent simple.
function committedIdsFor(text: string, members: MentionableMember[]): string[] {
  if (!text) return []
  const out: string[] = []
  for (const m of members) {
    const needle = `@${m.display_name}`.toLowerCase()
    if (text.toLowerCase().includes(needle)) out.push(m.id)
  }
  return out
}
