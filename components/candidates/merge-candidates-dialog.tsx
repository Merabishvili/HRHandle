'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { AlertTriangle, ArrowRight, ChevronLeft, Loader2, Search, Shield } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  getCandidateMergeDetails,
  getMergeRisks,
  mergeCandidates,
  searchMergeCandidates,
  type MergeCandidateSummary,
  type MergeFieldChoices,
  type MergeRisks,
} from '@/lib/actions/candidate-merge'
import { defaultMergeChoice, type MergeChoice } from '@/lib/candidate-merge/defaults'

/**
 * A-3 Merge candidates dialog — 3 steps:
 *   1. Pick the duplicate (search + suggestions).
 *   2. Resolve conflicts (radio per field, default to most-recent/non-empty).
 *   3. Confirm.
 *
 * The current candidate (the one the dialog opened from) is always the
 * winner. The user picks a `loser` whose record will be folded in and
 * soft-deleted.
 */

export interface MergeWinnerInfo {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  current_company: string | null
  current_position: string | null
  linkedin_profile_url: string | null
  source: string | null
  location: string | null
  applications_count: number
  created_at: string
}

interface MergeCandidatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  winner: MergeWinnerInfo
}

type Step = 1 | 2 | 3
type Choice = MergeChoice

interface FieldRow {
  key: keyof MergeFieldChoices
  label: string
  winnerValue: string | null
  loserValue: string | null
}

