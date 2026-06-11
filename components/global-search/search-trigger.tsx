'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'

import { GlobalSearchDialog } from './global-search-dialog'

// Discoverable trigger pill + global keyboard shortcut for the G-023 search
// palette. Listens for ⌘K (Mac) / Ctrl-K (everywhere else) and the universal
// "/" keystroke when no input is focused. Mounted once in the dashboard
// layout so it's always available.
export function SearchTrigger() {
  const [open, setOpen] = useState(false)
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    // Render the shortcut label using the platform's modifier key. Doing
    // this in useEffect avoids a hydration mismatch — the server can't
    // know which OS the client is on.
    if (typeof navigator !== 'undefined') {
      setIsMac(/Mac|iPhone|iPad/.test(navigator.platform))
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      const isTypingInField =
        tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement | null)?.isContentEditable

      // Cmd/Ctrl-K opens the palette regardless of focus context — same
      // muscle memory as Linear, Vercel, GitHub.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
        return
      }

      // "/" opens the palette only when the recruiter isn't already typing
      // somewhere — saves a keystroke for power users while staying out of
      // the way of normal form input.
      if (e.key === '/' && !isTypingInField && !open) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open search"
        className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Search className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="hidden items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
          {isMac ? '⌘' : 'Ctrl'} K
        </kbd>
      </button>

      <GlobalSearchDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
