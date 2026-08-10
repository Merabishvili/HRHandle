'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import {
  getStageStyle,
  isTerminalStage,
  STALE_SPINE,
  STALE_TEXT,
} from '@/lib/pipeline/stage-style'
import { timeInStage } from '@/lib/pipeline/time-in-stage'
import { toDisplayName } from '@/lib/format-name'

export interface CrossVacancyCardData {
  applicationId: string
  candidateId: string
  firstName: string
  lastName: string
  vacancyTitle: string
  /** Existing job title from the candidate's CV — no longer rendered on
   * the card; the vacancy title is the subtitle per the redesign. Kept
   * on the type so callers don't need to change shape; future card
   * variants may surface it again. */
  currentPosition: string | null
  /** Short source label ("LinkedIn", "Apply link", "Referral", "Manual").
   * Threaded through from candidates.source; mapped server-side to the
   * short form. Null when the recruiter didn't set it. */
  source: string | null
  /** Timestamp the card is "in this stage since" — applied_at for fresh
   * applications, last_status_changed_at for moved ones. */
  inStageSince: string
  /** When the underlying application was created. Drives the "New" badge
   * for fresh applies on the Applied column (< 24h). */
  appliedAt: string
  /** Code of the stage the card sits in. Drives the spine color. */
  stageCode: string
  /** 0–10 fit score from the most recent candidate_evaluation. Optional;
   * surfaced when present, hidden otherwise. */
  fitScore: number | null
  /** Rejection reason name (rejected cards only) — shown in the List view's
   * Closed section. */
  rejectionReason: string | null
}

interface CrossVacancyCardProps {
  data: CrossVacancyCardData
  selected: boolean
  onToggleSelect: (id: string, next: boolean) => void
}

/** Avatar background hue, deterministic per first letter. The design
 * varies avatar tints between candidates to make scanning easier; we don't
 * need cryptographic randomness, just stable variation across the list. */
const AVATAR_HUES = [
  { bg: 'oklch(0.93 0.04 250)', text: 'oklch(0.45 0.16 250)' },
  { bg: 'oklch(0.94 0.05 165)', text: 'oklch(0.4 0.1 165)' },
  { bg: 'oklch(0.95 0.06 95)', text: 'oklch(0.45 0.1 80)' },
  { bg: 'oklch(0.93 0.06 300)', text: 'oklch(0.45 0.15 300)' },
  { bg: 'oklch(0.94 0.05 210)', text: 'oklch(0.42 0.12 210)' },
]

function avatarStyle(seed: string): { background: string; color: string } {
  const code = seed.charCodeAt(0) || 0
  const hue = AVATAR_HUES[code % AVATAR_HUES.length]!
  return { background: hue.bg, color: hue.text }
}

function fitScorePill(score: number | null): { className: string; score: string } | null {
  if (score === null) return null
  const s = score.toFixed(1)
  if (score >= 7) return { className: 'bg-[oklch(0.93_0.07_155)] text-[oklch(0.38_0.14_150)]', score: s }
  if (score >= 5) return { className: 'bg-[oklch(0.95_0.08_95)] text-[oklch(0.45_0.11_80)]', score: s }
  return { className: 'bg-[oklch(0.95_0.04_25)] text-[oklch(0.5_0.18_25)]', score: s }
}

export function CrossVacancyCard({
  data,
  selected,
  onToggleSelect,
}: CrossVacancyCardProps) {
  const t = useTranslations()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: data.applicationId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const stageStyle = getStageStyle(data.stageCode)
  const time = timeInStage(data.inStageSince)
  // Staleness only applies to active stages — a hired/rejected/withdrawn
  // candidate is done, so it can never be "stale". Gate the amber spine +
  // label on that so terminal cards keep their own stage hue (Hired = green).
  const terminal = isTerminalStage(data.stageCode)
  const isStale = time.isStale && !terminal
  const spine = isStale ? STALE_SPINE : stageStyle.spine

  const initials = `${data.firstName[0] ?? ''}${data.lastName[0] ?? ''}`.toUpperCase()
  const avatar = avatarStyle(data.firstName)
  const fit = fitScorePill(data.fitScore)

  // Bottom metadata line varies by stage. Terminal stages get a settled,
  // positive line (never "stale"): Hired reads "Hired Nd ago", the other
  // closed outcomes just show time-in-stage. Active stages show source and
  // flip to the amber "· stale" suffix past the threshold.
  const bottomLabel =
    data.stageCode === 'hired'
      ? t('pipeline.hiredAgo', { time: time.label })
      : terminal
        ? t('pipeline.inStage', { time: time.label })
        : isStale
          ? t('pipeline.inStageStale', { time: time.label })
          : data.source
            ? t('pipeline.inStageSource', { time: time.label, source: data.source })
            : t('pipeline.inStage', { time: time.label })

  // "New" badge: applies (Applied stage) created within the last 24 hours
  // surface a small pill so the recruiter immediately spots fresh
  // candidates without scanning timestamps.
  const isApplied = data.stageCode === 'applied'
  const isFresh =
    isApplied && Date.now() - new Date(data.appliedAt).getTime() < 24 * 60 * 60 * 1000

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          'rounded-lg border bg-card p-3 shadow-sm transition-colors',
          selected ? 'border-primary/60 ring-2 ring-primary/20' : 'border-border',
        )}
        style={{ borderLeft: `3px solid ${spine}` }}
      >
        <div className="flex items-start gap-2">
          <Checkbox
            checked={selected}
            onCheckedChange={(v) => onToggleSelect(data.applicationId, v === true)}
            aria-label={t('pipeline.selectNamed', { name: `${data.firstName} ${data.lastName}` })}
            className="mt-1"
          />
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={t('pipeline.dragCandidate')}
            className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-full text-[11px] font-bold active:cursor-grabbing"
            style={{ background: avatar.background, color: avatar.color }}
          >
            {initials}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Link
                href={`/candidates/${data.candidateId}`}
                className="block truncate text-[13px] font-semibold text-foreground hover:underline"
              >
                {toDisplayName(data.firstName)} {toDisplayName(data.lastName)}
              </Link>
              {isFresh && (
                <span className="shrink-0 rounded bg-[oklch(0.93_0.05_250)] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-[oklch(0.42_0.16_250)]">
                  {t('pipeline.newBadge')}
                </span>
              )}
            </div>
            <p className="truncate text-[11.5px] text-muted-foreground">{data.vacancyTitle}</p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px]">
          <span
            className="flex items-center gap-1.5"
            style={{
              color: isStale ? STALE_TEXT : undefined,
              fontWeight: isStale ? 600 : undefined,
            }}
          >
            {isStale && (
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: STALE_SPINE }}
                aria-hidden
              />
            )}
            <span className={isStale ? undefined : 'text-muted-foreground'}>
              {bottomLabel}
            </span>
          </span>
          {fit && (
            <span
              className={cn(
                'ml-auto inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                fit.className,
              )}
              aria-label={t('pipeline.fitScoreAria', { score: fit.score })}
            >
              {t('pipeline.fit', { score: fit.score })}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