export function MergeCandidatesDialog({ open, onOpenChange, winner }: MergeCandidatesDialogProps) {
  const t = useTranslations()
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MergeCandidateSummary[]>([])
  const [searching, setSearching] = useState(false)
  const [loser, setLoser] = useState<MergeCandidateSummary | null>(null)
  const [loserDetails, setLoserDetails] = useState<Record<string, string | null>>({})
  const [choices, setChoices] = useState<Record<string, Choice>>({})
  const [risks, setRisks] = useState<MergeRisks | null>(null)
  const [riskAcknowledged, setRiskAcknowledged] = useState(false)
  const [pending, startTransition] = useTransition()

  // Reset state every time the dialog closes
  useEffect(() => {
    if (!open) {
      setStep(1)
      setQuery('')
      setResults([])
      setLoser(null)
      setLoserDetails({})
      setChoices({})
      setRisks(null)
      setRiskAcknowledged(false)
    }
  }, [open])

  // Re-fetch risks whenever the loser changes; clear when loser is null
  useEffect(() => {
    if (!loser) {
      setRisks(null)
      setRiskAcknowledged(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const res = await getMergeRisks(winner.id, loser.id)
      if (cancelled) return
      if (res.success) setRisks(res.data)
    })()
    return () => {
      cancelled = true
    }
  }, [loser, winner.id])

  // Debounced suggestion fetch on step 1
  useEffect(() => {
    if (!open || step !== 1) return
    let cancelled = false
    setSearching(true)
    const handle = setTimeout(async () => {
      const result = await searchMergeCandidates(winner.id, query)
      if (cancelled) return
      setSearching(false)
      if (result.success) setResults(result.data)
      else toast.error(result.error)
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [open, step, query, winner.id])

  // Compute the field rows for step 2 from the loser summary + a
  // second lookup for the fuller candidate detail. We piggyback on the
  // summary fields the picker already shows; everything else is fetched
  // lazily when entering step 2.
  useEffect(() => {
    if (step !== 2 || !loser) return
    let cancelled = false
    ;(async () => {
      const res = await getCandidateMergeDetails(loser.id)
      if (cancelled) return
      if (res.success && res.data) {
        setLoserDetails(res.data)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [step, loser])

  const fieldRows: FieldRow[] = useMemo(() => {
    if (!loser) return []
    const rows: FieldRow[] = [
      {
        key: 'first_name',
        label: t('candWizard.personal.firstName'),
        winnerValue: splitName(winner.full_name).first,
        loserValue: splitName(loser.full_name).first,
      },
      {
        key: 'last_name',
        label: t('candWizard.personal.lastName'),
        winnerValue: splitName(winner.full_name).last,
        loserValue: splitName(loser.full_name).last,
      },
      {
        key: 'email',
        label: t('candWizard.personal.email'),
        winnerValue: winner.email,
        loserValue: loser.email,
      },
      {
        key: 'phone',
        label: t('candWizard.personal.phone'),
        winnerValue: winner.phone,
        loserValue: loser.phone,
      },
      {
        key: 'current_company',
        label: t('candWizard.background.company'),
        winnerValue: winner.current_company,
        loserValue: loser.current_company ?? loserDetails.current_company ?? null,
      },
      {
        key: 'current_position',
        label: t('merge.role'),
        winnerValue: winner.current_position,
        loserValue: loserDetails.current_position ?? null,
      },
      {
        key: 'linkedin_profile_url',
        label: t('candWizard.personal.linkedin'),
        winnerValue: winner.linkedin_profile_url,
        loserValue: loserDetails.linkedin_profile_url ?? null,
      },
      {
        key: 'source',
        label: t('candWizard.application.sourceLabel'),
        winnerValue: winner.source,
        loserValue: loserDetails.source ?? null,
      },
      {
        key: 'location',
        label: t('candWizard.personal.location'),
        winnerValue: winner.location,
        loserValue: loserDetails.location ?? null,
      },
    ]
    // Only show rows where the values differ — otherwise there's nothing to resolve
    return rows.filter((r) => (r.winnerValue ?? '') !== (r.loserValue ?? ''))
  }, [winner, loser, loserDetails, t])

  const fieldChoices: MergeFieldChoices = useMemo(() => {
    const result: MergeFieldChoices = {}
    for (const row of fieldRows) {
      const choice = choices[row.key] ?? defaultMergeChoice(row)
      if (choice === 'loser') {
        ;(result as Record<string, string | null>)[row.key] = row.loserValue
      }
    }
    return result
  }, [fieldRows, choices])

  const submit = () => {
    if (!loser) return
    startTransition(async () => {
      const result = await mergeCandidates({
        winnerId: winner.id,
        loserId: loser.id,
        fieldChoices,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(t('merge.toastMerged'))
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="flex flex-row items-center gap-3 border-b border-border px-6 py-4">
          <DialogTitle className="text-base font-bold">{t('merge.title')}</DialogTitle>
          <span className="text-xs text-muted-foreground">
            {t('merge.stepOf', {
              step,
              label: step === 1 ? t('merge.step1') : step === 2 ? t('merge.step2') : t('merge.step3'),
            })}
          </span>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {step === 1 && (
            <Step1
              winner={winner}
              query={query}
              setQuery={setQuery}
              results={results}
              searching={searching}
              selected={loser}
              onSelect={setLoser}
            />
          )}
          {step === 2 && loser && (
            <Step2
              winner={winner}
              loser={loser}
              rows={fieldRows}
              choices={choices}
              onChange={(key, c) => setChoices((prev) => ({ ...prev, [key]: c }))}
            />
          )}
          {step === 3 && loser && (
            <Step3
              winner={winner}
              loser={loser}
              chosenFields={fieldChoices}
              rowCount={fieldRows.length}
              risks={risks}
              acknowledged={riskAcknowledged}
              onAcknowledge={setRiskAcknowledged}
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3.5">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStep((s) => (s - 1) as Step)}
              disabled={pending}
              className="gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              {t('common.back')}
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
          )}
          {step < 3 ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={(step === 1 && !loser) || pending}
              className="gap-1"
            >
              {step === 1 ? t('merge.step2') : t('merge.reviewMerge')}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={submit}
              disabled={pending || (hasRisks(risks) && !riskAcknowledged)}
              className="gap-1"
            >
              {pending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  {t('merge.merging')}
                </>
              ) : (
                t('merge.merge')
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Step1({
  winner,
  query,
  setQuery,
  results,
  searching,
  selected,
  onSelect,
}: {
  winner: MergeWinnerInfo
  query: string
  setQuery: (v: string) => void
  results: MergeCandidateSummary[]
  searching: boolean
  selected: MergeCandidateSummary | null
  onSelect: (c: MergeCandidateSummary) => void
}) {
  const t = useTranslations()
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {t.rich('merge.step1Desc', { name: winner.full_name, b: (c) => <strong className="text-foreground">{c}</strong> })}
      </p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('merge.searchPlaceholder')}
          className="pl-9"
        />
      </div>
      {searching && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> {t('search.searching')}
        </p>
      )}
      {!searching && results.length === 0 && (
        <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          {t('merge.noDuplicates')}
        </p>
      )}
      {results.length > 0 && (
        <ul className="space-y-1.5">
          {results.map((c) => {
            const isSelected = selected?.id === c.id
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-foreground/20',
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase text-muted-foreground">
                    {c.full_name.slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{c.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t('merge.resultMeta', {
                        email: c.email ?? t('merge.noEmail'),
                        date: new Date(c.created_at).toLocaleDateString(),
                        count: c.applications_count,
                      })}
                    </p>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Step2({
  winner,
  loser,
  rows,
  choices,
  onChange,
}: {
  winner: MergeWinnerInfo
  loser: MergeCandidateSummary
  rows: FieldRow[]
  choices: Record<string, Choice>
  onChange: (key: string, c: Choice) => void
}) {
  const t = useTranslations()
  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <Heads winner={winner} loser={loser} />
        <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          {t('merge.noConflicts')}
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {t('merge.step2Desc')}
      </p>
      <div className="grid grid-cols-[110px_1fr_1fr] gap-3">
        <span />
        <CandidateChip name={winner.full_name} hint={t('merge.keepRecord')} highlight />
        <CandidateChip name={loser.full_name} hint={t('merge.duplicate')} />
      </div>
      <div className="-mx-1">
        {rows.map((row) => {
          const choice = choices[row.key] ?? defaultMergeChoice(row)
          return (
            <div
              key={row.key}
              className="grid grid-cols-[110px_1fr_1fr] items-center gap-3 border-b border-border/60 px-1 py-2.5 last:border-b-0"
            >
              <span className="text-xs text-muted-foreground">{row.label}</span>
              <RadioCell
                value={row.winnerValue}
                selected={choice === 'winner'}
                onSelect={() => onChange(row.key, 'winner')}
              />
              <RadioCell
                value={row.loserValue}
                selected={choice === 'loser'}
                onSelect={() => onChange(row.key, 'loser')}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Step3({
  winner,
  loser,
  chosenFields,
  rowCount,
  risks,
  acknowledged,
  onAcknowledge,
}: {
  winner: MergeWinnerInfo
  loser: MergeCandidateSummary
  chosenFields: MergeFieldChoices
  rowCount: number
  risks: MergeRisks | null
  acknowledged: boolean
  onAcknowledge: (v: boolean) => void
}) {
  const t = useTranslations()
  const changedCount = Object.keys(chosenFields).length
  const showRisks = hasRisks(risks)
  return (
    <div className="space-y-4">
      <Heads winner={winner} loser={loser} />
      <ul className="space-y-2 text-sm text-foreground">
        <li>
          {t.rich('merge.winnerKeeps', { name: winner.full_name, b: (c) => <strong>{c}</strong> })}
        </li>
        <li>
          {t.rich('merge.loserDeleted', { name: loser.full_name, b: (c) => <strong>{c}</strong> })}
        </li>
        <li>
          {t('merge.combineNote')}
        </li>
        <li>
          {rowCount === 0 ? t('merge.noFieldsApply') : t('merge.fieldsApply', { changed: changedCount, total: rowCount })}
        </li>
      </ul>

      {showRisks && risks && (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-xs text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="font-semibold">{t('merge.riskHeader')}</span>
          </div>
          <ul className="ml-5 list-disc space-y-1">
            {risks.dualOfferVacancyTitles.map((title) => (
              <li key={title}>
                {t.rich('merge.riskDualVacancy', { title, b: (c) => <strong>{c}</strong> })}
              </li>
            ))}
            {risks.dualOfferVacancyTitles.length === 0 && risks.winnerHasOffer && risks.loserHasOffer && (
              <li>{t('merge.riskBothOffers')}</li>
            )}
            {risks.dualOfferVacancyTitles.length === 0 && !risks.winnerHasOffer && risks.loserHasOffer && (
              <li>{t('merge.riskLoserOffer')}</li>
            )}
            {risks.dualOfferVacancyTitles.length === 0 && risks.winnerHasOffer && !risks.loserHasOffer && (
              <li>{t('merge.riskWinnerOffer')}</li>
            )}
          </ul>
          <label className="flex items-start gap-2 pt-1">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => onAcknowledge(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-amber-400"
              aria-label={t('merge.ackAria')}
            />
            <span className="text-[12px] leading-relaxed">
              {t('merge.ackText')}
            </span>
          </label>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-3 text-xs text-foreground">
        <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <span>
          {t.rich('merge.reversible', { name: loser.full_name, b: (c) => <strong>{c}</strong> })}
        </span>
      </div>
    </div>
  )
}

function hasRisks(risks: MergeRisks | null): boolean {
  if (!risks) return false
  if (risks.dualOfferVacancyTitles.length > 0) return true
  if (risks.winnerHasOffer || risks.loserHasOffer) return true
  return false
}

function Heads({ winner, loser }: { winner: MergeWinnerInfo; loser: MergeCandidateSummary }) {
  const t = useTranslations()
  return (
    <div className="grid grid-cols-2 gap-3">
      <CandidateChip name={winner.full_name} hint={t('merge.keepRecord')} highlight />
      <CandidateChip name={loser.full_name} hint={t('merge.duplicate')} />
    </div>
  )
}

function CandidateChip({
  name,
  hint,
  highlight,
}: {
  name: string
  hint: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2',
        highlight ? 'border-primary bg-primary/5' : 'border-border',
      )}
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-bold uppercase text-muted-foreground">
        {name.slice(0, 2)}
      </div>
      <div className="min-w-0">
        <p className={cn('truncate text-xs font-bold', highlight ? 'text-primary' : 'text-foreground')}>{hint}</p>
        <p className="truncate text-[11px] text-muted-foreground">{name}</p>
      </div>
    </div>
  )
}

function RadioCell({
  value,
  selected,
  onSelect,
}: {
  value: string | null
  selected: boolean
  onSelect: () => void
}) {
  const t = useTranslations()
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors',
        selected ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/20',
      )}
    >
      <span
        className={cn(
          'h-4 w-4 shrink-0 rounded-full border',
          selected ? 'border-[4.5px] border-primary' : 'border-1.5 border-border',
        )}
        aria-hidden
      />
      {value ? (
        <span className="truncate text-sm text-foreground">{value}</span>
      ) : (
        <span className="text-xs italic text-muted-foreground">{t('merge.empty')}</span>
      )}
    </button>
  )
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  const first = parts[0] ?? ''
  const last = parts.length > 1 ? parts.slice(1).join(' ') : ''
  return { first, last }
}

