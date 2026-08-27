'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { UserPlus, Loader2, Search, UserCircle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { searchCandidatesForVacancy } from '@/lib/actions/candidates'
import { createApplication } from '@/lib/actions/applications'
import { createApplicationErrorMessage } from '@/lib/i18n/create-application-error'

interface Props {
  vacancyId: string
}

interface Candidate {
  id: string
  first_name: string
  last_name: string
  email: string | null
  current_position: string | null
}

export function AddCandidateToVacancyDialog({ vacancyId }: Props) {
  const t = useTranslations()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Candidate[]>([])
  const [searched, setSearched] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSearching, startSearch] = useTransition()
  const [isAdding, startAdd] = useTransition()

  const handleSearch = useCallback((value: string) => {
    setQuery(value)
    setError(null)
    startSearch(async () => {
      const result = await searchCandidatesForVacancy(vacancyId, value)
      if (result.success) {
        setResults(result.data)
        setSearched(true)
      }
    })
  }, [vacancyId])

  const handleAdd = (candidate: Candidate) => {
    setAddingId(candidate.id)
    setError(null)
    startAdd(async () => {
      const result = await createApplication({ candidateId: candidate.id, vacancyId })
      if (result.success) {
        setOpen(false)
        router.refresh()
      } else {
        setError(createApplicationErrorMessage(t, result))
        setAddingId(null)
      }
    })
  }

  const handleOpenChange = (v: boolean) => {
    setOpen(v)
    if (!v) {
      setQuery('')
      setResults([])
      setSearched(false)
      setError(null)
      setAddingId(null)
    } else {
      // Load all candidates on open
      startSearch(async () => {
        const result = await searchCandidatesForVacancy(vacancyId, '')
        if (result.success) {
          setResults(result.data)
          setSearched(true)
        }
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-2 h-3.5 w-3.5" />
          {t('pipeline.addCandidate')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('addCandVac.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('addCandVac.searchPlaceholder')}
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Results */}
          <div className="max-h-72 overflow-y-auto space-y-1 rounded-lg border border-border">
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : results.length === 0 && searched ? (
              <div className="flex flex-col items-center py-8 text-center px-4">
                <UserCircle className="h-8 w-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {query ? t('addCandVac.noMatch') : t('addCandVac.noneAvailable')}
                </p>
              </div>
            ) : (
              results.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {c.first_name} {c.last_name}
                    </p>
                    {(c.current_position || c.email) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {c.current_position || c.email}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-7 text-xs"
                    disabled={isAdding && addingId === c.id}
                    onClick={() => handleAdd(c)}
                  >
                    {isAdding && addingId === c.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      t('addCandVac.addBtn')
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Create new candidate */}
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">{t('addCandVac.cantFind')}</span>
            <Button size="sm" variant="outline" asChild onClick={() => setOpen(false)}>
              <Link href={`/candidates/new?vacancy=${vacancyId}`}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t('candWizard.review.newCandidate')}
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
