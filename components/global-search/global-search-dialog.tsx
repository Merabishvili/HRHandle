'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Briefcase, MessageSquare, UserCircle, Loader2 } from 'lucide-react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

import { globalSearch, type GlobalSearchResults } from '@/lib/actions/search'
import { MIN_QUERY_LENGTH } from '@/lib/search/query'

interface GlobalSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DEBOUNCE_MS = 200

// Modal command palette (G-023). Mounted in the dashboard layout so it's
// available on every authed page. The keyboard shortcut + trigger button
// live in <SearchTrigger>; this component is purely the dialog body.
export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GlobalSearchResults | null>(null)
  const [, startTransition] = useTransition()
  // Forward-only counter for race-guarding async responses. We bump it on
  // every keystroke that schedules a fetch; the eventual response only
  // commits if its id still matches the latest.
  const requestSeqRef = useRef(0)

  // Reset the input whenever the dialog opens — the recruiter usually means
  // a fresh search, and stale results between two unrelated lookups would
  // confuse them.
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults(null)
    }
  }, [open])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults(null)
      return
    }

    requestSeqRef.current += 1
    const thisRequestId = requestSeqRef.current
    const handle = setTimeout(() => {
      startTransition(async () => {
        const result = await globalSearch(query)
        if (thisRequestId !== requestSeqRef.current) return
        if (result.success) {
          setResults(result.data)
        }
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [query])

  const navigate = (path: string) => {
    onOpenChange(false)
    router.push(path)
  }

  const queryTrimmed = query.trim()
  const isShort = queryTrimmed.length > 0 && queryTrimmed.length < MIN_QUERY_LENGTH
  const isEmpty = queryTrimmed.length === 0
  const hasAnyResult =
    !!results &&
    (results.candidates.length > 0 ||
      results.vacancies.length > 0 ||
      results.notes.length > 0)

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search candidates, vacancies, and notes"
      description="Find anyone or anything in your workspace."
      // The Command primitive's built-in filter would otherwise hide rows
      // we just fetched. We do the matching server-side.
      shouldFilter={false}
    >
      <CommandInput
        placeholder="Search candidates, vacancies, and notes…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {isEmpty && (
          <CommandEmpty>
            <SearchTip />
          </CommandEmpty>
        )}
        {isShort && (
          <CommandEmpty>
            Keep typing — at least {MIN_QUERY_LENGTH} characters.
          </CommandEmpty>
        )}
        {!isEmpty && !isShort && !results && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching…
          </div>
        )}
        {!isEmpty && !isShort && results && !hasAnyResult && (
          <CommandEmpty>No matches. Try a different query.</CommandEmpty>
        )}

        {results && results.candidates.length > 0 && (
          <CommandGroup heading="Candidates">
            {results.candidates.map((c) => {
              const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()
              const subtitle =
                [c.current_position, c.current_company].filter(Boolean).join(' · ') ||
                c.email ||
                ''
              return (
                <CommandItem
                  key={c.id}
                  value={`candidate-${c.id}`}
                  onSelect={() => navigate(`/candidates/${c.id}`)}
                >
                  <UserCircle className="text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{name}</p>
                    {subtitle && (
                      <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                    )}
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {results && results.vacancies.length > 0 && (
          <CommandGroup heading="Vacancies">
            {results.vacancies.map((v) => {
              const subtitle =
                [v.department, v.location].filter(Boolean).join(' · ') || ''
              return (
                <CommandItem
                  key={v.id}
                  value={`vacancy-${v.id}`}
                  onSelect={() => navigate(`/vacancies/${v.id}`)}
                >
                  <Briefcase className="text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{v.title}</p>
                    {subtitle && (
                      <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                    )}
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {results && results.notes.length > 0 && (
          <CommandGroup heading="Notes">
            {results.notes.map((n) => {
              const name =
                `${n.candidate_first_name ?? ''} ${n.candidate_last_name ?? ''}`.trim()
              return (
                <CommandItem
                  key={n.id}
                  value={`note-${n.id}`}
                  onSelect={() => navigate(`/candidates/${n.candidate_id}?note=${n.id}`)}
                >
                  <MessageSquare className="text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{n.preview}</p>
                    <p className="truncate text-xs text-muted-foreground">on {name}</p>
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}

function SearchTip() {
  return (
    <div className="px-4 py-6 text-left">
      <p className="text-sm font-medium text-foreground">Search your workspace</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        <li>Candidates by name, email, company, or job title</li>
        <li>Vacancies by title, department, or location</li>
        <li>Notes by their content</li>
      </ul>
    </div>
  )
}
